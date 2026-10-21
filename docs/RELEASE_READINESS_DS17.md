# DS-17 — worker responsiveness and cancellation review

Date: 21 October 2026. Branch: `feature/ds17-worker-cancel-progress`, based on the DS-16 educational branch. **Review candidate only.** The published main-branch alpha has not been replaced.

## Scope and behavior

1. Import bytes are transferred to a same-origin **module Web Worker**, not uploaded.
2. Parsing, UTF-8 validation, profiling all numeric columns, selecting a numeric column, descriptive statistics, grouping, ogive, box plot, reproducibility manifest and step-by-step teaching explanations run in the worker.
3. Full CSV rows and cross-column data remain in worker memory; only the first ten preview rows, header metadata and small derived results are sent back for DOM rendering.
4. File-upload and selection jobs display **descriptive, not percentage, progress stages**.
5. **Cancel current analysis** terminates the worker and replaces it, invalidates in-flight request IDs, removes stale results/exports and allows a fresh sample/file.
6. Statistics, missing-value rules, Type-7 quartiles, variance conventions and export schema are inherited unchanged from the protected core and DS-16 explanation layer.
7. The Content Security Policy explicitly permits only same-origin worker modules. Browser privacy checks permit same-origin JavaScript-module requests; uploaded files or HTTP POSTs are never whitelisted.

## Safety boundaries

- Workers are terminated on replacement/cancel, including during a CPU-intensive synchronous parser. File read promises on the main thread cannot be forcibly stopped, but the generation token discards stale completions.
- An unexpected worker failure generates a visible error and clears stale results.
- Numeric results remain the existing engine's output, not an independent approximating implementation.
- SVG rendering and downloads still happen on the UI thread; exceptionally large boxplot outlier exports may require a further usability benchmark.
- Main-thread work for rendering a ten-row preview with up to 100 columns is bounded by import limits.
- The worker is same-origin and no network or storage endpoint is added.

## Review acceptance gates

- [ ] Exact-commit locked `npm run validate` green.
- [ ] Baseline hash checks and 17-case NumPy oracle green.
- [ ] Compiled `dist/app/analysis-worker.js` bundled in the published site.
- [ ] Three-engine root/project path browser tests green, including cancel/recover, new teaching explanations, source SHA-256 and all eight exports.
- [ ] Large-file test: near 5 MiB at width 100, UI keeps keyboard/Cancel responsive; report observed latency on slow device without claiming a universal threshold.
- [ ] Manual real-device and screen-reader verification scheduled separately before public beta.
- [ ] DS-15/16 PR merged/reconciled before merging DS-17.
- [ ] Ownership/branding/license decisions and independent user pilot remain open.

## Known limitations

This is asynchronous, stage-based processing, **not an incremental streaming parser or precise percent-complete progress bar**. Progress text may jump between stages if operations finish quickly. A worker is not a remedy for memory pressure from an oversized but allowed CSV, and all limits remain enforced.

The original work's license is still to be decided by the owner. No public-beta announcement is authorized.
