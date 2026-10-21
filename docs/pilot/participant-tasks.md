# DataSense — Independent learning trial
**Anonymous adult volunteer test · estimated 15–25 minutes**

You are evaluating an experimental, free introductory-statistics teaching tool. Participation is voluntary, you may stop at any point, and no academic or employment decision will depend on your feedback. Use **only the supplied synthetic CSVs**. Do not import private, personal or institutional data.

## Setup
1. Extract the complete participant ZIP to a new writable folder. Do not modify the files inside `APP/_site`.
2. On Windows with Node.js 22 or newer, double-click `APP/Start DataSense.cmd` and use its local browser page. Afterwards, double-click `APP/Stop DataSense.cmd`. Other desktop users may open a terminal in `APP`, run `node scripts/serve.mjs`, and visit `http://127.0.0.1:8765/`.
3. The tool uses your browser locally. Nothing should require an account or uploading your file to a remote site.
4. If you cannot start it or encounter an error, note exactly where you stopped. A failed or confusing task is useful feedback.
5. Work independently first, without asking for hints. The facilitator records whether you finish without help. If assistance is needed, you can still continue the trial.

## Tasks
**T01 — Describe your scores.** Open **Sample scores**. Locate the arithmetic mean and median. Explain in your own words what each describes.

**T02 — Understand quartiles and variance.** Open `TASKS/fixtures/type7-four-values.csv`. Select the `value` column. Using **Show the calculation**, explain how Q1 and Q3 are calculated. Then explain why sample variance and population variance use different denominators.

**T03 — Identify data problems.** Open `TASKS/fixtures/data-quality-duplicate-headers.csv`. Select the *first* `score` column. Report how many records are valid, missing or invalid. Determine the mean. Look for the second `score` column and explain the difference.

**T04 — Interpret the distribution.** Return to **Sample scores**. Choose **5 histogram groups**. Explain what the cumulative-frequency ogive's final point means. Check that the frequency table agrees.

**T05 — Export an analysis.** Export the summary CSV, frequency CSV, JSON manifest and histogram SVG. Describe which results someone else could reproduce, and whether the files reveal the original row-by-row input.

## Optional tasks
**T06 — Cancel and recover.** With the facilitator's approved synthetic large-file fixture, try **Cancel current analysis** while the tool is working, and reopen **Sample scores**. Record whether cancellation was possible on your device.

**T07 — Accessibility.** If relevant to you, try keyboard-only navigation, zoom and/or your usual screen reader. Describe any confusing, inaccessible, or unexpected interactions.

## After each task
Tell the facilitator which step was easy or difficult. Share only broad device/browser information and any **synthetic-data** errors. Do not include your name or contact details in the stored feedback CSV.

**There is intentionally no answer key in this participant guide.** Please do not consult reference answers before completing the tasks.
