#!/usr/bin/env python3
"""Read-only GHCR inventory and conservative count-retention review. No mutation API."""
import base64
import datetime as dt
import hashlib
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request

MAPPING = {
    'kasumil/kasumil-portfolio-v2': 'kasumil-portfolio-v2',
    'kasumil/node_synology_default': 'synology-portfolio-api',
    'kasumil/lotto_nextjs': 'lotto-nextjs',
    'kasumil/kasumil-admin': 'kasumil-admin',
}
INDEX = {'application/vnd.oci.image.index.v1+json', 'application/vnd.docker.distribution.manifest.list.v2+json'}
MANIFEST = {'application/vnd.oci.image.manifest.v1+json', 'application/vnd.docker.distribution.manifest.v2+json'}
BUILDKIT_ATTESTATION = 'application/vnd.docker.attestation.manifest.v1+json'
OCI_EMPTY = 'application/vnd.oci.empty.v1+json'
DIGEST = re.compile(r'sha256:[0-9a-f]{64}\Z')
MACHINE = re.compile(r'[0-9a-f]{40}\Z|run-[0-9]+\Z')
MAX_FRESH_SECONDS = 900  # Deployment snapshot safety only. NEVER image expiry.

class Unsafe(ValueError):
    pass

def check(ok, message):
    if not ok:
        raise Unsafe(message)

def timestamp(value):
    check(isinstance(value, str), 'Timestamp must be a string')
    try:
        parsed = dt.datetime.fromisoformat(value.replace('Z', '+00:00'))
        check(parsed.tzinfo is not None, 'Timestamp needs a timezone')
        return parsed
    except (ValueError, TypeError) as error:
        raise Unsafe('Invalid timestamp') from error

def digest(value):
    check(isinstance(value, str) and DIGEST.fullmatch(value), 'Invalid SHA256 digest')
    return value

def protected_input(data, repo, now):
    check(repo in MAPPING, 'Repository not allowed')
    check(isinstance(data, dict), 'Protection input must be an object')
    check(set(data) == {'package', 'captured_at', 'source', 'current', 'previous', 'rollback'}, 'Protection fields mismatch')
    check(data['package'] == 'ghcr.io/kasumil/' + MAPPING[repo], 'Protection package mismatch')
    check(isinstance(data['source'], str) and bool(data['source'].strip()), 'Snapshot provenance required')
    age = (now - timestamp(data['captured_at'])).total_seconds()
    check(0 <= age <= MAX_FRESH_SECONDS, 'Protection snapshot is stale or future-dated')
    check(isinstance(data['rollback'], list), 'Rollback must be a list, explicitly [] if none')
    current = digest(data['current'])
    previous = data['previous']
    if repo == 'kasumil/kasumil-portfolio-v2':
        check(previous is not None and previous != current, 'Portfolio requires distinct current and previous roots')
    check(previous is None or previous != current, 'Do not fabricate previous=current; use null when no previous slot exists')
    return {current, *( [digest(previous)] if previous is not None else [] ), *(digest(d) for d in data['rollback'])}

def inventory(rows):
    check(isinstance(rows, list) and bool(rows), 'Empty or invalid package inventory')
    result, ids = {}, set()
    for row in rows:
        check(isinstance(row, dict), 'Invalid version')
        d = digest(row.get('name'))
        ident = row.get('id')
        check(type(ident) is int and ident > 0 and ident not in ids and d not in result, 'Duplicate or invalid package version')
        tags = row.get('metadata', {}).get('container', {}).get('tags')
        check(isinstance(tags, list) and all(isinstance(t, str) and t for t in tags) and len(tags) == len(set(tags)), 'Malformed tags')
        result[d] = {'id': ident, 'tags': sorted(tags), 'created_at': timestamp(row.get('created_at')).isoformat()}
        ids.add(ident)
    all_tags = [t for v in result.values() for t in v['tags']]
    check(len(all_tags) == len(set(all_tags)), 'Tag appears on multiple digests')
    return result

def descriptor(value):
    check(isinstance(value, dict), 'Malformed descriptor')
    d = digest(value.get('digest'))
    check(type(value.get('size')) is int and value['size'] >= 0, 'Invalid descriptor size')
    check(isinstance(value.get('mediaType'), str) and bool(value['mediaType']), 'Missing descriptor media type')
    return d

def graph(inv, manifests):
    check(set(inv) == set(manifests), 'Incomplete manifest inventory')
    edges = {d: set() for d in inv}
    incoming = set()
    index_edges = {d: set() for d in inv}
    for d, m in manifests.items():
        check(isinstance(m, dict) and m.get('schemaVersion') == 2, 'Malformed manifest')
        media = m.get('mediaType')
        check(media in INDEX | MANIFEST, 'Unknown manifest type')
        is_attestation = m.get('artifactType') == BUILDKIT_ATTESTATION
        check('artifactType' not in m or is_attestation, 'Unknown artifact type')
        if is_attestation:
            check(media == 'application/vnd.oci.image.manifest.v1+json', 'Attestation requires OCI image manifest')
            check('subject' in m, 'BuildKit attestation subject required')
        if media in INDEX:
            children = m.get('manifests')
            check(isinstance(children, list) and bool(children), 'Empty or malformed index')
            for child in children:
                target = descriptor(child)
                check(target in inv, 'Missing manifest dependency')
                check(child['mediaType'] == manifests[target].get('mediaType'), 'Child media type mismatch')
                edges[d].add(target)
                index_edges[d].add(target)
                incoming.add(target)
                annotations = child.get('annotations', {})
                check(isinstance(annotations, dict), 'Malformed annotations')
                ref = annotations.get('vnd.docker.reference.digest')
                if ref is not None:
                    ref = digest(ref)
                    check(ref in inv, 'Missing attestation reference')
                    # Keep the referenced image and attestation together.
                    edges[target].add(ref)
                    edges[ref].add(target)
        else:
            descriptor(m.get('config'))
            if is_attestation:
                check(m['config']['mediaType'] == OCI_EMPTY, 'BuildKit attestation requires OCI empty config')
            else:
                check(m['config']['mediaType'] in {'application/vnd.oci.image.config.v1+json', 'application/vnd.docker.container.image.v1+json'}, 'Unknown config type')
            check(isinstance(m.get('layers'), list), 'Missing layers')
            for layer in m['layers']:
                descriptor(layer)
        if 'subject' in m:
            subject = descriptor(m['subject'])
            check(subject in inv, 'Missing subject dependency')
            check(m['subject']['mediaType'] == manifests[subject].get('mediaType'), 'Subject media type mismatch')
            if is_attestation:
                check(subject != d and m['subject']['mediaType'] == 'application/vnd.oci.image.manifest.v1+json', 'Invalid BuildKit subject')
                check('artifactType' not in manifests[subject], 'BuildKit subject must be an image, not an artifact')
            edges[subject].add(d)
            edges[d].add(subject)
            incoming.add(d)
    # Index links must be a DAG; subject/attestation retention links are intentionally bidirectional.
    visiting, visited = set(), set()
    def visit(node):
        check(node not in visiting, 'Cyclic index dependency')
        if node in visited:
            return
        visiting.add(node)
        for child in index_edges[node]:
            visit(child)
        visiting.remove(node)
        visited.add(node)
    for node in inv:
        visit(node)
    roots = {d for d, v in inv.items() if v['tags'] and d not in incoming}
    check(roots, 'No classified release roots')
    check(not any(inv[d]['tags'] for d in incoming), 'Tagged dependency is ambiguous')
    groups = {r: closure({r}, edges) for r in roots}
    classified = set().union(*groups.values())
    check(classified == set(inv), 'Ambiguous orphan manifests: no candidate plan emitted')
    return edges, groups

def closure(seeds, edges):
    seen, todo = set(), list(seeds)
    while todo:
        d = todo.pop()
        if d not in seen:
            seen.add(d)
            todo.extend(edges[d] - seen)
    return seen

def plan(rows, manifests, protection, repo, now, final_rows):
    protected = protected_input(protection, repo, now)
    inv = inventory(rows)
    check(inv == inventory(final_rows), 'Inventory changed during scan; retry with fresh snapshot')
    edges, groups = graph(inv, manifests)
    check(protected <= set(groups), 'Protected digest missing or not a release root')
    newest = sorted(groups, key=lambda d: (timestamp(inv[d]['created_at']), d), reverse=True)[:5]
    semantic = {r for r in groups if any(not MACHINE.fullmatch(t) for t in inv[r]['tags'])}
    kept_roots = set(newest) | protected | semantic
    kept = closure(kept_roots, edges)
    candidates = set(inv) - kept
    return {
        'mode': 'DRY_RUN_ONLY', 'package': protection['package'],
        'captured_at': protection['captured_at'], 'snapshot_source': protection['source'],
        'reviewed_at': now.isoformat(), 'root_count': len(groups),
        'newest_five_roots': sorted(newest), 'protected_roots': sorted(protected),
        'semantic_tag_roots': sorted(semantic), 'kept_versions': len(kept),
        'candidate_groups': [{'root': r, 'tags': inv[r]['tags'],
            'exclusive_candidate_versions': [{'digest': d, 'id': inv[d]['id']} for d in sorted(groups[r] & candidates)],
            'shared_kept_dependencies': sorted(groups[r] & kept)}
            for r in sorted(set(groups) - kept_roots)],
        'candidate_versions': [{'digest': d, 'id': inv[d]['id']} for d in sorted(candidates)],
        'warning': 'Review only. Not an executable deletion plan. Revalidation cannot eliminate races after this scan.',
    }

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise Unsafe('Unexpected redirect refused')

class Client:
    def __init__(self, token, actor, package):
        check(bool(token) and bool(actor), 'Existing GITHUB_TOKEN and actor required')
        self.token, self.actor, self.package = token, actor, package
        self.opener = urllib.request.build_opener(NoRedirect())
        self.registry_token = None

    def get(self, url, headers):
        # GET only; no action path can mutate the registry or GitHub.
        check(urllib.parse.urlsplit(url).scheme == 'https' and urllib.parse.urlsplit(url).netloc in {'api.github.com', 'ghcr.io'}, 'Unexpected API origin')
        try:
            with self.opener.open(urllib.request.Request(url, headers=headers, method='GET'), timeout=45) as response:
                body = response.read(16 * 1024 * 1024 + 1)
                check(len(body) <= 16 * 1024 * 1024, 'Oversize API response')
                return body, response.headers
        except urllib.error.HTTPError as error:
            raise Unsafe(f'Authorized read failed (HTTP {error.code}); no access changes attempted') from None
        except (urllib.error.URLError, TimeoutError):
            raise Unsafe('API read failed; no plan emitted') from None

    def versions(self):
        base = f'https://api.github.com/users/kasumil/packages/container/{self.package}/versions'
        result, seen = [], set()
        for page in range(1, 10001):
            raw, headers = self.get(f'{base}?per_page=100&page={page}', {'Authorization': 'Bearer ' + self.token, 'Accept': 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28'})
            rows = json.loads(raw)
            check(isinstance(rows, list), 'Invalid versions response')
            for row in rows:
                ident = row.get('id') if isinstance(row, dict) else None
                check(type(ident) is int and ident not in seen, 'Pagination repeated a version')
                seen.add(ident)
            result.extend(rows)
            has_next = 'rel="next"' in headers.get('Link', '')
            if len(rows) < 100:
                check(not has_next, 'Incomplete pagination page')
                return result
            # Even without Link, request the next numeric page to confirm exhaustion.
        raise Unsafe('Pagination limit exceeded')

    def manifests(self, inv):
        basic = base64.b64encode((self.actor + ':' + self.token).encode()).decode()
        scope = urllib.parse.urlencode({'service': 'ghcr.io', 'scope': f'repository:kasumil/{self.package}:pull'})
        raw, _ = self.get('https://ghcr.io/token?' + scope, {'Authorization': 'Basic ' + basic})
        self.registry_token = json.loads(raw).get('token')
        check(isinstance(self.registry_token, str) and self.registry_token, 'Registry pull authorization unavailable')
        result, sizes = {}, {}
        for d in sorted(inv):
            raw, headers = self.get(f'https://ghcr.io/v2/kasumil/{self.package}/manifests/{d}', {'Authorization': 'Bearer ' + self.registry_token, 'Accept': ', '.join(sorted(INDEX | MANIFEST))})
            check('sha256:' + hashlib.sha256(raw).hexdigest() == d, 'Manifest content digest mismatch')
            check(headers.get('Docker-Content-Digest', d) == d, 'Manifest digest header mismatch')
            result[d] = json.loads(raw)
            sizes[d] = len(raw)
        # Validate descriptor sizes against exact fetched bytes in a separate scan below.
        for m in result.values():
            for child in m.get('manifests', []):
                check(child.get('digest') in result, 'Missing manifest dependency')
                check(child.get('size') == sizes[child['digest']], 'Manifest descriptor size mismatch')
            if 'subject' in m:
                subject = m['subject']
                check(subject.get('digest') in sizes, 'Missing subject dependency')
                check(subject.get('size') == sizes[subject['digest']], 'Subject descriptor size mismatch')
        return result

def main():
    repo = os.environ.get('GITHUB_REPOSITORY', '')
    check(repo in MAPPING, 'Repository not allowed')
    protection = json.loads(os.environ.get('PROTECTION_JSON', ''))
    protected_input(protection, repo, dt.datetime.now(dt.timezone.utc))
    client = Client(os.environ.get('GITHUB_TOKEN', ''), os.environ.get('GITHUB_ACTOR', ''), MAPPING[repo])
    before = client.versions()
    manifests = client.manifests(inventory(before))
    after = client.versions()
    result = plan(before, manifests, protection, repo, dt.datetime.now(dt.timezone.utc), after)
    print(json.dumps(result, indent=2))

if __name__ == '__main__':
    try:
        main()
    except (Unsafe, ValueError, TypeError, KeyError, AttributeError) as error:
        # Never include raw responses or credential-bearing exception strings.
        print('BLOCKED: ' + (str(error) if isinstance(error, Unsafe) else 'Malformed input or API data'), file=sys.stderr)
        sys.exit(1)
