# DS-14: usable, deployable internal alpha

Version: **0.4.1-alpha.1**. Date: 20 October 2026.

This milestone supplies a runtime package and Windows launch/reopen/stop flow.
The app remains an internal alpha. No public-beta or public-website claim is
made. The private source repository and original v0.4.0 archive are preserved.

## Changes

- DS13-S01: generated display labels reserve original names and earlier labels,
  case-insensitively. Original text, column order and index IDs remain intact.
- DS13-S02: an extra delimiter rejects an impossible header/data width before
  consuming another field. Quoted commas and exact-limit files still work.
- DS13-S03: the text API computes UTF-8 length independently and rejects
  mismatched metadata. The byte API preserves original BOM-inclusive length.
- Focus outlines now use a measured 6.76:1 colour against white, replacing
  2.17:1. Input borders are darker. Charts retain 12px labels and have named,
  focusable horizontal-scroll regions instead of shrinking labels to a few pixels.
- The runtime server verifies every published file, serves only that allowlist,
  has no upload endpoint, checks Host headers and adds security response headers.
  It defaults to loopback and supports a subpath or direct TLS.
- The prepared Windows launcher finds Node, starts a hidden local server, opens
  the browser and reuses its instance. Stop checks the recorded process identity.
- CI includes runtime, TLS, large-file/usability checks and an additional browser
  run against the shipped server; its artifact action now uses a pinned Node-24
  release. Pages remains gated and source visibility remains private.

## Local evidence before release commit

The following runs were made from the working tree during implementation.
Their site manifests may name the DS-13 parent commit; they are not represented
as clean release-commit builds. Final CI and package checksums identify the
actual distributed commit separately in the delivered acceptance record.

| Check | Result | Evidence |
| --- | --- | --- |
| Regression reproduction | Five CSV hardening checks failed before the fix; two compatibility checks already passed | [CSV red](../evidence/ds14/csv-red.txt) |
| Typecheck/build/Node tests | 81/81 pass: original 53 + 15 staging + 7 CSV hardening + 6 server | [Validation](../evidence/ds14/validation.txt) |
| Mathematical preservation | All ten protected baseline files unchanged | [Hashes](../evidence/ds14/protected-baseline.txt) |
| NumPy oracle | 17 independent cases pass | [Oracle](../evidence/ds14/numpy-oracle.txt) |
| Dependency installation | Locked installation passes; audit reports zero known vulnerabilities; two registry signatures and one attestation verified | [Install](../evidence/ds14/npm-ci.txt), [audit](../evidence/ds14/npm-audit.json), [signatures](../evidence/ds14/npm-signatures.txt) |
| Edge usability | Nine checks pass after fixing focus/chart readability and waiting for actual asynchronous keyboard scroll | [Edge report](../evidence/ds14/usability-verified/report.json) |
| Excel text-prefix exports | All 12 cases imported with `HasFormula=false`; Excel 16.0 build 20430, Windows | [Excel](../evidence/ds14/excel-prefix-verification.json) |
| Direct TLS | Trusted local test certificate succeeds; untrusted and wrong-hostname certificates reject; HSTS and CSP verified | [TLS](../evidence/ds14/tls.json) |
| Windows launch flow | Start/reopen returned the same loopback URL; Stop closed the owned process | Final package smoke record accompanies delivery |

Edge was 155.0.4283.62 with the locally bundled Playwright 1.62.1. Three bounded
large-file cases used 4x CPU throttling: 5,242,390-byte/100-column numeric data,
5,177,390-byte/100-column missing-invalid data and 50,000 rows by 50 columns.
The final recorded local durations were approximately 11.6, 9.1 and 5.5 seconds,
including file import, UI rendering and last-column selection. An earlier run
was near five seconds per case. These are observations under shared machine
load, not a latency guarantee. CI additionally exercises 50,000 rows by 100
sparse columns. Import/profile work still runs on the browser's main thread.

The colour palette check covers the listed text/graphic combinations, not all
possible rendered intersections. Charts and tables are keyboard scrollable at
320 CSS pixels without page overflow. This is neither a physical mobile-device
test nor a complete assistive-technology or zoom certification. The earlier
failed usability runs remain available; a scroll-timing assertion was corrected
to wait for actual keyboard movement instead of sampling before the browser
processed it.

## Acceptance and external release gates

1. **Exact commit/package:** verify hosted CI for the distributed commit, compare
   the site/runtime artifact hashes, smoke-test a freshly extracted runtime and
   retain raw evidence. The delivered acceptance record closes this gate when
   those checks actually pass.
2. **External HTTPS/access controls:** select an approved hosting destination,
   configure its real domain/certificate and intended access controls, then run
   the deployed-origin suite. Local TLS proves the server's TLS path only.
   GitHub Pages currently requires a plan/hosting decision for this private repo.
3. **Supported platforms:** the pinned three-engine CI suite does not establish
   actual Safari, latest WebKit, real mobile or screen-reader support. The
   DS-13 WebKit native-select upstream issue and screenshot instrumentation
   limitations remain documented in that historical report.
4. **Independent acceptance:** intended learners/educators should complete a
   bounded pilot and review interpretation, error recovery and exports.
5. **Owner decisions:** resolve ownership, distribution licence and branding,
   then approve the public release scope. The dependency inventory is provided;
   no ownership or licence grant is invented.

Local use and deployment preparation are delivered independently of those
external decisions. See [Start here](../START_HERE.md),
[deployment guide](DEPLOYMENT.md) and [third-party inventory](../THIRD_PARTY_NOTICES.md).
