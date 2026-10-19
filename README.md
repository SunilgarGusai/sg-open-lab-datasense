# SG Open Lab — DataSense v0.4 Alpha

**Status:** Internal developer alpha, *not* publicly deployed. CSV import, validated single-column descriptive statistics, three statistical charts with table alternatives and local reproducibility exports are implemented. The proposed product name and licensing/IP review are not final.

DataSense aims to make introductory descriptive statistics accessible, transparent and reproducible without a backend or AI dependency. Users can load a local UTF-8 CSV, select a numeric column, inspect missing/invalid values, view population/sample statistics, change histogram group counts, inspect grouped-frequency ogives and a Tukey-style box plot, then explicitly download result artifacts.

## Test on a normal laptop

Requires Node 22+ and Python 3. The continuation ZIP includes compiled JavaScript under `dist/` for use without dependency installation. A Git checkout requires the developer build below first.

```bash
node --test tests/numeric.test.mjs tests/csv.test.mjs tests/reports.test.mjs
python -m http.server 8000 --bind 127.0.0.1
```

Visit **http://localhost:8000/** (not `file://`). Select **Sample scores** for a complete demonstration. For your data, open a UTF-8 `.csv` with one nonblank header row. Dataset limits: 5 MiB, 50,000 data rows, 100 columns.

For developers, use Node 24.19.0 and Python 3.12 (CI pins 3.12.15; the NumPy tools require Python 3.11 or newer), then install the exact locked tools and build:

```bash
npm ci --ignore-scripts
npm run validate
node scripts/verify-baseline.mjs
python -m pip install --require-hashes -r requirements-ci.txt
npm run test:oracle
node scripts/stage-site.mjs
```

DS-13 supplies a registry-generated lockfile for TypeScript 5.8.3 and axe-core 4.14.0, hashed Python tooling and pinned GitHub Actions. A clean checkout reproduces the staged site file hashes. The current hosted outcomes and limitations are recorded in [DS-13 evidence](docs/RELEASE_READINESS_DS13.md).

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

- **68/68 automated Node tests pass**, including all 53 original numerical/import/export tests and 15 staging tests. Ten protected baseline files retain their original SHA-256 hashes.
- The **17-case independent NumPy oracle passes**. Dependency audit reports zero known vulnerabilities at validation time; both installed packages have verified registry signatures. This does not establish absence of vulnerabilities.
- The new browser runner uses actual HTTP responses, unchanged CSP, downloaded files, three viewport sizes and both root/project subpaths. It checks keyboard table scrolling, axe accessibility, hostile text, malformed-import recovery, SHA-256, network and storage observations. See the linked report for per-engine outcomes and unresolved failures.
- Narrow viewport tests are desktop-engine resize checks, not real mobile-device or assistive-technology certification. Public HTTPS staging and manual accessibility checks remain release gates.
- A 50,000-row, eight-column performance probe passes locally; timings are environment-dependent and do not cover the maximum 100-column workload.

Read the [DS-13 release-readiness audit](docs/RELEASE_READINESS_DS13.md), [DS-13 source security review](docs/SECURITY_REVIEW_DS13.md), [manual release checklist](docs/MANUAL_ACCEPTANCE_CHECKLIST.md) and [status](docs/STATUS.md). The [DS-12 audit](docs/RELEASE_READINESS_DS12.md) and [DS-09/11 validation report](docs/VALIDATION_DS03.md) are historical records.

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

A dedicated **private** [DataSense repository](https://github.com/SunilgarGusai/sg-open-lab-datasense) now contains CI and a manual, disabled-by-default Pages staging workflow. Existing research repositories were not changed. Pages settings currently require an eligible paid plan or a visibility change; no plan or visibility change was made and no site was deployed. `robots.txt`/`noindex` are indexing preferences, not access control.

**Public beta remains NO-GO.** Browser compatibility, actual HTTPS deployment, manual WCAG/assistive-technology review, CSV edge-case hardening, ownership/licensing and an independent pilot remain open. No licence or public-release approval is implied by this package.

For real-origin checks after installing the hashed Python requirements and building `_site`:

```bash
python -m playwright install --with-deps chromium firefox webkit
python scripts/real_origin_smoke.py --browser chromium --site-root _site --output evidence/local-chromium
```

Repeat with `firefox` and `webkit` and a new output directory for each run. Existing evidence is not overwritten. A future approved HTTPS staging URL can be tested using `--url`. The old `release_smoke.py` and `browser_load_probe.py` are historical in-memory checks; `performance_probe.mjs` is a bounded Node performance probe.

See [CONTRIBUTING.md](CONTRIBUTING.md) and [SECURITY.md](SECURITY.md) for participation and security notes.
