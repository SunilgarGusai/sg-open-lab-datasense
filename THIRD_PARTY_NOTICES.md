# Third-party software inventory

The browser runtime contains this project's compiled code and synthetic example
data, with no bundled third-party runtime package, font or analytics service.
The Node server uses Node's standard library. Node and browsers are separately
installed prerequisites and are not redistributed by the runtime ZIP.

Build/QA tools are not shipped in `_site`:

| Tool | Pinned version | Upstream licence |
| --- | --- | --- |
| TypeScript | 5.8.3 | Apache-2.0 |
| axe-core | 4.14.0 | MPL-2.0 |
| NumPy | 2.3.5 | BSD-3-Clause; see wheel's bundled-library notices |
| Playwright | 1.63.0 | Apache-2.0; separately installed browsers have their own notices |
| pyee | 13.0.0 | MIT |
| greenlet | 3.5.6 | MIT and PSF-2.0 |
| typing_extensions | 4.16.0 | PSF-2.0 |

Consult each installed package's LICENSE/NOTICE and distribution metadata before
redistributing tooling or browsers. Version/hash locks are in `package-lock.json`
and `requirements-ci.txt`; CI actions are pinned in `.github/workflows/`.
Local additional Edge checks used the machine's installed Edge and the bundled
Playwright 1.62.1 QA runtime, separately identified in their evidence.

This inventory is not a new licence grant for DataSense. The project owner's
code/data ownership, distribution licence and product-name clearance remain
decisions for public release. No open-source licence has been assigned on the
owner's behalf.
