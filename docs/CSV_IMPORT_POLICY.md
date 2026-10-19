# DataSense CSV import and data-quality contract — alpha 0.2.0

## Accepted files

- UTF-8 text CSV with optional byte-order mark.
- One nonempty, named header row (case-insensitive duplicate names permitted, normalized for display).
- Delimiter is the literal comma; quoted records may contain commas, escaped `""` quotation marks, and embedded newlines.
- Endings CRLF, LF and CR. A terminal newline does not produce an additional row; interior empty lines are retained as empty fields for a single-column file. Uneven records cause a clear rejection.
- No dialect/locale detection, TSV, semicolons, automatic thousands/decimal conventions or Excel `.xlsx` import in this version.
- Hard limits: 5 × 1024 × 1024 bytes, 50,000 data rows, 100 columns. Files above limits reject entirely instead of silently truncating.

## Column handling and exclusions

Duplicate headers are displayed as `score`, `score (2)` etc. Distinct index-derived IDs (`column-0`, `column-1`) preserve original order, and warnings explain the renaming.

A numerical candidate must contain at least one valid finite number; nonnumeric columns are listed but not converted. For the selected column, blank/NA/N/A/null/- map to missing; all other text that fails strict decimal syntax maps to invalid. In particular `NaN`, `Infinity`, `1,234`, `1_234`, currency signs, and hex values are invalid. Missing and invalid values are never silently replaced by zero. The application displays row, valid, missing and invalid counts.

## Security and privacy boundaries

`parseCsvBytes` checks byte limits before decoding, uses UTF-8 fatal mode, and never evaluates any content as code. UI uses DOM `textContent` for all CSV headers, fields and uploaded filenames. Only local built-in assets are referenced; no data-upload code or analytics is present in alpha. **A real deployed-browser network audit remains mandatory before promoting a privacy promise in public marketing.**

If a new file is invalid, prior results are hidden so the user cannot mistake stale calculations for a new upload. CSV exports are implemented with formula-prefix mitigation and quoting as documented in the [export policy](EXPORT_POLICY.md); behavior in the intended spreadsheet applications still requires verification.
