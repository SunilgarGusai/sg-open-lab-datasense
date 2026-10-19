# DS-13 source security and privacy review

Review date: 2026-10-20. Application version: `0.4.0-alpha.1`.

## Decision and scope

No critical source-level security blocker was identified for DS-13 repository, CI and staging infrastructure work. This limited review does **not** approve a public beta or certify security, privacy, accessibility or spreadsheet compatibility. Three confirmed CSV findings remain open below. Application code and the original mathematical core and tests were preserved during this review.

The review inspected `index.html`, browser rendering and download code, chart construction, CSV import and export code, associated policies, and existing test coverage. Small, read-only Node 24.19.0 probes imported the supplied compiled modules from `dist/index.js`. No browser was run as part of this review. No hosted-origin behavior, deployed headers, actual outgoing browser requests, browser storage, spreadsheet execution or assistive technology was tested. Browser and infrastructure verification performed separately must retain its own evidence and scope.

## Verified source observations

- CSV headers, fields, filenames and status messages enter the DOM through `textContent`. Chart titles and descriptions also use `textContent`; SVG elements and attribute names are constructed by application code. No `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `eval` or `new Function` sink was found in `src`.
- No `fetch`, `XMLHttpRequest`, `WebSocket`, `sendBeacon`, cookie, local/session storage, IndexedDB or service-worker call was found in `src`. This supports a source-level observation about the reviewed app, not a deployed-origin network or privacy guarantee.
- The CSP meta element at `index.html:7` restricts scripts and styles to the same origin and disables objects, base URLs and form actions. `connect-src 'self'` permits same-origin connections; the policy does not itself guarantee absence of data transmission. Its enforcement was not tested here.
- Browser imports check actual file size before reading; `parseCsvBytes` checks actual bytes before fatal UTF-8 decoding. The normal browser import path is protected against the API bypass described in DS13-S03.
- Downloads use in-browser Blob URLs. Filenames combine fixed text with normalized ASCII slugs bounded to 45 characters per component. Paths and control characters do not survive filename normalization.
- Exported untrusted CSV text receives formula-prefix mitigation and CSV quote escaping. Source filename and numerical outlier disclosure are acknowledged by the UI and export policy. Full original rows and unselected columns are not copied into reports. Spreadsheet safety across importers was not verified.

## Open findings

### DS13-S01 — Colliding generated column labels

**Severity:** P2, data integrity and usability. **Status:** Confirmed, not fixed.

**Location:** `src/import/csv.ts:103-106`; labels are displayed by `src/app/browser.ts:135-136`.

Header deduplication counts the original names but does not reserve every resulting display label. The valid CSV below produces two identical `score (2)` display labels:

```csv
score,score (2),score
1,2,3
```

Observed Node result:

```text
column-0 -> score
column-1 -> score (2)
column-2 -> score (2)
```

All three columns have one numeric observation, so the last two dropdown options also have identical visible numeric counts. Internal index-derived IDs remain distinct, but users cannot distinguish those two choices by their displayed labels. Reports use the same ambiguous selection label.

**Recommended correction:** Allocate globally unique display labels while preserving the original header and index-derived ID. Cover collisions between original names and generated suffixes.

**Release gate:** Does not block DS-13 infrastructure staging. Fix before a pilot that accepts arbitrary user CSV headers, or explicitly constrain the pilot data until resolved.

### DS13-S02 — Overwide rows allocate before the column guard

**Severity:** P2, availability hardening. **Status:** Confirmed delayed rejection; browser impact unmeasured.

**Location:** `src/import/csv.ts:53-62` and `src/import/csv.ts:78`.

Each delimiter appends another field. The 100-column header check and data-row width check run only when the entire row is committed. A malformed file below the byte cap can therefore allocate far more than 100 fields before rejection.

Reproducible input:

```js
parseCsvText(','.repeat(1_000_000));
```

The local Node probe rejected this input with `COLUMN_LIMIT` after approximately 17 ms and a measured heap increase of 31 MiB. These are one-process observations, affected by allocation and garbage collection; they are not browser performance predictions. A browser freeze was not demonstrated. The 5 MiB cap bounds total source bytes but still allows a larger delimiter-only case.

**Recommended correction:** Enforce the header column limit and expected data-row width while committing fields, before accumulating an overwide row. Verify rejection and responsiveness with malformed near-limit input.

**Release gate:** Does not block DS-13 infrastructure staging. Resolve or demonstrate acceptable resource behavior before a pilot accepts untrusted CSV files on slower devices. Existing 50,000-row by eight-column numeric performance evidence does not cover this case or the full supported 100-column workload.

### DS13-S03 — Caller-supplied byte length bypasses the text API cap

**Severity:** P3, exported API contract. **Status:** Confirmed, not fixed.

**Location:** `src/import/csv.ts:41-43`.

`parseCsvText` trusts its optional `byteLength` argument rather than validating the size of the supplied string. A caller can make a source exceeding the documented limit appear small:

```js
const source = 'value\n' + '1'.repeat(5 * 1024 * 1024);
parseCsvText(source, 1);
```

Observed result: the 5,242,886-byte source was accepted with a reported byte length of 1. This is a parser-contract bypass, not demonstrated file-upload exploitation. The browser uses `parseCsvBytes`, which checks the actual byte array length first, and the file handler also checks the actual file size.

**Recommended correction:** Keep a trusted byte-count optimization private or validate caller-supplied lengths at the public API boundary. Preserve accurate original-byte accounting for the byte-oriented import path.

**Release gate:** Does not block the current browser staging path. Fix before treating the text parser as a supported API for untrusted inputs or introducing callers that supply unverified length metadata.

## Reproducing the focused Node probes

From the repository root, run the following JavaScript with Node in module mode. It reads existing compiled modules and prints results without changing project files. Compile with the normal project workflow first if `dist` no longer matches the source being reviewed.

```js
import { parseCsvText } from './dist/index.js';

const labels = parseCsvText('score,score (2),score\n1,2,3\n');
console.log(labels.headers.map(({ id, display }) => ({ id, display })));

const oversized = 'value\n' + '1'.repeat(5 * 1024 * 1024);
console.log({ actualBytes: Buffer.byteLength(oversized),
  reportedBytes: parseCsvText(oversized, 1).byteLength });

const before = process.memoryUsage().heapUsed;
const started = performance.now();
try {
  parseCsvText(','.repeat(1_000_000));
} catch (error) {
  console.log({ code: error.code,
    elapsedMs: Math.round(performance.now() - started),
    heapIncreaseMiB: Math.round((process.memoryUsage().heapUsed - before) / 1048576) });
}
```

## Outstanding verification

Hosted CSP enforcement, HTTPS asset loading, real-origin Blob downloads and SHA-256, unintended network requests, browser storage behavior, spreadsheet formula handling and accessibility require separate checks. The existing in-memory browser harness strips the page CSP and cannot establish those properties. No critical workflows or original automated tests were rerun by this narrowly scoped source review. Follow the [manual acceptance checklist](MANUAL_ACCEPTANCE_CHECKLIST.md) and retain later browser findings separately from this document.
