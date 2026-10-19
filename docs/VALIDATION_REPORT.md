# DataSense foundation — verification record

**Document:** SGOL-DS-QA-001  
**Build:** `0.1.0-alpha.1`  
**Scope:** mathematical core and local developer artifacts only  
**Date:** 19 October 2026

## Executed checks

| Check | Result | Evidence |
|---|---|---|
| Strict TypeScript type checking | PASS | `tsc --noEmit -p tsconfig.json` |
| Compile TypeScript to ESM | PASS | `tsc -p tsconfig.json` |
| Node automated regression tests | **29 passed, 0 failed** | `node --test tests/*.test.mjs` |
| Independent NumPy oracle regeneration | **17 fixtures verified** | `python scripts/generate_numpy_oracle.py --verify`, NumPy 2.3.5 |
| Deterministic frequency property checks | PASS | 200 seeded randomized arrays, exact bin membership |
| 50,000-row numeric computational smoke test | PASS | `summarize()` and `buildFrequency()` |
| Offline numeric sample execution | PASS | `node scripts/demo.mjs` |

All checks were run locally with Node 22.16.0, TypeScript 5.8.3 and Python 3.13.5/NumPy 2.3.5. This is NOT a cross-browser performance benchmark.

## Planned 44-case matrix coverage

**28 case identifiers have at least one numerical/unit-level assertion:** `DS-T001`–`DS-T016`, `DS-T026`–`DS-T031`, `DS-T039`–`DS-T044`.

**16 case identifiers are still pending end-to-end verification:** `DS-T017`–`DS-T025` (CSV file import and file-limit handling), `DS-T032`–`DS-T038` (privacy, export security, HTML injection, accessibility, chart alternatives, manifests, export precision).

Some implemented cases share one automated test; the count of 29 executed tests is **not** the count of matrix cases. `DS-T017`'s textual numeric ambiguity is partially checked, but CSV-file-level verification is pending and it is not counted as passed.

## Correctness conventions

- Type 7 quantiles, as specified in the frozen product requirements.
- Welford-style offset-stabilized variance computation; both sample and population formulas.
- Missing tokens and invalid strings are tracked separately.
- Constant data produces one nonzero-width histogram bin; all valid observations counted.
- The last frequency bin is right-inclusive, earlier bins are right-exclusive.
- Less-than ogive starts at zero cumulative frequency.
- Outliers use observed-data whiskers within 1.5×IQR fences.

## Known limitations / required next gates

1. **CSV file parser not yet built.** No UTF-8 BOM, malformed-quote or file-size tests have been executed.
2. **No browser interface.** Keyboard, screen-reader, responsive and graphical chart audits remain pending.
3. **No exports.** CSV formula-injection prevention, manifest schema and export precision are pending.
4. **No browser network inspection.** Do not claim uploaded datasets never leave a future app before completing network tests.
5. **Dependency lockfile missing.** The build environment could not resolve `registry.npmjs.org`. TypeScript was available globally. Once npm registry access is available, generate and commit `package-lock.json`, change CI to `npm ci`, and verify CI on GitHub.
6. **Not publicly released.** No GitHub repository has been created and the name and IP/license review have not passed.
7. **Floating-point limits.** Binary64 cannot represent arbitrary precision, and extreme finite values can lead to unavailable statistics or unrepresentable histogram intervals; this will need user-facing warnings.

## Recommended next milestone

**DS-06 / DS-07: CSV file parser and column quality contract.** Implement Papa Parse integration (or equivalent strict CSV parser), duplicate-header mapping, selected-column validation, and hard input limits; then pass `DS-T017`–`DS-T025`. Only then start the first usable browser UI.
