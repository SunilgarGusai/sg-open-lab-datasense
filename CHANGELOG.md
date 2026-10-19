# Changelog

## 0.4.0-alpha.1 — DS-12 limited release-readiness audit

- Accessible captions added to dynamically generated frequency, ogive, box plot and preview tables.
- Skip-link main landmark is explicitly keyboard-focusable; normal/error live announcements and busy state differentiated.
- Invalid file imports clear previous results and reset file picker so the same filename can be selected again.
- Added three-viewport in-memory Chromium keyboard, export, injection and recovery checks; added 50,000-row Node and Chromium workload probes.
- Reran 53 Node tests and 17 NumPy reference cases; both passed.
- Documented unresolved dependency-lockfile, real-origin browser, accessibility, licence and public-beta gates.



## 0.2.0-alpha.1 — CSV and browser integration

- Add bounded strict UTF-8 CSV parser and header normalization, column profiles and actionable file errors.
- Add single-column browser analysis prototype, quality cards, summary statistics, frequency table and preliminary histogram.
- Add 14 CSV and integration automated tests (43 total), plus browser smoke evidence.
- Preserve all previous numeric validation and NumPy oracle checks.
- No public deployment; full visualizations, exports and accessibility release checks deferred.

## 0.1.0-alpha.1 — Numeric foundation

- TypeScript statistics engine, quantitative reference fixtures and initial numeric tests.

## 0.3.0-alpha.1 — DS-09 and DS-11

- Replaced provisional bar-only preview with documented labelled SVG histogram, ogive and box-plot charts, plus exact tabular alternatives.
- Added downloadable safe CSV summaries, class frequencies, ogive points and box-plot diagnostics.
- Added reproducibility JSON manifest, local source SHA-256 where browser secure context permits, and SVG chart downloads.
- Added filename normalization and formula-injection precautions for untrusted spreadsheet text fields.
- Added 10 export-focused tests and real Chromium desktop/mobile in-memory browser interaction/download smoke tests.
- Updated mathematical export policy and recorded remaining external accessibility, npm lockfile and hosted-deployment gates.
