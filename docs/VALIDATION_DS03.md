# DS-09 and DS-11 Validation Report

**Version:** `0.3.0-alpha.1`  
**Scope:** Production-code-computed histogram, cumulative-frequency ogive and Type-7/Tukey box plot; safe summary/frequency/ogive/boxplot CSV; JSON reproducibility manifest; three SVG chart exports.

## Verifications performed

- TypeScript 5.8.3 `npm run typecheck`: PASS.
- Node.js 22.16.0 `npm run validate`: **53/53 tests PASS**, 0 failed.
  - Inherited 43 numeric/CSV tests preserved unchanged.
  - 10 new tests validate export round trips, RFC-style quoting, formula-injection prefixes, safe filenames, data-quality reconciliation, manifest determinism, constant values, missing values and 1.5-IQR conventions.
- Original 17/17 NumPy reference datasets remain included. Reverification should be run separately with `npm run test:oracle` where NumPy is installed.
- Chromium desktop 1440×940 and mobile 390×844 checks: **PASS in an asset-inlined in-memory HTML/ES-module harness**.
  - Verifies three accessible SVG graph elements, tables, histogram regrouping, all eight downloads, JSON report data, no unexpected JavaScript errors, no captured network requests, column switching, duplicate labels and malformed CSV recovery.
  - Captures `docs/previews/v03-desktop.png` and `docs/previews/v03-mobile.png`.

## Important environment restriction

The execution environment blocked Chromium navigation to local HTTP and `file://` (`ERR_BLOCKED_BY_ADMINISTRATOR`). The browser was therefore loaded through an in-memory asset-inlined harness which **does not test deployed HTTP response headers, the page's Content-Security-Policy metadata or the secure-context SHA-256 branch**. The harness correctly reports `sha256:null` when `crypto.subtle` is unavailable. Source digest and downloading SVGs should be retested from `http://localhost` or HTTPS by an authorized normal browser before release.

## Release gates still open

- Install cleanly with an npm lockfile and verify GitHub-hosted CI.
- Verify real HTTP/HTTPS browser operation in Chrome, Firefox and Edge, including CSP and Blob downloads.
- Independent accessibility/WCAG 2.2 audit including screen readers and keyboard operation.
- Real network privacy audit and browser-performance tests for large files.
- Confirm brand/name, licensing and source ownership.
- External usability pilot before public beta and LinkedIn promotional release.

**Decision:** DS-09/DS-11 implementation complete and ready for next internal validation stage. This is **not** a public beta or a certified accessibility/security release.
