# Security policy (non-public development phase)

This is a local development handoff, not a deployed service. Do not submit real personal datasets in issue reports. Use synthetic examples. Security reports should initially be shared privately with the maintainer. A public vulnerability contact policy will be established before release.

## v0.4 downloadable-result handling

Spreadsheet text in export CSVs is prefixed when it resembles a formula, but this is only mitigation, not a guarantee across spreadsheet implementations. Numeric outliers and the source filename can appear in derived export files. Review output content before sharing. The app itself creates in-browser Blob downloads rather than uploading source records. A real deployed-origin CSP and network/privacy audit is required before making broader security claims.

The DS-12 audit includes text-only rendering and no captured external network requests in an in-memory browser harness, but **hosted CSP enforcement and privacy claims remain unverified**. See `docs/RELEASE_READINESS_DS12.md`.
