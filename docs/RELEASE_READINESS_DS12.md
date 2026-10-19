# DS-12 — Release-readiness audit (19 October 2026)

**Version:** 0.4.0-alpha.1  
**Decision:** **INTERNAL ALPHA PASS; PUBLIC BETA NO-GO.**  
**Origin:** Continuation of the supplied and locally reverified v0.3.0 alpha ZIP. No GitHub repository changed.

## Evidence and audit outcomes

| Gate | Observed result | Status |
|---|---|---|
| TypeScript strict typecheck and compiler build | Local `tsc` 5.8.3 passed | PASS (local) |
| Node mathematical/CSV/export suite | 53/53 passing after DS-12 code changes | PASS (local) |
| NumPy independent reference oracle | 17/17 verified | PASS (local) |
| In-memory Chromium interaction | 1280, 390 and 320px viewports: skip link, dynamic status, charts, captions, CSV errors, 8 exports and no captured network requests | PASS (limited) |
| XSS behavior | HTML-looking CSV cell inserted as text, not an element | PASS (limited) |
| Recovery after malformed CSV | Invalid import clears previous results, sets error alert and resets file selection | PASS (limited) |
| UI CSV workload probe | 50,000 × 8 numeric observations (1,936,357 bytes): one Chromium mobile-size container observation 844 ms to rendered results; no JS errors; column switching works | OBSERVED (not SLA) |
| Node workload probe | 50,000 × 8 numeric observations (2,276,064 bytes) parsed, profiled and summarized; see probe JSON/report for machine-specific times | PASS (local) |
| Real HTTP/HTTPS origin | Local HTTP, `file://`, and route-fulfilled test HTTPS all blocked by environment (`ERR_BLOCKED_BY_ADMINISTRATOR`) | **BLOCKED** |
| Real-origin CSP / Blob exports / SHA-256 | Not testable without normal local HTTP/HTTPS browser navigation | **NOT VERIFIED** |
| Assistive technology and WCAG 2.2 manual audit | Keyboard and static labels checked; NVDA/VoiceOver, zoom/contrast and browser matrix not audited | **OPEN** |
| Clean `npm ci` / immutable dependencies | Registry unreachable (`EAI_AGAIN`); no npm-generated integrity lockfile | **BLOCKED** |
| GitHub Actions | No repo or hosted workflow run yet | **OPEN** |
| Legal/brand/licence | DataSense name, publishing rights, attribution and licence not approved | **OPEN** |
| User pilot and LinkedIn launch | Not performed | **OPEN** |

**Interpretation:** In-memory browsing runs rewritten data-URL modules with the page CSP meta stripped only for the harness. It is useful for behavior and keyboard smoke testing; it **cannot** substantiate production CSP, real-origin security, or client-side privacy promises. Network-absence claims apply only to the harness.

## DS-12 improvements

1. Statistical tables now have visible programmatic captions (frequency, ogive, box plot, CSV preview).
2. Keyboard skip navigation now focuses the main content; unchanged visible focus indicators apply to interactive controls.
3. Error-state announcements use `role="alert"`, normal announcements use `role="status"`, and the workspace marks itself busy while loading.
4. Failed file imports reset the input to allow reselecting the same CSV, and the previous results/exports remain cleared.
5. Reproducible smoke probes and 50,000-row workload probes are included under `scripts/`.
6. No external components or analytics added.

## Release blockers (must clear before publication)

**R1 — Dependency/reproducibility:** On a trusted machine with npm registry access, run `npm install --package-lock-only --ignore-scripts`, inspect the generated lockfile, commit it, replace CI's `npm install` with `npm ci`, and verify a new clean checkout with GitHub Actions. Do not hand-author guessed registry integrity hashes.

**R2 — Real-origin testing:** Serve on localhost or preview HTTPS using regular Chrome, Firefox and Edge; verify all eight downloads, CSP behavior, source SHA-256, changes in selection, no unintended outgoing requests and no console errors. See `MANUAL_ACCEPTANCE_CHECKLIST.md`.

**R3 — Accessibility:** Complete independent keyboard, screen-reader, 200%/400% zoom, contrast, enlarged-text and responsive chart/table testing. Fix discovered issues, then re-run release checks.

**R4 — Legal:** Approve project name, ownership, any institutional intellectual-property concerns, third-party dependency notices and a suitable published licence.

**R5 — Community pilot:** Invite independent student/faculty/data-analysis users, observe the main task from CSV upload to export, and address real usability and mathematical-interpretation problems.

**Public beta decision:** No-go until R1–R5 are resolved. A ZIP for developer testing can be distributed privately without describing it as publicly released software.
