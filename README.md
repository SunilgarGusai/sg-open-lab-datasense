# SG Open Lab — DataSense v0.4.1 Alpha

**Status:** Ready-to-run internal alpha `0.4.1-alpha.1`, *not* publicly deployed. CSV import, validated single-column descriptive statistics, three statistical charts with table alternatives and local reproducibility exports are implemented. The proposed product name and licensing/IP review are not final.

DataSense aims to make introductory descriptive statistics accessible, transparent and reproducible without a backend or AI dependency. Users can load a local UTF-8 CSV, select a numeric column, inspect missing/invalid values, view population/sample statistics, change histogram group counts, inspect grouped-frequency ogives and a Tukey-style box plot, then explicitly download result artifacts.

## Use the prepared runtime package

Extract the runtime ZIP and double-click **Start DataSense.cmd** on Windows.
**Stop DataSense.cmd** closes only its local server. The launcher uses Node.js
22+ from PATH or this machine's existing Codex runtime. The prepared package
requires no npm or Python installation. On another machine install Node first.
See [Start here](START_HERE.md).

On macOS/Linux or for manual startup:

```sh
node scripts/serve.mjs
```

Open http://127.0.0.1:8765/. The server verifies the staged bytes, binds to
loopback, and serves only the built app with security headers. See
[deployment and rollback](docs/DEPLOYMENT.md) for HTTPS and project subpaths.

## Developer build

Use Node 24.19.0 and Python 3.12; CI pins Python 3.12.15.

```sh
npm ci --ignore-scripts
npm run validate
node scripts/verify-baseline.mjs
python -m pip install --require-hashes -r requirements-ci.txt
npm run test:oracle
npm run package:runtime
```

`_site/` is the minimal static website. `_runtime/` also includes the server,
Windows launch/stop scripts and deployment instructions. Neither contains
source tests, research evidence, credentials or developer dependencies.

## Mathematical definitions

- Type-7 linear-interpolation quartiles/percentiles.
- Population and sample Welford-based variance (`n` and `n-1` divisors).
- Exact frequency reconciliation across equal-width bins, with the last upper endpoint included.
- Less-than ogive from grouped cumulative frequencies.
- Tukey-style 1.5×IQR outlier fences with whiskers at observed in-fence extrema.
- Missing and invalid values are counted separately and never converted silently to zero.

See [statistical methods](docs/STATISTICAL_METHODS.md) and [CSV import policy](docs/CSV_IMPORT_POLICY.md) for caveats.

## Step-by-step educational calculations (DS-16 review candidate)

After loading a numeric column, expand **Show the calculation** to inspect the mean, median, Type-7 first/third quartiles, population/sample variance, or a grouped-frequency reconciliation. The display uses the existing validated numerical summaries and deliberately limits raw-value examples on larger datasets. Teaching examples explain the chosen mathematical convention; the explanatory text does not replace the numerical engine.

The source code and tests are in `src/education/explain.ts` and `tests/explanations.test.mjs`. See [DS-15/16 review gates](docs/RELEASE_REVIEW_DS15_DS16.md). This feature is under pull-request review and is not a public-beta announcement.

## Eight downloadable artifacts

Summary CSV, grouped-frequency CSV, ogive CSV, boxplot CSV, JSON reproducibility manifest, and histogram/ogive/box-plot SVGs. Reports contain derived figures and statistical output, **including numerical outlier values**, but do not copy entire rows. Inspect files before sharing and read the [export policy](docs/EXPORT_POLICY.md) for formula-safety precautions and the optional SHA-256 behavior.

## Validation evidence

DS-14 adds seven CSV hardening tests and nine real HTTP server tests. The local
suite passes **84/84 tests** including all 53 original tests. The mathematical
engine, contracts, original tests and frozen oracle retain their protected
hashes; the independent **17-case NumPy oracle passes**.

The duplicate-label, delayed-width-rejection and untrusted byte-count findings
from DS-13 are fixed. Focus contrast and narrow-screen chart readability are
improved. Additional evidence covers real Edge navigation, bounded large-file
workloads, Excel formula-prefix imports, TLS trust/hostname validation and the
Windows launch/reopen/stop flow. See [DS-14 readiness](docs/RELEASE_READINESS_DS14.md)
for scope, exact evidence and remaining gates.

Hosted CI builds from the locked dependencies, runs the original three-engine
real-origin suite, tests the shipped Node server, checks TLS and packages a
runtime artifact only after validation. An intended release must have its own
passing CI run; previous-release evidence is not a substitute.

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

## Release scope

The owner authorized making the dedicated
[source repository](https://github.com/SunilgarGusai/sg-open-lab-datasense) public
and enabling a [GitHub Pages alpha preview](https://sunilgargusai.github.io/sg-open-lab-datasense/)
on 2026-10-20. Existing research repositories and the original v0.4.0 archive
were preserved. The manual deployment workflow validates the built artifact,
deploys it, then verifies every HTTPS file and runs three-engine browser checks.
Consult its latest completed run for deployment status.

This is a usable internal alpha and deployment package. Public beta is not
announced. Actual public HTTPS acceptance is recorded by the Pages workflow.
Current WebKit/real Safari, real assistive technology/device checks,
an independent pilot and owner decisions about licensing/branding remain
outside the local acceptance claim. See [third-party inventory](THIRD_PARTY_NOTICES.md)
and [release gates](docs/RELEASE_READINESS_DS14.md).

For browser acceptance against an actual deployment:

```sh
python scripts/real_origin_smoke.py --browser chromium --site-root _site \
  --url https://your-approved-host.example/ --output evidence/deployment-chromium
```

Repeat with Firefox/WebKit and new evidence directories. Preserve the unchanged
CSP, actual response bytes, downloads and recorded limitations.
