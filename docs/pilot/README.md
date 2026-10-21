# DataSense DS-18 — Independent user pilot

**Status:** RECRUITMENT NOT STARTED / ZERO VERIFIED HUMAN RESPONSES. This is a research/UX testing protocol, not a beta launch. It must be run against one exact Git commit, not the currently published older Pages alpha.

## Why this pilot exists

Determine whether ordinary students, educators, and independent beginners can **load → inspect → calculate → understand → export** using DataSense without assistance. Detect confusing explanations, incorrect interpretations, browser/device failures, privacy surprises and accessibility blockers before public-beta approval.

## Participant safeguards

Invite 15–25 **voluntary adult** users if possible, targeting at least 5 students, 3 educators and 3 external participants. A student may decline without academic consequence. No grades, employment decisions, incentives contingent on favorable feedback, medical or personal dataset uploads, or account registration. Ask only for an anonymous code (`P001`, `P002`, ...), broad role, external yes/no, device class and browser. Avoid names, emails, student numbers, IP addresses, free-text personal details, and screenshots with identifiable information. Do not publish individual feedback or copied raw files on GitHub; share feedback with the coordinator privately using approved methods. Participants can stop at any time.

The test uses **only supplied synthetic data**. No institutional or private dataset is needed. Testers do not consent to public redistribution of comments simply by participating.

## Candidate distribution — exact-version rule

The maintainer selects the fully green **DS-18** GitHub Actions run and downloads its **`datasense-ds18-pilot-<commit>`** artifact. Unzip the artifact into a new directory. It includes `APP/` (the tested alpha runtime), `PILOT/` (instructions/fixtures/template), and a manifest recording the exact commit and SHA-256 file hashes.

**IMPORTANT — BLINDED DISTRIBUTION:** The `datasense-ds18-pilot-<commit>` package is **facilitator only**, because this README contains expected answers. **Never send that entire ZIP to testers.** Download the separate `datasense-ds18-participant-<commit>` artifact, which contains `APP/`, `TASKS/README.md` (instructions without answers), and `TASKS/fixtures/`. The facilitator keeps the separate answer key and `feedback-template.csv` outside the tester package. Verify that both artifact manifests name the *same* commit.

Only use the same artifact/commit for the complete pilot. Do not send users the public GitHub Pages link as a substitute until that host is proven to serve the *same commit*. The current `main` Pages alpha predates the worker/teaching candidate.

On Windows, with Node.js 22+ installed, double-click `APP/Start DataSense.cmd` and keep the loopback origin `http://127.0.0.1:...` (or the launcher-provided URL). Verify the `APP/Stop DataSense.cmd` flow afterward. Other desktops may run `node scripts/serve.mjs` from inside `APP` after inspecting its options. The application does not upload CSV data.

**Mobile remote testing is not yet ready:** the desktop loopback URL is not a secure, reachable mobile staging URL. Schedule mobile pilot tasks only after a separately approved, HTTPS, exact-commit staging deployment. Do not bypass certificate security or serve sensitive files over an unsecured LAN.

## Facilitator script (independent first attempt)

1. Record a **random participant code**. Explain that the testing is voluntary and that only synthetic data may be used.
2. Give the person **only the blinded participant package and its TASKS/README.md**, never this facilitator README. Do not coach on controls before recording the independent attempt.
3. For each task T01–T05, record completed yes/no, independent yes/no, answer_correct yes/no, approximate seconds, optional clarity rating (1–5), issue severity and sanitized short note in `feedback-template.csv`. Use one row per participant/task. T06–T07 are exploratory and may be omitted.
4. If a tester needs help, record `independent=no` even if the task subsequently finishes. Measure completion as observed, not guessed.
5. Ask: "What result did you expect? What did the tool show? What did you find confusing?" Do not imply the intended answer in advance.
6. Report a major bug with steps, synthetic input, environment, expected/observed behavior and anonymized reference; never attach private CSV.

## Core tasks and expected observations

| Task | Participant instruction | Acceptance observation |
|---|---|---|
| **T01** | Open **Sample scores**. Find the arithmetic mean and median, then describe what each means. | 10 valid values; mean **23.4**, median **22.5** |
| **T02** | Open `fixtures/type7-four-values.csv`, choose `value` and use **Show the calculation** to explain Q1, Q3, and the two variance denominators. | Q1 **1.75**, Q3 **3.25**; population variance **1.25**, sample variance **5/3 ≈ 1.666667** |
| **T03** | Open `fixtures/data-quality-duplicate-headers.csv`, select the *first* `score` variable, identify exclusions and the mean; observe duplicate-column naming. | First score: 7 rows; **3 valid, 3 missing, 1 invalid**; mean **8**. Distinguish the second `score` column |
| **T04** | Return to **Sample scores**, select **5 histogram groups**, find the final ogive count and explain how it relates to valid observations. | Frequency totals and ogive endpoint both **10**; grouped chart and exact table agree |
| **T05** | From the same analysis, export summary CSV, frequency CSV, JSON manifest and histogram SVG. Explain what can be reproduced. | Four nonempty, usable files; manifest reports valid=10; source SHA-256 where supported; exports never include raw original CSV rows |

## Exploratory, non-core tasks

- **T06** — Import an approved synthetic near-limit dataset, verify the UI can still be interacted with during processing, choose **Cancel current analysis**, confirm abandoned results do not reappear, and recover with **Sample scores**. On very fast hardware, cancellation may be impossible to catch before completion; record that observation accurately rather than marking it as a product defect by itself.
- **T07** — Keyboard-only and screen-reader/mobile usability. Navigate file control, selector, teaching panel, chart scroll regions and exports; check status announcements, 200%/400% zoom, and absence of unmanageable horizontal page overflow. An assistive-tech check needs a person familiar with that technology; automated axe checks are not substitutes.

## Feedback file and interpretation

Use the included `feedback-template.csv` header exactly. Allowed fields:
- `tester_code`: `P001` etc, no real names.
- `role`: `student`, `educator`, `independent`, `other`; `external`: `yes` or `no`.
- `device_class`: `desktop`, `mobile`, `tablet`; `browser`: short broad product/version only.
- `task_id`: `T01`–`T07`; `completed` and `independent`: `yes`/`no`; `answer_correct`: `yes`/`no` for core tasks (optional tasks may use `na`).
- `seconds`: optional whole number, 0–7200; `clarity_1_5`: optional 1–5.
- `severity`: `none`, `P0` (data/security harm), `P1` (blocking wrong result or task), `P2` (significant usability bug), `P3` (minor).
- `comment`: optional, concise and **de-identified**, max 300 characters.

For example, `P001,student,no,desktop,Firefox,T01,yes,yes,yes,55,5,none,` is valid. Do not insert someone's name or raw data in `comment`.

Run the scorer from the **checked-out DS-18 source repository** after `npm ci --ignore-scripts && npm run build`:

```bash
node scripts/score-pilot.mjs path/to/filled-feedback.csv pilot-aggregate.json
```

This produces only aggregate metrics, never copies participant notes into the report. Exit 0 means *defined pilot thresholds* passed; exit 1 means thresholds are not met; exit 2 means feedback was malformed. **No exit code means beta approved.**

## Decision policy

A pilot is *threshold-passing* only with all of:
- At least **15 participants**, including 5 students, 3 educators and 3 external participants.
- At least **80%** of participants independently and correctly complete **all five core tasks**.
- At least **90%** correct completion for **each** of T01–T05 (denominator all participants, not merely responses received).
- Zero unresolved P0 or P1 issues and median T02 explanation-clarity score ≥4 from at least 10 responses.

After those thresholds, the maintainer separately checks real-device/mobile usability, screen-reader findings, actual-origin security, ownership/licensing, pilot validity and the exact release commit. Only then may the project owner decide whether to announce beta. A passing self-reported pilot is **insufficient** for automatic publication.

## Pilot status (update only from observed evidence)

- Verified adult participants: **0**.
- Verified completed core workflows: **0**.
- Manual screen-reader signoff: **not completed**.
- Real-device mobile acceptance: **not completed**.
- Licensing and ownership approval: **pending**.
- Public beta: **NO-GO**.

Do not edit these counts without collected evidence. Do not represent CI-generated synthetic scorer tests as human participation.
