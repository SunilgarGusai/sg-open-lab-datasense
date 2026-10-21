# DS-15/DS-16 controlled review — educational explanations

Review prepared: 21 October 2026. Base commit: `e8ef10582c97354baf84be20b1ed725ad7bff6ff`.

## DS-15 — reconciled baseline

- The earlier DS-13 handoff described a private `0.4.0-alpha.1` project with 68 Node tests. It is historical.
- The connected repository's DS-14 main branch identifies `0.4.1-alpha.1`, with a public source repository, an approved alpha-preview workflow, a guarded deployment pathway, a local Windows launcher, documented 84-test local validation and 17 NumPy cases. The delivered version and a release candidate are not the same thing.
- Source diff from the last DS-13 evidence commit to the inspected DS-14 main commit includes CSV hardening, launcher/server security, CI and staging workflow updates.
- The three DS-13 parser findings are documented as corrected with regression coverage. These existing numerical/statistical modules and baseline hashes are untouched by DS-16.
- The DS-14 report differentiates locally passing 84/84 from a hosted run that skipped a port-80-dependent check. Do not describe those as identical coverage.
- The GitHub repository is public. A public repo is not an open-source license; there is still no owner-approved root LICENSE.
- The manual Pages workflow is designed to run checks on a deployed HTTPS origin, but a confirmed passing exact-commit Pages run must be examined before declaring hosted acceptance.
- The supplied archives were not re-extracted for this review because the local execution environment was unavailable. This review instead uses the live GitHub source and the provided handoff. No archive byte identity is claimed.

## DS-16 — educational product increment

The new *Show the calculation* panel covers mean, median, Type-7 Q1/Q3, sample/population variance and grouped frequency. It derives reported values exclusively from the established numerical engine and displays safe text-only explanations. For smaller datasets, it shows the original or sorted valid observations; on larger datasets it deliberately omits raw observations. Undefined results are not invented. The numerical engine, missing-data policy and external export schema remain unchanged.

New focused regression tests compare displayed explanations with reference values and check empty, singleton, constant, inconsistent and large-data boundaries. The explanatory content is a teaching aid, not a second computational authority.

## CI acceptance before merge

1. Run locked install, type-check, compile, Node tests (including `tests/explanations.test.mjs`), original 17-case NumPy oracle and protected-baseline verification.
2. Exercise sample scores, missing-value import, metric selector, keyboard navigation, empty/nonnumeric column and malformed-file recovery in Chromium, Firefox and WebKit. Add a new browser scenario asserting every calculation explanation can be selected and contains the matching reported value.
3. Confirm static staging includes `dist/education/explain.js` and no external runtime dependency.
4. Perform one manual screen-reader and zoom check before claiming accessible teaching interactions.
5. Collect one learner/educator observation on whether the explanation clarifies Type-7 quartile interpolation and the two variance denominators.

## Publication and open decisions

No automatic deployment of this branch is intended. The public Pages alpha remains on the separately approved main branch. A PR review and green CI are required before merge; actual public-origin acceptance, naming/branding and distribution license remain independent owner decisions. No public-beta or LinkedIn launch is approved by this document.

## Follow-up

Prioritize Web Worker processing, a responsive progress/cancel experience and a bounded 5-MiB mobile workload. Do not add extra statistical methods until these usability and release gates are satisfied.
