# SG Open Lab — DataSense MVP Product and Engineering Specification

**Document ID:** SGOL-DS-PRD-001  
**Version:** 1.0 — implementation-ready proposal  
**Date:** 19 October 2026  
**Status:** Specification prepared; no production implementation or repository publication performed  
**Product name:** DataSense (working name; public naming/ownership checks pending)  
**Owner/maintainer:** SG Open Lab initiative

## 1. Executive decision

Build a **free, browser-first, single-variable descriptive-statistics learning utility** that accepts CSV files or built-in teaching datasets, calculates reproducible numeric summaries, draws frequency and distribution charts, explains computational methods, and exports a transparent analysis summary. The product competes on mathematical clarity and reliability rather than breadth of techniques. Avoid accounts, AI, cloud backends, and monetization in v0.1.

**North-star job:** “I have a column of numbers; I want accurate descriptive statistics, understandable steps, graphs, and a shareable record of how the numbers were computed.”

**Out of scope:** advanced inferential statistics, predictive modelling, regression, ML, research claims generated automatically, complex Excel import, multivariate dashboards, persistent user accounts, and server-side file processing.

## 2. User segments and representative tasks

| Segment | Typical task | Success condition |
| --- | --- | --- |
| Undergraduate student | Explore course scores, calculate quartiles and draw an ogive | Correct answer, explanation, reproducible table |
| Mathematics/statistics educator | Demonstrate grouping choices and sample/population variance | Transparent formulas, projector-ready graphs, export |
| Data-analysis beginner | Inspect a numeric CSV column for skew, missingness and spread | Valid import, warning on data issues, comprehensible outputs |
| Research scholar (secondary) | Rapid first-pass description of one measurement | Clear assumptions, no pretence of inferential analysis |

## 3. End-to-end user journey (one screen with six states)

1. **Landing:** free example datasets available immediately; short statement of privacy and limitations.
2. **Input:** select a built-in example or drop/select a UTF-8 CSV (first row = header). No upload to a server.
3. **Inspect:** display detected columns, row count and field quality. Allow selecting *exactly one* eligible numeric column. Preview 8–12 rows and show excluded-value reasons.
4. **Configure:** choose sample vs population variability (show both when available), Type-7 quantiles, bin count (automatic default, user adjustable within guardrails).
5. **Analyze:** cards for basic statistics, methodology/explanation panel, frequency table, histogram, boxplot and less-than ogive.
6. **Export:** download numeric-summary CSV, grouped-frequency CSV, SVG/PNG charts, and a JSON reproducibility manifest (source file name only, processing options, software version, data row counts; do not include raw dataset unless explicitly requested in later version).

**Golden-path acceptance:** Starting from landing, a novice can load a built-in dataset, select a variable, view correct results and download the summary without assistance or sign-up.

## 4. P0 feature definition (must ship in public beta)

**Input and cleaning**
- Built-in synthetic datasets: balanced scores, skewed values, tied/multimodal data, and constant values. Label each as synthetic.
- CSV upload: UTF-8 with optional BOM, headers required, quoted text/commas/newlines handled by parser. Reject malformed files with actionable messages. Warn/normalize duplicate header names while retaining an original-to-display mapping.
- No automatic type conversion during CSV parsing; perform strict numeric validation on the *selected* column. Treat blanks, `NA`, `N/A`, `null`, and `-` as missing tokens only with an explicitly displayed policy; invalid strings counted separately. Accept finite signed decimal numbers and scientific notation; use `.` as decimal separator in v0.1. Reject `Infinity`, `NaN`, ambiguous thousands-formatted values, and non-finite results.
- Never interpret missing or invalid entries as zero. Report total rows, valid n, missing count and invalid count.
- Proposed initial operational limits: maximum CSV 5 MiB, 50,000 data rows, 100 columns; warn and gracefully reject over-limit files. Performance-test and revise limits before freezing release.

**Descriptive statistics**
- Valid observation count, excluded count, min, max, range, sum, arithmetic mean, median, mode(s), Q1, Q3, IQR, customizable p-th percentile (0≤p≤100), sample and population variance and standard deviation.
- No mean/median/variance for zero valid observations. For n=1, population variance=0 and sample variance/std. dev. explicitly undefined. A constant dataset yields zero variance, zero IQR and non-breaking plots.
- Mode policy: Report all unique maximally frequent values if repetition exists; if *every* distinct value appears only once, label **no uniquely informative mode** (not an unsupported claim of a mathematically unique mode). If every valid observation is equal, that single value is the mode.
- Use compensated summation or a numerically stable algorithm for means/variances where practical; document JavaScript floating-point limitations, particularly with large offsets.

**Statistical definitions**
- Mean: Σx/n. Population variance: Σ(x−mean)²/n; sample variance: Σ(x−mean)²/(n−1). For numerical robustness implement a tested stable algorithm rather than naively subtracting squares of large sums.
- Quantiles and percentiles: **Hyndman–Fan Type 7**, sorted x[0…n−1], h=(n−1)p, i=floor(h), α=h−i, Q(p)=(1−α)x[i]+αx[min(i+1,n−1)]; p in [0,1]. The method *must be visible*. Q1=Q(.25), median=Q(.5), Q3=Q(.75). Reference checks against NumPy `quantile(..., method="linear")`; do not assume every JS statistics library uses identical quantile conventions.
- Percentages: valid-value denominators clearly distinguished from all uploaded rows. Round **display values only** (default 4–6 significant decimal digits); exports retain suitable numeric precision and method/version metadata.

**Frequency distribution, histogram, boxplot, ogive**
- For distinct data, exact value-frequency table possible; grouped-frequency table is required for histogram and ogive. User may choose bin count within 1–50; automatic count via `ceil(log2(n)+1)` (Sturges) capped to a sensible range (e.g. 1–30) with special handling for n=1 and constant values. Show that class counts depend on grouping choices.
- Class boundaries: half-open `[a,b)` except last `[a,b]`; deterministic bins computed without losing max value. Frequency counts sum to valid n; cumulative final count must equal valid n; relative frequencies sum to 1 within floating-point tolerance.
- Histogram: labeled axes/units, transparent bin widths, text-based frequency table with equivalent information, responsive display.
- **Less-than ogive:** plot cumulative frequencies at successive *upper class boundaries*, preceded by a zero-frequency point at the lower initial boundary. Provide cumulative percentage alternative. Explain that grouped ogives are approximations of the underlying observations and should not be confused with an exact empirical CDF.
- Box plot: Q1, median, Q3 based on Type 7. Whiskers extend to the most extreme observed values within 1.5×IQR fences; display points beyond as outliers. For constant or IQR=0 data, handle the degenerate geometry deliberately and label it. Explain that outlier flags do *not* prove measurement errors.

**Explanation and exports**
- Each statistic has a concise definition, formula, calculated value, and relevant caveat. Do not generate claims of normality, significance or causal relationships.
- Export summary CSV, frequency-table CSV, graphical SVG/PNG and JSON manifest. Exported text derived from user-supplied header/file names must be safely encoded; prevent spreadsheet formula injection and malicious markup insertion. Prefer numeric-only CSV tables plus safe, fixed header labels.
- Manifest records `schema_version`, `app_version`, `generated_at`, `selected_column`, input counts/exclusions, statistical methods, binning policy and actual bin edges. No automatic raw dataset, file system path, personally identifying information or unapproved analytics logging.

## 5. UI / accessibility specification

Top navigation: About | Try a sample | Import CSV | Definitions | GitHub. Working screen: input/column panel; statistics cards; method details; tabs for frequency table/histogram/boxplot/ogive; export strip. Mobile is a single-column flow, desktop supports split preview/results. Avoid visual clutter, fake activity indicators and decorative animations.

Target WCAG 2.2 AA for all primary interactions. Keyboard-operable file select/options/charts; visible focus; semantic HTML; high contrast; screen-reader summaries; charts always accompanied by data tables and text equivalents. No requirement for hover to reveal critical information.

Privacy: process local file content solely in browser memory; no automatic posting of datasets, no analytics by default, no background sync. Any third-party scripts/CSP/dependency exposures must be assessed before saying “offline/private” in promotional copy.

## 6. Nonfunctional gates

| Requirement | Initial acceptance gate |
| --- | --- |
| Functional | Golden-path flow passes on current Chrome/Firefox/Edge and mobile Chrome |
| Mathematical correctness | Fixture-based tests match independent NumPy/Python reference calculations; edge cases explicitly covered |
| Parser safety | No unsafe code evaluation, untrusted CSV content cannot run HTML/JS, errors are recoverable |
| Privacy | Developer-network inspection confirms selected CSV is not transmitted to external endpoints |
| Robustness | Missing, empty, invalid, extreme, large-offset and constant-column cases handled without crashes |
| Performance | 10,000-row/10-column CSV usable within a target 3 seconds on a normal recent laptop; benchmark actual devices before promise |
| Accessibility | Keyboard-only and screen-reader primary workflow; charts have text/tabular equivalents |
| Reproducibility | Same data + config + version yields same numeric outputs, frequency bins and manifest (except timestamp) |
| Open source | CI, license review, contributing guide, security policy, named maintainer and working quick-start |

## 7. Implementation architecture

- UI: Vite + React + TypeScript; no user login.
- CSV: Papa Parse, with `dynamicTyping: false`, local File input, controlled limits and explicit validation/error UX.
- Core mathematics: pure TypeScript functions and tests; consider established JS statistics helpers only after verifying their definitions against this specification. Treat the core as independently importable and UI-agnostic.
- Charts: accessible SVG-first rendering library; select after lightweight prototype. Do not use a heavy Python server or a WebGL dependency for basic histograms.
- Unit tests: Vitest; E2E tests: Playwright; reference fixtures generated/checked independently with Python/NumPy. Keep reference values checked into the repo.
- Build/deploy: GitHub Actions CI and separate Pages deployment, restricted permissions, branch protection before public stable tag.
- Dependency supply chain: lockfile, pinned GitHub Actions, dependency audit and license review.

Suggested layout:

```text
datasense/
├── README.md
├── LICENSE                  # only after ownership check
├── CONTRIBUTING.md
├── CODE_OF_CONDUCT.md
├── SECURITY.md
├── package.json
├── pnpm-lock.yaml
├── index.html
├── public/examples/          # synthetic datasets and attribution
├── src/
│   ├── core/{numeric,quantiles,frequency,boxplot}.ts
│   ├── io/{csv-import,export}.ts
│   ├── domain/{types,methods}.ts
│   ├── ui/{import,results,charts,methodology}/
│   └── main.tsx
├── tests/{fixtures,unit,e2e,reference}/
├── docs/{STATISTICAL_METHODS,DATA_POLICY,USER_GUIDE,VALIDATION}.md
└── .github/workflows/{ci,deploy-pages}.yml
```

## 8. Formal release criteria / gate checklist

- [ ] 100% P0 features work end-to-end using synthetic examples and uploaded CSVs.
- [ ] All fixture tests in `datasense_validation_matrix.csv` pass, with independent numeric oracle checking.
- [ ] Results clearly distinguish sample/population variance and quantile convention.
- [ ] Input exclusions are counted and displayed; n=0 / n=1 / constant-data paths are safe.
- [ ] Frequencies reconcile exactly to valid n; ogive and boxplot comply with documented conventions.
- [ ] Exports open cleanly and preserve method/version metadata; CSV-injection tests pass.
- [ ] Keyboard/mobile usability checked manually in addition to automated accessibility checks.
- [ ] No user dataset leaves the browser in a production network audit.
- [ ] README demo and 60-second screen recording show the real app, without unsupported claims.
- [ ] License/IP/dependency provenance approved; contributor instructions and public issue templates ready.
- [ ] GitHub Pages build works from frozen source and release tag.

**No launch based solely on a green CI badge**: release requires a human check of calculations, presentation, data handling and the public-facing copy.

## 9. Implementation milestones and backlog

1. **DS-01 Project foundation:** decide final public project name after naming search; prepare repository skeleton on a feature branch, package/CI/lint/test baselines, synthetic fixture data; no public marketing.
2. **DS-02 Core numeric correctness:** filtered numeric column, all descriptive statistics, quantile Type 7, samples/population, fixture cross-checks.
3. **DS-03 Import and data quality:** CSV parsing, warnings, limits, error handling, preview, column selection.
4. **DS-04 Distribution work:** deterministic frequency binning, charts/ogive, cross-check totals and off-by-one boundaries.
5. **DS-05 Interpretation/exports:** statistical definitions and transparent export manifest; CSV-injection/privacy checks.
6. **DS-06 UI/accessibility and pilot:** mobile/keyboard quality, error handling, 15–25 independent pilot participants, bug triage.
7. **DS-07 Public beta:** versioned release, demo, documentation, authentic LinkedIn demonstration, community issues.

**Explicit defer:** GitHub repository creation/publication, UI redesign iterations and GraphLab implementation are not prerequisites to accepting this specification. GraphLab starts once DataSense reaches validated public beta, unless user research demonstrates a compelling pivot.

## 10. Metrics to learn from pilot

Primary: proportion of novice testers completing import → calculation → explanation → export unaided. Secondary: discrepancies reported, errors per dataset, time-to-first-result, clarity ratings, successful exports, independent reuses and actionable external contributions. Track no personal usage information by default; obtain opt-in manual feedback.

## 11. Current risk register

| Risk | Mitigation |
| --- | --- |
| Scope grows into a general statistics platform | Lock P0 boundary; gate new features into post-v0.1 backlog |
| Different quartile methods create disagreements | State Type 7, show formula and reference values, add alternative methods only later |
| Mode/ogive/boxplot interpretation mistakes | Explicit method notes, carefully chosen fixtures and teacher validation |
| Browser freezes on large files | Import limits, deferred processing, progress/error UX, measured performance |
| Privacy promise overstates reality | Production network audit and no automatic data transmission |
| Spreadsheet export formula injection | Fixed safe columns, escaping and spreadsheet-open security tests |
| Tool not differentiated from existing products | Validate step-by-step explanation and transparent calculation with real users |
| Public branding conflicts | Conduct availability/trademark and repo-name checks before naming/release |

## 12. References used to constrain design

- NumPy `percentile/quantile` and `method='linear'` (Type 7): https://numpy.org/doc/stable/reference/generated/numpy.percentile.html
- Papa Parse CSV parser documentation: https://www.papaparse.com/docs
- GitHub Pages custom deployment workflows: https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site
- W3C WCAG 2.2: https://www.w3.org/TR/wcag/
- OWASP CSV injection: https://owasp.org/www-community/attacks/CSV_Injection
- W3C alternate representations of complex charts: https://www.w3.org/WAI/WCAG2/supplemental/patterns/o7p02-alternative-content/

## 13. The next single actionable step

**Implement DS-01 + the numeric oracle fixtures locally in a non-public development branch once this specification is accepted**, then use automated reference tests as the foundation for every UI feature. Do not write visual components before the computational contract is checked.
