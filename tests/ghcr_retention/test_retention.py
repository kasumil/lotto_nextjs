import copy
import datetime as dt
import importlib.util
import pathlib
import unittest
from unittest.mock import patch

SPEC = importlib.util.spec_from_file_location('retention', pathlib.Path(__file__).parents[2] / '.github/retention/ghcr_retention.py')
r = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(r)
NOW = dt.datetime(2026, 11, 9, 3, 0, tzinfo=dt.timezone.utc)
REPO = 'kasumil/kasumil-portfolio-v2'
M = 'application/vnd.oci.image.manifest.v1+json'
I = 'application/vnd.oci.image.index.v1+json'
def d(i): return 'sha256:' + format(i, '064x')
def desc(i, media=M): return {'digest': d(i), 'size': 100, 'mediaType': media}
def manifest(): return {'schemaVersion': 2, 'mediaType': M, 'config': desc(999, 'application/vnd.oci.image.config.v1+json'), 'layers': []}
def row(i, tags=None): return {'id': i, 'name': d(i), 'created_at': f'2020-{i:02d}-01T00:00:00Z', 'metadata': {'container': {'tags': tags if tags is not None else [f'run-{i}']}}}
class RetentionTests(unittest.TestCase):
    def setUp(self):
        self.rows = [row(i) for i in range(1, 8)]
        self.manifests = {d(i): manifest() for i in range(1, 8)}
        self.protection = {'package': 'ghcr.io/kasumil/kasumil-portfolio-v2', 'captured_at': NOW.isoformat(), 'source': 'NAS current and previous containers plus explicit rollback inventory', 'current': d(7), 'previous': d(6), 'rollback': []}
    def plan(self, after=None):
        return r.plan(self.rows, self.manifests, self.protection, REPO, NOW, self.rows if after is None else after)
    def test_low_frequency_keeps_five_even_years_old(self):
        p = self.plan()
        self.assertEqual(p['newest_five_roots'], [d(i) for i in range(3, 8)])
        self.assertEqual([v['digest'] for v in p['candidate_versions']], [d(1), d(2)])
    def test_multiple_tags_count_one_digest(self):
        self.rows[6]['metadata']['container']['tags'] += ['a' * 40, 'run-999']
        self.assertEqual(self.plan()['root_count'], 7)
        self.assertEqual(len(self.plan()['newest_five_roots']), 5)
    def test_semantic_and_rollback_tags_preserved(self):
        self.rows[0]['metadata']['container']['tags'] = ['v1.0', 'rollback-good']
        self.assertNotIn(d(1), [v['digest'] for v in self.plan()['candidate_versions']])
    def test_explicit_old_rollback_preserved(self):
        self.protection['rollback'] = [d(1)]
        self.assertEqual([v['digest'] for v in self.plan()['candidate_versions']], [d(2)])
    def test_multiarch_shared_child_and_attestation(self):
        for i in [8, 9, 10]:
            self.rows.append(row(i, []))
            self.manifests[d(i)] = manifest()
        # Candidate root 1 and protected root 7 share architecture 8.
        self.manifests[d(1)] = {'schemaVersion': 2, 'mediaType': I, 'manifests': [desc(8), desc(9)]}
        self.manifests[d(7)] = {'schemaVersion': 2, 'mediaType': I, 'manifests': [desc(8), {**desc(10), 'annotations': {'vnd.docker.reference.digest': d(8), 'vnd.docker.reference.type': 'attestation-manifest'}}]}
        self.manifests[d(10)]['subject'] = desc(8)
        p = self.plan()
        candidates = {v['digest'] for v in p['candidate_versions']}
        self.assertTrue({d(1), d(9)} <= candidates)
        self.assertTrue({d(7), d(8), d(10)}.isdisjoint(candidates))
    def test_stale_and_future_input(self):
        for seconds in [-901, 1]:
            self.protection['captured_at'] = (NOW + dt.timedelta(seconds=seconds)).isoformat()
            with self.assertRaises(r.Unsafe): self.plan()
    def test_empty_invalid_or_wrong_package(self):
        for key, value in [('current', ''), ('previous', 'sha256:bad'), ('source', ''), ('rollback', None), ('package', 'ghcr.io/kasumil/lotto-nextjs')]:
            with self.subTest(key=key):
                original = self.protection[key]
                self.protection[key] = value
                with self.assertRaises(r.Unsafe): self.plan()
                self.protection[key] = original
    def test_missing_protected_root(self):
        self.protection['rollback'] = [d(500)]
        with self.assertRaises(r.Unsafe): self.plan()
    def test_unknown_orphan_blocks_all(self):
        self.rows.append(row(8, [])); self.manifests[d(8)] = manifest()
        with self.assertRaises(r.Unsafe): self.plan()
    def test_orphan_diagnostics_never_emit_candidates(self):
        self.rows.append(row(8, [])); self.manifests[d(8)] = manifest()
        with self.assertRaises(r.OrphanGraph) as caught:
            self.plan()
        report = caught.exception.report
        self.assertEqual(report['mode'], 'BLOCKED_DIAGNOSTIC_ONLY')
        self.assertEqual(report['orphan_digests'], [d(8)])
        self.assertEqual(report['protected_missing_from_inventory'], [])
        self.assertEqual(len(report['versions']), 8)
        self.assertNotIn('candidate_versions', report)
        self.assertNotIn('candidate_groups', report)

    def test_untagged_index_diagnostics_include_whole_component(self):
        self.rows.extend([row(8, []), row(9, [])])
        self.manifests[d(8)] = {'schemaVersion': 2, 'mediaType': I, 'manifests': [desc(9)]}
        self.manifests[d(9)] = manifest()
        with self.assertRaises(r.OrphanGraph) as caught:
            self.plan()
        self.assertEqual(caught.exception.report['orphan_digests'], [d(8), d(9)])

    def test_missing_dependency_blocks_all(self):
        self.manifests[d(1)] = {'schemaVersion': 2, 'mediaType': I, 'manifests': [desc(500)]}
        with self.assertRaises(r.Unsafe): self.plan()
    def test_partial_graph_blocks_all(self):
        del self.manifests[d(1)]
        with self.assertRaises(r.Unsafe): self.plan()
    def test_malformed_manifest_blocks_all(self):
        self.manifests[d(1)].pop('config')
        with self.assertRaises(r.Unsafe): self.plan()
    def test_new_push_race_blocks_all(self):
        with self.assertRaises(r.Unsafe): self.plan(self.rows + [row(8)])
    def test_tag_movement_race_blocks_all(self):
        after = copy.deepcopy(self.rows)
        after[0]['metadata']['container']['tags'] = ['run-99']
        with self.assertRaises(r.Unsafe): self.plan(after)
    def test_api_pagination_failure_no_partial_return(self):
        client = r.Client('fixture', 'fixture', 'kasumil-portfolio-v2')
        import json
        first = [{'id': i} for i in range(100)]
        with patch.object(client, 'get', side_effect=[(json.dumps(first).encode(), {'Link': '<next>; rel="next"'}), r.Unsafe('read failed')]):
            with self.assertRaises(r.Unsafe): client.versions()
    def test_api_repeated_page_blocks_all(self):
        client = r.Client('fixture', 'fixture', 'kasumil-portfolio-v2')
        import json
        first = [{'id': i} for i in range(100)]
        with patch.object(client, 'get', return_value=(json.dumps(first).encode(), {})):
            with self.assertRaises(r.Unsafe): client.versions()
    def test_short_page_with_next_blocks_all(self):
        client = r.Client('fixture', 'fixture', 'kasumil-portfolio-v2')
        with patch.object(client, 'get', return_value=(b'[{"id":1}]', {'Link':'<next>; rel="next"'})):
            with self.assertRaises(r.Unsafe): client.versions()
    def test_unknown_manifest_type(self):
        self.manifests[d(1)]['mediaType'] = 'unknown'
        with self.assertRaises(r.Unsafe): self.plan()
    def test_missing_subject(self):
        self.manifests[d(1)]['subject'] = desc(500)
        with self.assertRaises(r.Unsafe): self.plan()
    def test_portfolio_requires_distinct_previous(self):
        for previous in [None, d(7)]:
            self.protection['previous'] = previous
            with self.assertRaises(r.Unsafe): self.plan()
    def test_other_packages_allow_absent_previous(self):
        for repo, package in r.MAPPING.items():
            if repo == REPO: continue
            protection = dict(self.protection, package='ghcr.io/kasumil/' + package, previous=None)
            self.assertEqual(r.protected_input(protection, repo, NOW), {d(7)})
    def test_index_cycle_blocks_all(self):
        self.rows.extend([row(8, []), row(9, [])])
        self.manifests[d(1)] = {'schemaVersion': 2, 'mediaType': I, 'manifests': [desc(8, I)]}
        self.manifests[d(8)] = {'schemaVersion': 2, 'mediaType': I, 'manifests': [desc(9, I)]}
        self.manifests[d(9)] = {'schemaVersion': 2, 'mediaType': I, 'manifests': [desc(8, I)]}
        with self.assertRaises(r.Unsafe): self.plan()
    def test_unclassified_artifact_blocks_all(self):
        self.manifests[d(1)]['artifactType'] = 'custom-artifact'
        with self.assertRaises(r.Unsafe): self.plan()
    def test_ambiguous_hex_and_prefixed_tags_preserved(self):
        for tag in ['abcdef0', 'abcdef0123456789', 'sha-abcdef0', 'sha-' + 'a' * 40, 'run-1-2']:
            self.rows[0]['metadata']['container']['tags'] = [tag]
            self.assertIn(d(1), self.plan()['semantic_tag_roots'])
    def modern_attestation(self):
        for i in [8, 9]:
            self.rows.append(row(i, []))
            self.manifests[d(i)] = manifest()
        image = {**desc(8), 'size': 2194}
        attestation = {**desc(9), 'size': 838, 'platform': {'architecture': 'unknown', 'os': 'unknown'}}
        self.manifests[d(7)] = {'schemaVersion': 2, 'mediaType': I, 'manifests': [image, attestation]}
        self.manifests[d(9)].update(artifactType=r.BUILDKIT_ATTESTATION, config=desc(999, r.OCI_EMPTY), subject=image, layers=[desc(998, 'application/vnd.in-toto+json')])
    def test_modern_buildkit_shape_and_bidirectional_protection(self):
        self.modern_attestation()
        p = self.plan()
        self.assertTrue({d(8), d(9)}.isdisjoint(v['digest'] for v in p['candidate_versions']))
        edges, groups = r.graph(r.inventory(self.rows), self.manifests)
        self.assertIn(d(9), r.closure({d(8)}, edges))
        self.assertIn(d(8), r.closure({d(9)}, edges))
        self.assertEqual(groups[d(7)], {d(7), d(8), d(9)})
    def test_modern_buildkit_wrong_artifact_rejected(self):
        self.modern_attestation()
        self.manifests[d(9)]['artifactType'] = 'unknown'
        with self.assertRaises(r.Unsafe): self.plan()
    def test_modern_buildkit_wrong_config_rejected(self):
        self.modern_attestation()
        self.manifests[d(9)]['config'] = desc(999, 'application/vnd.oci.image.config.v1+json')
        with self.assertRaises(r.Unsafe): self.plan()
    def test_modern_buildkit_missing_subject_rejected(self):
        self.modern_attestation()
        del self.manifests[d(9)]['subject']
        with self.assertRaises(r.Unsafe): self.plan()
    def test_empty_config_without_known_artifact_rejected(self):
        self.modern_attestation()
        del self.manifests[d(9)]['artifactType']
        with self.assertRaises(r.Unsafe): self.plan()
    def test_modern_buildkit_subject_media_mismatch_rejected(self):
        self.modern_attestation()
        self.manifests[d(9)]['subject'] = desc(8, I)
        with self.assertRaises(r.Unsafe): self.plan()
    def test_workflow_is_exact_branch_read_only(self):
        text = (pathlib.Path(__file__).parents[2] / '.github/workflows/ghcr-retention-dry-run.yml').read_text()
        expected_events = """on:
  push:
    branches:
      - ghcr-retention-dry-run-review
  workflow_dispatch:
    inputs:
      protection_json:
        description: 'Fresh package-scoped snapshot: package, captured_at, source, current, previous, rollback'
        required: false
        type: string
"""
        self.assertEqual(text.split('on:', 1)[1].split('permissions:', 1)[0], expected_events.split('on:', 1)[1])
        self.assertIn("if: github.ref == 'refs/heads/ghcr-retention-dry-run-review' && (github.event_name == 'push' || github.event_name == 'workflow_dispatch')", text)
        self.assertIn('contents: read', text)
        self.assertIn('packages: read', text)
        self.assertNotIn('pull_request:', text)
        self.assertNotIn('main', text)
        self.assertNotIn('master', text)
        self.assertIn('export PROTECTION_JSON="$(cat .github/retention-protection.json)"', text)
        self.assertNotIn('${{ inputs.protection_json }}', text.split('        run: |', 1)[1])
        self.assertNotIn('schedule:', text)
        self.assertNotIn('packages: write', text)
        self.assertIn('PROTECTION_JSON: ${{ inputs.protection_json }}', text)

if __name__ == '__main__': unittest.main()
