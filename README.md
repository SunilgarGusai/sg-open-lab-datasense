# SG Open Lab — DataSense v0.4 Alpha

**Status:** Internal developer alpha, *not* publicly deployed. CSV import, validated single-column descriptive statistics, three statistical charts with table alternatives and local reproducibility exports are implemented. The proposed product name and licensing/IP review are not final.

DataSense aims to make introductory descriptive statistics accessible, transparent and reproducible without a backend or AI dependency. Users can load a local UTF-8 CSV, select a numeric column, inspect missing/invalid values, view population/sample statistics, change histogram group counts, inspect grouped-frequency ogives and a Tukey-style box plot, then explicitly download result artifacts.

## Test on a normal laptop

Requires Node 22+ and Python 3. Included compiled JavaScript under `dist/` allows use without npm installation.

```bash
npm run test:precompiled
python -m http.server 8000
```

Visit **http://localhost:8000/** (not `file://`). Select **Sample scores** for a complete demonstration. For your data, open a UTF-8 `.csv` with one nonblank header row. Dataset limits: 5 MiB, 50,000 data rows, 100 columns.

For developers with TypeScript 5.8.3 available:

```bash
npm run validate
npm run test:oracle
```

If downloading compiler dependencies, confirm an official lockfile first. The original environment could not access the npm registry; GitHub-hosted CI remains unverified.

## Mathematical definitions

- Type-7 linear-interpolation quartiles/percentiles.
- Population and sample Welford-based variance (`n` and `n-1` divisors).
- Exact frequency reconciliation across equal-width bins, with the last upper endpoint included.
- Less-than ogive from grouped cumulative frequencies.
- Tukey-style 1.5×IQR outlier fences with whiskers at observed in-fence extrema.
- Missing and invalid values are counted separately and never converted silently to zero.

See [statistical methods](docs/STATISTICAL_METHODS.md) and [CSV import policy](docs/CSV_IMPORT_POLICY.md) for caveats.

## Eight downloadable artifacts

Summary CSV, grouped-frequency CSV, ogive CSV, boxplot CSV, JSON reproducibility manifest, and histogram/ogive/box-plot SVGs. Reports contain derived figures and statistical output, **including numerical outlier values**, but do not copy entire rows. Inspect files before sharing and read the [export policy](docs/EXPORT_POLICY.md) for formula-safety precautions and the optional SHA-256 behavior.

## Validation evidence

- **53/53 automated tests passed**; 10 new export-specific tests added to the previous 43.
- Desktop and 390px/320px mobile-size Chromium interaction tests pass in an **in-memory asset-inlined harness**, covering keyboard navigation, accessibility labels, all eight downloads, text-only HTML rendering and malformed-import recovery.
- Real local HTTP browser navigation was blocked by the build environment's administrator, so production-origin HTTPS/CSP/download verification has not been conducted. A complete browser/accessibility/privacy audit is still required.
- The 17-case independent NumPy reference oracle was rerun and passed. A 50,000-row, eight-column performance probe also passed locally; timings are environment-dependent.

Read the [DS-12 release-readiness audit](docs/RELEASE_READINESS_DS12.md), [manual release checklist](docs/MANUAL_ACCEPTANCE_CHECKLIST.md), historical [DS-09/11 validation report](docs/VALIDATION_DS03.md) and [status](docs/STATUS.md).

## Project architecture

```text
src/core/             mathematical engine
src/domain/           typed mathematical contracts
src/import/csv.ts     bounded UTF-8 CSV import and column diagnostics
src/export/report.ts  spreadsheet-safe CSV, JSON manifest and filenames
src/app/charts.ts     SVG chart geometry and accessible labels
src/app/browser.ts    no-upload interactive browser app
index.html            front-end entry and CSP
styles.css            responsive styling
public/examples/      synthetic datasets
scripts/              NumPy reference oracle, demos and Chromium smoke tests
tests/                numeric + import + export tests
dist/                 compiled ES modules for no-install testing
docs/                 method specifications, export policy, validation reports
```

## Public-release status

No GitHub repository has been created or modified for this implementation. **Public beta is explicitly NO-GO** until dependency integrity, real-origin tests, WCAG/manual accessibility, ownership/licensing and pilot testing pass. This alpha is not a public beta, not a certified privacy-sensitive data platform, and not yet appropriate for a LinkedIn launch. Release requires hosted-CI verification, browser/network/accessibility testing, user piloting and ownership/licensing checks.

For scripted local browser verification, run `python scripts/release_smoke.py` (requires Playwright plus Chromium); performance probes are `node scripts/performance_probe.mjs` and `python scripts/browser_load_probe.py`. These do not replace real-origin testing.

See [CONTRIBUTING.md](CONTRIBUTING.md) and [SECURITY.md](SECURITY.md) for participation and security notes.
