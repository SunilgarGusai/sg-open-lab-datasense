# DataSense v0.3 Export and Reproducibility Policy

## Exported content

Exports are **explicit user actions**, run in the browser, with no application-level upload or backend. The eight outputs are:

1. Summary CSV: one metric/value pair per row, including source name, SHA-256 when available, data-quality counts, quantile method and sample/population measures.
2. Frequency CSV: numerical class boundaries, explicit endpoint inclusivity, counts, cumulative counts, relative frequencies.
3. Ogive CSV: all lower/upper boundary cumulative points, including zero at the first lower bound.
4. Box-plot CSV: Type-7 quartiles, fences, observed whiskers and numerical outlier values.
5. JSON analysis manifest: format schema, source filename, byte count, optional SHA-256, selected column, data quality, mathematical definitions, complete numerical derived results, grouped bins and numeric outlier values.
6. Histogram SVG: labelled histogram with embedded SVG title and description.
7. Ogive SVG: cumulative-frequency chart with labelled axes and title/description.
8. Box-plot SVG: quartiles, median, whiskers and up to 75 distinct plotted outlier markers, along with an explicit count and a tabular companion for full information.

**Caution:** Reports do not contain original CSV records, but may reveal values (especially numerical outliers), statistical properties and the source filename. Inspect files before sharing. The full unselected columns are not included.

## CSV spreadsheet-safety policy

All *untrusted text fields* are treated as possible spreadsheet formulas. Text beginning with a formula introducer (`=`, `+`, `-`, `@`) after optional leading whitespace/control/invisible prefixes, or beginning with a literal quote prefix, receives an additional leading single-quote character. CSV fields use RFC-style quote doubling and CRLF record endings; numeric output fields remain numeric (including negative numbers). Names and filenames are never used as spreadsheet formulas. The treatment reduces known CSV-formula injection risk; behavior depends on the particular spreadsheet importer and cannot be a universal security guarantee. Keep spreadsheet software updated and review sources before opening exports.

## Reproducibility conventions

- Quartiles: Hyndman–Fan Type 7 / linear interpolation, not a universal alternative definition.
- Sample variance: Welford-based method with divisor `n-1`; population variance divisor `n`.
- Histogram: equal-width, lower-inclusive classes, upper-exclusive except final upper-inclusive bin.
- Ogive: cumulative counts at upper class boundaries, with initial zero at first lower bound; values are computed from grouped observations.
- Box plot: Type-7 quartiles, Tukey-style `1.5 × IQR` fences, whiskers at observed in-fence extremes; outliers are retained in summaries.
- Source SHA-256 is computed from the original local CSV bytes using `crypto.subtle` where available. In-memory/unsupported environments may yield a null SHA-256 and an explicit warning. The SHA-256 does not replace the original data file.
- App version and schema are included in each JSON manifest. Deterministic numerical results exclude run timestamp; the report is not a digital certification of the original dataset.

## Explicit limitations

Chart SVGs use a fixed vector view box and have accessible descriptions and tabular alternatives. Their rendering and perception under every mobile browser, assistive technology and spreadsheet implementation have **not** been fully audited. No deployment/production privacy claim is made until a real hosted-origin network check passes.
