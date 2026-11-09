# Exact-branch GHCR dry-run publication variant

This separate copy leaves the original manual-only draft unchanged. It has not been published by its preparer.

Publish these three reviewed files only to `ghcr-retention-dry-run-review`, together with a newly captured, package-scoped `.github/retention-protection.json` prepared by the coordinator:

- `.github/workflows/ghcr-retention-dry-run.yml`
- `.github/retention/ghcr_retention.py`
- `tests/ghcr_retention/test_retention.py`

No protection JSON is included here: historical digests must not be reused as a fresh snapshot. The script retains the 15-minute before/after freshness checks and existing protection schema. Read the original draft README for the complete policy and known limits.

The workflow triggers on pushes to exactly `ghcr-retention-dry-run-review` or manual dispatch, and its job additionally requires that exact branch ref and one of those two event types. No main/master event, pull request, schedule, build, deployment, package mutation, or permission expansion is added. Contents/packages are read only. A manual dispatch input, if nonempty, takes precedence. Otherwise Bash reads the committed JSON into an exported environment variable using quoted command substitution, with no eval, execution of file contents, or GitHub-expression interpolation into the executable shell.

Important: this workflow cannot prevent other preexisting repository workflows from triggering on the same push. Before publishing, independently inspect every existing workflow, reusable-workflow caller, and any external branch automation. Do not publish until the coordinator establishes that the exact branch push will not build or deploy. Do not merge this branch as part of this dry run.

Run the isolated tests from this directory:

    python3 -B -m unittest discover -s tests/ghcr_retention -v

The branch trigger addresses first-run availability without default-branch workflow publication. Existing manual-dispatch availability may depend on GitHub's default-branch rules, so use the authorized exact-branch push rather than broadening triggers.
