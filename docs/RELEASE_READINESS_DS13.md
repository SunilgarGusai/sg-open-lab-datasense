# DataSense DS-13 repository, CI and staging readiness

Updated: 20 October 2026. Alpha version: `0.4.0-alpha.1`.

## Decision

**Local DS-13 validation passes. Corrected hosted CI still fails its WebKit browser gate. GitHub Pages is not deployed. Public beta remains NO-GO.**

The dedicated source repository is [SunilgarGusai/sg-open-lab-datasense](https://github.com/SunilgarGusai/sg-open-lab-datasense), verified private. No existing research repository was used as the DataSense destination. Source-repository privacy is separate from the visibility of a future website.

The current private repository cannot use GitHub Pages under the account's verified plan. The manual Pages workflow is prepared, but its `DATASENSE_PAGES_ENABLED` variable gate remains off. There is no deployed staging URL. Neither `robots.txt` nor `noindex` would make a deployed site private.

## Verified local evidence

The clean-checkout validation below refers to commit `d55f5abb661f8945bad0e1c9d5cbb75b719b4d8d`.

| Check | Verified result | Evidence and limits |
| --- | --- | --- |
| Clean install, typecheck, compile and tests | PASS: 68/68 tests | [Clean installation](../evidence/ds13/clean-checkout-install.txt), [clean validation](../evidence/ds13/clean-checkout-validation.txt). This comprises the original 53 tests plus 15 staging tests. |
| Original mathematical contract and tests | PASS: 10 protected files match SHA-256 records | [Protected manifest](../evidence/ds13/protected-baseline-sha256.json), [preservation result](../evidence/ds13/baseline-preservation.txt). The recorded hashes were independently compared with imported baseline `decd572`; original core, contracts, tests and oracle fixture remain unchanged. |
| Independent NumPy oracle | PASS: 17 cases | [Oracle result](../evidence/ds13/numpy-oracle.txt). The oracle generator and frozen reference fixture were preserved. |
| JavaScript dependency audit | PASS at the recorded check: no reported vulnerabilities | [Audit output](../evidence/ds13/npm-audit.json). A point-in-time registry result, not a guarantee against future advisories. |
| Registry signatures | PASS: both dependencies signed; one attestation verified | [Signature output](../evidence/ds13/npm-signatures.txt). |
| Reproducible staging build | PASS: byte-identical complete file/hash manifests from two independent `npm ci` builds | [Reproducibility record](../evidence/ds13/clean-build-reproducibility.json). Node 24.19.0, TypeScript 5.8.3, Windows. The site contains 19 files: 18 payload files plus `staging-manifest.json`. This does not yet establish cross-platform byte identity. |
| Ordinary local HTTP navigation | PASS, limited | [Manual HTTP record](../evidence/ds13/manual-http-check.json), [downloaded manifest](../evidence/ds13/manual-http-manifest.json). One built-in sample and one JSON download in the in-app browser; original CSP meta retained, 10 valid values, mean 23.4, expected source SHA-256 matched. This is not a full browser or HTTPS audit. |

The reproducible manifest SHA-256 was `149654b91b666d8843abf416b08bf9019d57e87a56483738f8eede3108424afa` in both local builds.

## Hosted CI evidence and corrective changes

The first hosted run, [39315051604](https://github.com/SunilgarGusai/sg-open-lab-datasense/actions/runs/39315051604), tested commit `30321a3` and **failed** the browser gate. Dependency installation and audits, protected baseline verification, typecheck/build/tests, the NumPy oracle, packaging and browser installation succeeded. The workflow retained [validation evidence](https://github.com/SunilgarGusai/sg-open-lab-datasense/actions/runs/39315051604/artifacts/12217059586) and correctly skipped the validated-site artifact upload. GitHub artifact retention is finite; the run link alone is not a permanent evidence archive.

Two browser findings drove the corrective commit:

- Narrow-view tables were horizontally scrollable without a keyboard-focusable region. The four table containers now have accessible region names and keyboard focus, with visible focus styling. The browser harness tests keyboard scrolling where horizontal overflow exists.
- Playwright 1.64.0's WebKit 27.2 emitted a CSP error when interacting with native select controls, matching [upstream issue 43497](https://github.com/microsoft/playwright/issues/43497). Browser QA is pinned to Playwright 1.63.0. Strict CSP and console checks remain enabled; this compatibility pin does not establish support for current WebKit or real Safari.

The corrective work also makes packaging reject missing entries or unresolved module dependencies before replacing an existing `_site`, with regression coverage. Browser evidence now includes IndexedDB and Cache API state, and malformed-file recovery starts from valid numeric results.

The second hosted run, [39316039072](https://github.com/SunilgarGusai/sg-open-lab-datasense/actions/runs/39316039072), job `118277633455`, tested corrective commit `d55f5abb661f8945bad0e1c9d5cbb75b719b4d8d` and **still failed the browser gate**. Locked installation, dependency signatures, typecheck/build, all 68 tests, the 17-case oracle and packaging passed. Chromium passed all six root/project-path viewport scenarios; Firefox also passed all six, including the new keyboard-scroll checks. WebKit 26.6 under Playwright 1.63.0 failed the console-error gate in all six scenarios. The pin has therefore **not resolved the observed WebKit gate failure**.

**WebKit investigation — PENDING:** Root reviewer is inspecting the second-run raw browser artifacts. Insert the retained evidence location, diagnosed cause and any subsequent correction/run here after inspection. Do not suppress the error or call CI successful merely because the other engines pass. Deployment remains blocked by the failed validation job as well as the separate Pages plan/enablement limits.

## Infrastructure boundaries

- JavaScript dependencies use an exact-version npm lockfile and `npm ci --ignore-scripts`. Python QA dependencies use exact versions and required wheel hashes.
- CI and the validation portion of the Pages workflow have read-only repository permissions. Action references are pinned to commit SHAs, and checkout does not persist credentials.
- Pages requires manual dispatch, the explicit variable gate, the `main` branch and the exact dedicated repository. The dependent deploy job alone receives Pages write and OIDC permissions. It reads existing Pages configuration without enabling the service.
- The staging packager uses an allowlist, excludes source maps, declarations, tests, private evidence and repository metadata, rejects symlinked assets/output, checks module completeness, and records hashes of the files it prepares. Its source manifest excludes itself from the hash list.
- A private repository, successful CI or a prepared workflow does not authorize public beta publication. The Pages plan limitation must be resolved through an explicitly approved hosting/visibility decision; repository visibility must not be changed merely to make Pages work.

## Remaining release gates

| Gate | Required evidence or decision |
| --- | --- |
| Corrected hosted CI | Diagnose the second run's six WebKit console-error failures from raw artifacts, correct a demonstrated issue or document a justified support decision, and obtain an inspected passing run for the release candidate. Preserve failures and their disposition; Chromium/Firefox passes alone do not satisfy the current all-engine gate. |
| Current WebKit and real Safari | Retest the native-select/CSP behavior with current WebKit and actual Safari after an upstream fix or a justified support decision. The 1.63.0 pin is a test-tool workaround, not latest-browser validation. |
| Real HTTPS staging origin | After approved hosting is available, verify actual response headers, CSP enforcement, project-path assets, all eight saved downloads, source SHA-256, network requests and storage behavior at that deployed origin. Loopback HTTP and in-memory tests are not substitutes. |
| Source review findings | Resolve or explicitly constrain pilot scope for DS13-S01 (colliding column labels) and DS13-S02 (delayed rejection of overwide rows). Resolve DS13-S03 before exposing the text parser as a supported API for untrusted callers. Reproductions, severities and precise boundaries are in [SECURITY_REVIEW_DS13.md](SECURITY_REVIEW_DS13.md). |
| Manual accessibility | Complete keyboard, focus, zoom, contrast, screen-reader and assistive-technology review against the intended WCAG target. Automated axe results and desktop-engine narrow viewports do not certify conformance or real-device usability. |
| Spreadsheet application exports | Open/import adversarial text-prefix exports in the intended spreadsheet applications and document their behavior. CSV formula-prefix mitigation is not a universal spreadsheet guarantee. Review filename and numeric-outlier disclosure before sharing. |
| Worst-case CSV workload | Test near-5-MiB input up to the supported 100-column width, missing/invalid-value-heavy data and malformed overwide rows on slower intended devices. Existing 50,000-row by eight-column observations do not establish responsiveness or memory bounds for those cases. |
| Licensing, ownership and branding | Clear code/data/dependency licenses, ownership, product naming and branding before public release. No final product-name or licensing approval is recorded here. |
| Independent pilot | Run a bounded pilot with intended learners/educators; validate interpretation, error recovery, exports and usability, document findings and close material issues. |
| Publication decision | Obtain explicit approval for website visibility, hosting and release scope after applicable gates pass. Public beta and launch promotion remain unauthorized. |

Use the [manual acceptance checklist](MANUAL_ACCEPTANCE_CHECKLIST.md) alongside this record. The [DS-12 audit](RELEASE_READINESS_DS12.md) remains historical evidence; its in-memory-browser scope must not be relabelled as real-origin validation.
