# Security policy (non-public development phase)

This is a local development handoff, not a deployed service. Do not submit real personal datasets in issue reports. Use synthetic examples. Security reports should initially be shared privately with the maintainer. A public vulnerability contact policy will be established before release.

## v0.4 downloadable-result handling

Spreadsheet text in export CSVs is prefixed when it resembles a formula, but this is only mitigation, not a guarantee across spreadsheet implementations. Numeric outliers and the source filename can appear in derived export files. Review output content before sharing. The app itself creates in-browser Blob downloads rather than uploading source records. A real deployed-origin CSP and network/privacy audit is required before making broader security claims.

DS-13 adds real loopback HTTP checks in hosted CI, saved-download verification and bounded network/storage observations. See [DS-13 evidence and browser limitations](docs/RELEASE_READINESS_DS13.md) and the [source review with three open CSV findings](docs/SECURITY_REVIEW_DS13.md). **The actual public HTTPS deployment, manual security review and broader privacy claims remain unverified.** The DS-12 in-memory audit remains a historical record.
