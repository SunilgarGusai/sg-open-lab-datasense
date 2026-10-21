# FACILITATOR ONLY — DO NOT SHARE WITH PARTICIPANTS

This folder contains reference answers, study thresholds, and anonymous feedback storage rules. It **must not** be included in participant distributions. Share only the separately produced `datasense-ds18-participant-<sha>` artifact.

**Never upload completed participant responses to this public GitHub repository.** Store them only in your approved private storage, de-identify notes and report aggregates.

## Reference answers (keep blinded)
- **T01** Sample scores (12,15,18,18,21,24,27,30,33,36): n=10, mean=23.4 and median=22.5. Accept conceptual interpretations phrased naturally.
- **T02** Four-value CSV (1,2,3,4): Q1=1.75, Q3=3.25, population variance=1.25, sample variance=5/3 ≈1.666667. Type-7 quartile interpolation uses h=(n−1)p. Population variance divides by n; sample variance by n−1.
- **T03** First score: seven rows, three valid (4,8,12), three missing (NA, blank, dash), one invalid ('invalid'), mean 8. Duplicate score column labelled `score (2)`, values 10,20,...,70, mean 40.
- **T04** Sample scores: five grouped bins total to n=10, and the cumulative ogive ends at 10. Group boundaries may differ by setting, but reconciliation must hold.
- **T05** Four usable exports: summary CSV, frequency CSV, manifest JSON, histogram SVG. The manifest records input metadata and SHA-256 where supported, not the full raw CSV. Do not claim it reconstructs the original dataset.

## Observation policy
Give no coaching or expected numbers during an independent attempt. For each T01–T05 record `completed`, `independent`, `answer_correct` and approximate time. If a person gets help, `independent=no`, even if the result is correct afterward. Optional tasks may use `answer_correct=na`.

Use the feedback schema in `docs/pilot/feedback-template.csv` or the included facilitator package. Identifying details should not be recorded. Do not fabricate participants or use software-fixture simulations as pilot results.

Thresholds and full instructions: `README.md` (facilitator protocol), plus `scripts/score-pilot.mjs` in the GitHub source.
