# SG DataSense — DS-06/DS-07 execution and evidence summary

**Version:** 0.2.0-alpha.1  
**State:** Local developer alpha; no GitHub deployment

## Completed

1. UTF-8 CSV parser with BOM, quoted commas/fields, escaped quotes and embedded newlines.
2. Strict rejection of malformed quoting, unequal field counts, empty/blank headers and invalid UTF-8.
3. Limits enforced: 5 MiB, 50,000 data rows and 100 columns.
4. Duplicate-header warnings and stable column IDs.
5. Numeric column eligibility and valid/missing/invalid classification.
6. Responsive in-browser interface: local file chooser, two synthetic dataset buttons, column selector, numeric quality/stats cards, grouped frequency table, preliminary bar visualization and preview of the first ten rows.
7. File-error handling that clears stale statistical results.

## Evidence from this execution

- `npm run validate`: **43 passed, 0 failed**, includes 14 new CSV/integration checks plus pre-existing numeric tests.
- `python scripts/generate_numpy_oracle.py --verify`: **17 oracle cases verified**.
- Browser smoke (headless Chromium): sample mean 23.4; CSV with repeated header imported; switching to third column gave mean 15 with one invalid observation; malformed quote generated an actionable error and hid previous analysis; 390-pixel mobile view rendered results; no page JavaScript errors.
- Browser tests used `page.set_content` with locally compiled ES modules embedded into `data:` URLs, since navigations to `127.0.0.1` and `file://` were blocked by the environment. The test bypassed the original content-security-policy tag, so it does not verify HTTP delivery, deployment CSP, or privacy on a real host.
- Screenshot images are separately retained in the deliverable directory.

## Named validation-matrix items newly exercised

DS-T017, T018, T019, T020, T021, T022, T023, T024, T025 and T039. Repeatability and frequency integration were exercised as well. The current **43 Node test cases are not the same as 43 passed items from the original 44-item acceptance matrix**; export, full charts, security, privacy and accessibility items remain pending.

## Outstanding release blockers

- Browser rendering test under a real local HTTP server / hosted GitHub Pages, production CSP check and network audit.
- Keyboard-only workflow audit, WCAG and mobile interaction pass across mainstream browsers.
- Real SVG/PNG histogram/boxplot/ogive outputs and accessible table equivalents.
- Summary CSV, frequency CSV, JSON reproducibility manifest and CSV formula-injection checks.
- npm lockfile and GitHub Actions CI, licensing and final project-name review.
- External pilot and public demo/release.

## Reproduction

Run precompiled tests with `npm run test:precompiled`. With Python 3 present, serve the extracted directory using `python -m http.server 8000` and visit `http://localhost:8000/`. The build uses standard ES modules and does not need any backend service.
