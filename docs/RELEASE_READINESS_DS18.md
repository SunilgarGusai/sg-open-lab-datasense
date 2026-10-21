# DS-18 — independent pilot and beta decision record

Date prepared: 21 October 2026. Branch `feature/ds18-independent-pilot`; based on the already passing DS-17 candidate. **No independent human testing has occurred as part of this branch's preparation.**

## Implemented deliverables

- Anonymous, voluntary, adult-only pilot instructions with consent protections, recruitment targets, task descriptions and checkable answers.
- Three wholly synthetic datasets: four-values reference, duplicate-header/data-quality edge case, and numerical sensor readings.
- Strict CSV feedback schema and a Node.js scorer with explicit cohort, end-to-end success, per-task correctness, severity and pedagogical-clarity gates.
- Automated scorer tests, using **synthetic mock participants** solely to verify aggregate logic. This must never be cited as independent user feedback.
- A version-pinned, SHA-256-manifested tester package constructed from the already validated runtime, alongside facilitator materials.
- GitHub Actions artifact retention for the pilot kit, without publishing it to GitHub Pages.

## Exact-source build requirements

- Full prior TypeScript/Node suite, protected baseline, NumPy oracle and real-origin three-engine browser suite remain required.
- Score and tester package must pass CI from this exact branch SHA.
- Never substitute the older public Pages alpha for the DS-18 candidate in pilot outcomes.

## Acceptance and hold policy

The scoring tool reports *pilot threshold status*, not software publication approval. Planned actual participants: 15–25; currently verified: **0**. Pilot thresholds are defined in [pilot protocol](pilot/README.md). Even with pilot thresholds satisfied, the decision remains **HOLD** until the following human gates:

1. Recruit real voluntary users; verify a genuine independent attempt using an exact candidate version.
2. Validate serious issues and resolve all P0/P1 before approval.
3. Check on an actual phone/tablet with the same HTTPS candidate; verify no sensitive data transmission.
4. Perform real screen-reader and 200%/400% zoom checks, reviewing failures rather than solely relying on axe.
5. Resolve university/personal IP ownership, appropriate license grant and branding.
6. Review and merge DS-16 then DS-17 then DS-18 in sequence, preserving their passing exact-commit evidence.
7. Run the actual deployed-origin suite against a released commit, approve a tagged beta and announce only after all gates pass.

## Remaining blockers (not to paper over)

- No verified human participant or observer feedback.
- No approved public beta license.
- No tested hosted, exact-DS18 HTTPS candidate for mobile testers.
- No direct physical iOS Safari / Android / NVDA / VoiceOver signoff.
- Stacked PRs are review candidates; main remains the previously approved alpha.

This document is a preparatory readiness record only, never a user-acceptance report.
