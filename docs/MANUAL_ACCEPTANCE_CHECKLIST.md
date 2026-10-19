# DataSense release acceptance checklist — perform on an authorized desktop/mobile browser

Record date, OS, browser version, test dataset, screenshots/logs and pass/fail notes. Do not upload personal/institutional CSV data to support tickets or screenshots.

## 1. Clean install and CI

- [ ] Install Node.js 22+, run `npm install --package-lock-only --ignore-scripts` while registry is accessible; review and commit the genuine `package-lock.json`.
- [ ] Use `npm ci --ignore-scripts` in CI; `npm run validate` and `npm run test:oracle` pass in a clean checkout.
- [ ] Confirm GitHub workflow status, minimum permissions, source attribution and licence.

## 2. Real HTTP/HTTPS browser

- [ ] Start `python -m http.server 8000` in project root and open `http://localhost:8000/` (not `file://`).
- [ ] Repeat on published staging HTTPS, Chrome, Firefox, Edge and at least one actual mobile browser.
- [ ] Load `Sample scores` and verify 10 valid observations, all three labelled SVGs and four captioned data tables.
- [ ] Change histogram groups from auto to five and compare frequency totals and final ogive cumulative to valid count.
- [ ] Import a legitimate multi-column CSV with missing values and duplicate headers; select distinct numeric columns.
- [ ] Import malformed CSV, confirm stale results and exports vanish; reselect a corrected file with the same name.
- [ ] Download and inspect all eight exports. Confirm SVGs open and JSON schema/value counts are consistent.
- [ ] Confirm source SHA-256 appears in JSON from a secure origin, and matches local `sha256sum` / Windows `Get-FileHash` for the same original CSV bytes.

## 3. Browser security and privacy

- [ ] Open browser DevTools Network, disable cache, reload and import **synthetic** CSV. Verify only expected same-origin static assets are requested and no uploaded file contents leave the browser; inspect actual request bodies.
- [ ] Verify the page's CSP in the browser and test Blob CSV, JSON and SVG download flows.
- [ ] Verify CSV formula-prefix strings remain inert when an exported file is imported by the intended spreadsheet applications; do not assume universal protection.
- [ ] Recheck how source filename, numerical outliers and SHA-256 appear in exports; warn users to inspect before sharing.
- [ ] Record dependency and brand/IP review before publishing.

## 4. Accessibility / usability

- [ ] Keyboard-only: Tab to skip link, Enter to main, file input, sample buttons, selects, details and all eight export buttons; visible focus and logical order.
- [ ] Screen reader (NVDA/VoiceOver): hear field labels, errors, busy announcements, chart titles/descriptions and table captions/header association.
- [ ] Zoom to 200% and 400%; inspect both 320px and 390px widths; tables scroll within their own region instead of forcing whole-page horizontal scrolling.
- [ ] Audit contrast, Windows high-contrast mode and enlarged text; inspect chart colour and textual alternatives.
- [ ] Repeat critical workflows on a slower device with a near-limit CSV; verify feedback during calculation and absence of a persistent hang.
- [ ] Run automated WCAG tests (e.g. axe) where available, then manually assess remaining WCAG 2.2 criteria; no single automated run guarantees compliance.

## 5. Pilot and communication

- [ ] At least 15 voluntary testers across students, educators and independent users try upload→understand→export.
- [ ] Track user confusion on Type 7 quartiles, variance denominator, histogram bin definitions and boxplot outliers; revise docs where necessary.
- [ ] Only after release gates pass, update GitHub Topics, README hero/demo, contributor guidelines, tagged release and LinkedIn demonstration.
