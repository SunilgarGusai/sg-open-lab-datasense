# DataSense Statistical Methods — foundation

- Finite decimal values only; ASCII decimal dot; scientific notation permitted.
- Missing tokens: empty/whitespace, `NA`, `N/A`, `null`, `-` (case insensitive); other nonnumeric strings invalid.
- Arithmetic mean: sum / n, using an offset-stabilized Welford mean for numerical calculations.
- Population variance: sum of squared deviations / n. Sample variance: / (n−1). Welford's recurrence applied to values shifted by their minimum.
- Type 7 quantile: h=(n-1)p, interpolate sorted x[floor(h)] and x[ceil(h)]. Q1=Q(.25), median=Q(.5), Q3=Q(.75).
- Mode: if every distinct value occurs once, label it *no informative mode*; otherwise list all maximum-frequency values.
- n=0: undefined results (null); n=1: sample variance undefined (null).
- JavaScript uses IEEE-754 binary64. Integer magnitudes above 2^53 can lose unit precision. Values close to 1e308 may cause an intermediate overflow even when inputs are finite; such results are represented as unavailable (null), not trusted.
- No inferential, normality or causal claims are made.
