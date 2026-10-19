"""DS-13 browser checks against ordinary HTTP(S) navigation and the original CSP.

Example (install Playwright and the pinned local axe-core dependency first):
    python scripts/real_origin_smoke.py --browser chromium --output qa/chromium
    python scripts/real_origin_smoke.py --browser chromium --channel msedge \
        --site-root _site --output qa/edge
    python scripts/real_origin_smoke.py --browser webkit --url https://host/project/ \
        --output qa/deployed-webkit

No request routing, response fulfillment, HTML rewriting, module rewriting, or
opaque-origin navigation is used. axe-core is executed through the automation
evaluation channel; it is not a page script and does not demonstrate that CSP
allows inline scripts. A separate DOM-inserted script tests that restriction.
Automated findings do not establish WCAG conformance or assistive-tech usability.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import importlib.metadata
import io
import json
import platform
import re
import sys
import threading
import time
import traceback
import xml.etree.ElementTree as ET
from contextlib import contextmanager
from datetime import datetime, timezone
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit


ROOT = Path(__file__).resolve().parents[1]
SUBPATH = "/sg-open-lab-datasense/"
VIEWPORTS = ((1280, 900), (390, 844), (320, 740))
EXPORTS = ("summary", "frequency", "ogive", "boxplot", "manifest",
           "histogram-svg", "ogive-svg", "boxplot-svg")
SCORES = (12, 15, 18, 18, 21, 24, 27, 30, 33, 36)
SYNTHETIC = ("score,alternate,label\n" + "".join(
    f"{value},{value * 10},row-{i}\n" for i, value in enumerate(SCORES, 1)
)).encode("utf-8")
SYNTHETIC_HASH = hashlib.sha256(SYNTHETIC).hexdigest()
CAVEAT = ("Automated browser and axe checks are bounded evidence, not WCAG "
          "conformance, screen-reader testing, a security audit, or a general "
          "privacy guarantee. Narrow viewports are desktop-engine resize tests.")


def utc_now():
    return datetime.now(timezone.utc).isoformat()


def write_json(path, value):
    Path(path).write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n",
                          encoding="utf-8")


def require(condition, message):
    if not condition:
        raise AssertionError(message)


def origin(url):
    parsed = urlsplit(url)
    port = parsed.port or (443 if parsed.scheme == "https" else 80)
    return f"{parsed.scheme}://{parsed.hostname}:{port}"


def source_inventory(site_root):
    paths = [site_root / "index.html", site_root / "styles.css"]
    paths.extend(sorted((site_root / "dist").rglob("*.js")))
    files = []
    for path in sorted(paths):
        require(path.is_file(), f"Missing served source: {path}")
        files.append({"path": path.relative_to(site_root).as_posix(),
                      "bytes": path.stat().st_size,
                      "sha256": hashlib.sha256(path.read_bytes()).hexdigest()})
    require(len(files) > 2, f"No compiled JavaScript found in {site_root / 'dist'}")
    canonical = "".join(f"{item['path']}\0{item['sha256']}\n" for item in files)
    return {"root": str(site_root), "files": files,
            "sha256": hashlib.sha256(canonical.encode("utf-8")).hexdigest(),
            "algorithm": "SHA-256 of sorted relative-path NUL file-SHA256 LF entries"}


class StaticHandler(SimpleHTTPRequestHandler):
    """Serve the same bytes at / and a GitHub-Pages-style project subpath."""

    extensions_map = {**SimpleHTTPRequestHandler.extensions_map,
                      ".js": "text/javascript", ".css": "text/css",
                      ".html": "text/html", ".json": "application/json"}

    def do_GET(self):
        self._original_path = self.path
        if urlsplit(self.path).path == SUBPATH.rstrip("/"):
            self.send_response(301)
            self.send_header("Location", SUBPATH)
            self.end_headers()
            return
        if self.path.startswith(SUBPATH):
            self.path = "/" + self.path[len(SUBPATH):]
        super().do_GET()

    def log_request(self, code="-", size="-"):
        self.server.request_log.append({
            "at": utc_now(), "method": self.command,
            "path": getattr(self, "_original_path", self.path),
            "status": str(code), "size": str(size)})

    def log_message(self, *_args):
        pass


@contextmanager
def static_origin(site_root):
    server = ThreadingHTTPServer(("127.0.0.1", 0),
                                 partial(StaticHandler, directory=str(site_root)))
    server.daemon_threads = True
    server.request_log = []
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield f"http://127.0.0.1:{server.server_port}", server.request_log
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=5)


class Checks:
    def __init__(self):
        self.items = []

    def run(self, name, function):
        started = time.perf_counter()
        try:
            details = function()
            self.items.append({"name": name, "status": "pass", "details": details,
                               "duration_ms": round((time.perf_counter() - started) * 1000)})
            return True
        except Exception as error:
            self.items.append({"name": name, "status": "fail",
                               "error": str(error), "error_type": type(error).__name__,
                               "duration_ms": round((time.perf_counter() - started) * 1000)})
            return False


def geometry(page):
    dimensions = page.evaluate("""() => ({
        innerWidth, innerHeight, devicePixelRatio,
        documentWidth: document.documentElement.scrollWidth,
        bodyWidth: document.body.scrollWidth,
        documentHeight: document.documentElement.scrollHeight
    })""")
    require(dimensions["documentWidth"] <= dimensions["innerWidth"] + 1,
            f"Whole-page horizontal overflow: {dimensions}")
    return dimensions


def snapshot(page, folder, state):
    page.screenshot(path=str(folder / f"{state}.png"), full_page=True)
    return {"screenshot": f"{state}.png", "dimensions": geometry(page)}


def storage(page, context):
    return {"cookies": context.cookies(), "service_workers": len(context.service_workers),
            **page.evaluate("""async () => ({
                localStorageKeys: Object.keys(localStorage),
                sessionStorageKeys: Object.keys(sessionStorage),
                indexedDBDatabases: typeof indexedDB.databases === 'function'
                    ? await indexedDB.databases() : null,
                cacheKeys: 'caches' in window ? await caches.keys() : null
            })""")}


def axe_scan(page, axe_source, folder, state):
    # Browser automation evaluation intentionally bypasses the page-script CSP.
    # No CSP directives or document nodes are changed to load this local tool.
    page.evaluate(axe_source)
    result = page.evaluate("""async () => {
        const r = await axe.run(document, {
            runOnly: {type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice']}
        });
        return {testEngine: r.testEngine, testRunner: r.testRunner,
            testEnvironment: r.testEnvironment, timestamp: r.timestamp, url: r.url,
            toolOptions: r.toolOptions, violations: r.violations, incomplete: r.incomplete,
            passes: r.passes, inapplicable: r.inapplicable};
    }""")
    write_json(folder / f"axe-{state}.json", result)
    blocking = [item for item in result["violations"]
                if item.get("impact") in ("serious", "critical")]
    summary = {"file": f"axe-{state}.json", "version": result["testEngine"]["version"],
               "violations": len(result["violations"]),
               "incomplete": len(result["incomplete"]),
               "blocking": [{"id": item["id"], "impact": item["impact"],
                             "nodes": len(item["nodes"])} for item in blocking]}
    require(not blocking, f"Serious/critical axe violations; inspect {summary}")
    return summary


def verify_accessibility(page, expect):
    labels = {}
    for selector, label in (("#csv-file", "Open a CSV file"),
                            ("#column-select", "2. Select numeric column"),
                            ("#bin-select", "Histogram groups")):
        expect(page.get_by_label(label, exact=False)).to_have_count(1)
        labels[selector] = page.locator(selector).evaluate(
            "el => Array.from(el.labels || [], x => x.textContent.trim())")
        require(labels[selector], f"Missing associated label on {selector}")
    captions = ("Grouped frequency distribution", "Ogive coordinates and cumulative counts",
                "Box plot quartiles, fences, whiskers and outliers", "First ten CSV observations")
    for caption in captions:
        expect(page.get_by_role("table", name=caption, exact=True)).to_have_count(1)
    expect(page.locator("table th:not([scope='col'])")).to_have_count(0)
    titles = ("Histogram of valid observations", "Less-than cumulative-frequency ogive",
              "Horizontal Tukey-style box plot")
    expect(page.get_by_role("img")).to_have_count(3)
    for title in titles:
        chart = page.get_by_role("img", name=re.compile(re.escape(title)))
        expect(chart).to_have_count(1)
        expect(chart.locator("title")).not_to_be_empty()
        expect(chart.locator("desc")).not_to_be_empty()
        refs = chart.evaluate(r"""el => el.getAttribute('aria-labelledby').split(/\s+/)
            .map(id => ({id, present: !!document.getElementById(id),
                        text: document.getElementById(id)?.textContent}))""")
        require(all(item["present"] and item["text"] for item in refs),
                f"Broken SVG accessible-name references: {refs}")
    expect(page.locator("#status")).to_have_attribute("role", "status")
    expect(page.locator("#status")).to_have_attribute("aria-live", "polite")
    expect(page.locator("#workspace")).to_have_attribute("aria-busy", "false")
    return {"labels": labels, "table_names": list(captions), "chart_title_prefixes": list(titles)}


def save_exports(page, folder):
    download_folder = folder / "downloads"
    download_folder.mkdir()
    saved = []
    for kind in EXPORTS:
        with page.expect_download() as pending:
            page.locator(f'button[data-export="{kind}"]').click()
        download = pending.value
        target = download_folder / Path(download.suggested_filename).name
        download.save_as(str(target))
        require(download.failure() is None, f"{kind} download failed")
        payload = target.read_bytes()
        require(len(payload) > 25, f"{kind} is empty or implausibly small")
        item = {"kind": kind, "file": str(target.relative_to(folder)),
                "suggested_filename": download.suggested_filename,
                "bytes": len(payload), "sha256": hashlib.sha256(payload).hexdigest()}
        # Persist each successful download before a later export can fail.
        saved.append(item)
        write_json(folder / "downloads.json", saved)
        if kind == "manifest":
            document = json.loads(payload)
            require(document["source"]["sha256"] == SYNTHETIC_HASH,
                    f"Manifest hash mismatch: {document['source']}")
            require(document["source"]["bytes"] == len(SYNTHETIC), "Manifest source size mismatch")
            require(document["source"]["name"] == "ds13-synthetic.csv", "Wrong source file in manifest")
            require(document["dataQuality"]["valid"] == 10, "Manifest valid count mismatch")
            require(document["computed"]["ogive"][-1]["cumulative"] == 10, "Ogive count mismatch")
            require(abs(document["computed"]["summary"]["mean"] - 23.4) < 1e-12,
                    "Manifest mean mismatch")
            require(document["frequency"]["actualBins"] == 5, "Manifest bin count mismatch")
        elif kind.endswith("-svg"):
            svg = ET.fromstring(payload)
            require(svg.tag == "{http://www.w3.org/2000/svg}svg", "Invalid SVG root")
            require(svg.find("{http://www.w3.org/2000/svg}title") is not None, "SVG title missing")
            require(svg.find("{http://www.w3.org/2000/svg}desc") is not None, "SVG description missing")
        else:
            rows = list(csv.reader(io.StringIO(payload.decode("utf-8"))))
            require(len(rows) > 1, f"No data rows in {kind} export")
            require(all(len(row) == len(rows[0]) for row in rows), "Ragged export CSV")
            if kind == "summary":
                require(dict(rows[1:])["source_sha256"] == SYNTHETIC_HASH, "Summary hash mismatch")
            if kind == "frequency":
                require(sum(int(row[4]) for row in rows[1:]) == 10, "Exported bin totals mismatch")
    require(len(saved) == 8, "Not all eight exports were saved")
    return {"count": len(saved), "source_sha256": SYNTHETIC_HASH, "files": saved}


def inline_csp_probe(page):
    result = page.evaluate("""async () => {
        window.__ds13InlineRan = false;
        const events = [];
        let finish;
        const arrived = new Promise(resolve => { finish = resolve; });
        const listener = event => {
            events.push({blockedURI: event.blockedURI,
                effectiveDirective: event.effectiveDirective,
                violatedDirective: event.violatedDirective,
                disposition: event.disposition, originalPolicy: event.originalPolicy});
            if (event.blockedURI === 'inline') finish();
        };
        document.addEventListener('securitypolicyviolation', listener);
        const script = document.createElement('script');
        script.textContent = 'window.__ds13InlineRan = true;';
        document.body.appendChild(script);
        await Promise.race([arrived, new Promise(resolve => setTimeout(resolve, 1500))]);
        script.remove();
        document.removeEventListener('securitypolicyviolation', listener);
        return {executed: window.__ds13InlineRan, events};
    }""")
    require(not result["executed"], f"Inline script unexpectedly executed: {result}")
    require(any(event["blockedURI"] == "inline" and event["disposition"] == "enforce"
                and event["effectiveDirective"].startswith("script-src") for event in result["events"]),
            f"No enforcing inline-script CSP violation was observed: {result}")
    return result


def run_scenario(browser, url, label, width, height, output, axe_source, expect):
    folder = output / f"{label}-{width}"
    folder.mkdir()
    context = browser.new_context(viewport={"width": width, "height": height},
                                  device_scale_factor=1, locale="en-US", accept_downloads=True)
    page = context.new_page()
    page.set_default_timeout(15000)
    phase = ["navigation"]
    requests, responses, failed_requests, console, page_errors, dialogs = [], [], [], [], [], []
    checks = Checks()
    result = {"url": url, "viewport": {"width": width, "height": height},
              "started_at": utc_now(), "evidence_directory": str(folder),
              "checks": checks.items, "caveat": CAVEAT}

    def request_seen(request):
        requests.append({"at": utc_now(), "phase": phase[0], "url": request.url,
                         "method": request.method, "resource_type": request.resource_type})

    def response_seen(response):
        responses.append({"at": utc_now(), "phase": phase[0], "url": response.url,
                          "status": response.status})

    def dialog_seen(dialog):
        dialogs.append({"phase": phase[0], "type": dialog.type, "message": dialog.message})
        dialog.dismiss()

    page.on("request", request_seen)
    page.on("response", response_seen)
    page.on("requestfailed", lambda request: failed_requests.append(
        {"phase": phase[0], "url": request.url, "failure": request.failure}))
    page.on("console", lambda message: console.append(
        {"phase": phase[0], "type": message.type, "text": message.text, "location": message.location}))
    page.on("pageerror", lambda error: page_errors.append({"phase": phase[0], "message": str(error)}))
    page.on("dialog", dialog_seen)

    def upload(name, payload):
        page.locator("#csv-file").set_input_files(
            {"name": name, "mimeType": "text/csv", "buffer": payload})
        expect(page.locator("#status")).to_contain_text(f"Loaded {name}:")
        expect(page.locator("#workspace")).to_have_attribute("aria-busy", "false")

    def empty_storage():
        value = storage(page, context)
        require(not any(value.values()), f"Unexpected persisted state: {value}")
        return value

    def navigation():
        require(not context.cookies(), "New context unexpectedly contains cookies")
        response = page.goto(url, wait_until="load", timeout=30000)
        require(response is not None and response.ok, "HTTP navigation did not return a successful response")
        require(urlsplit(page.url).scheme in ("http", "https"), "Not a real HTTP(S) origin")
        expect(page.locator("#status")).to_contain_text("Ready to analyze")
        state = page.evaluate("""() => ({url: location.href, origin: location.origin,
            secureContext: isSecureContext, userAgent: navigator.userAgent,
            csp: document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.content,
            scriptSources: Array.from(document.scripts, x => x.src),
            stylesheets: Array.from(document.querySelectorAll('link[rel="stylesheet"]'), x => x.href)
        })""")
        require(state["csp"] and "script-src 'self'" in state["csp"], "Original restrictive meta CSP missing")
        require("'unsafe-inline'" not in state["csp"], "CSP unexpectedly allows inline code")
        require(state["secureContext"], "Secure context required to test the browser SHA-256 export")
        result["environment"] = {**state, "http_status": response.status,
                                  "response_headers": response.all_headers(),
                                  "response_body_sha256": hashlib.sha256(response.body()).hexdigest()}
        result["initial_storage"] = empty_storage()
        return result["environment"]

    def keyboard():
        page.keyboard.press("Tab")
        expect(page.locator(".skip-link")).to_be_focused()
        page.screenshot(path=str(folder / "skip-link-focused.png"), full_page=False)
        page.keyboard.press("Enter")
        expect(page.locator("#main")).to_be_focused()
        page.locator("#sample-scores").focus()
        page.keyboard.press("Enter")
        expect(page.locator("#quality")).to_contain_text("Valid: 10")
        expect(page.locator("#export-controls")).to_be_visible()
        return {"first_tab_stop": "skip-link", "skip_target": "main", "sample_button": "Enter activated"}

    def numeric_import():
        upload("ds13-synthetic.csv", SYNTHETIC)
        expect(page.locator("#quality")).to_contain_text("Valid: 10")
        expect(page.locator("#column-select")).to_have_value("column-0")
        expect(page.locator("#status")).to_contain_text("Source SHA-256 recorded")
        return {"bytes": len(SYNTHETIC), "sha256": SYNTHETIC_HASH}

    def selections():
        for value, rows in (("5", 5), ("10", 10), ("15", 15), ("20", 20), ("auto", 5)):
            page.locator("#bin-select").select_option(value)
            expect(page.locator("#frequency-table tbody tr")).to_have_count(rows)
        page.locator("#column-select").select_option("column-1")
        expect(page.locator("#dataset-meta")).to_contain_text("alternate")
        metric = page.locator(".metric").filter(has=page.locator("dt", has_text=re.compile("^Mean$")))
        expect(metric.locator("dd")).to_have_text("234")
        page.locator("#column-select").select_option("column-2")
        expect(page.locator("#quality")).to_contain_text("Valid: 0")
        expect(page.locator("#statistics")).to_contain_text("No valid numeric values")
        expect(page.locator("#export-controls")).to_be_hidden()
        page.locator("#column-select").select_option("column-0")
        page.locator("#bin-select").select_option("5")
        expect(page.locator("#export-controls")).to_be_visible()
        return {"bins": [5, 10, 15, 20, "auto"], "numeric_column_switch": True,
                "nonnumeric_column_switch": True, "numeric_recovery": True}

    def hostile_import():
        header = '<img src=x onerror="window.__ds13Xss=1">'
        cell = '<svg onload="window.__ds13Xss=2"></svg><script>window.__ds13Xss=3</script>'
        buffer = io.StringIO(newline="")
        writer = csv.writer(buffer)
        writer.writerows([["value", header], [1, cell], [2, '<img src=x onerror="alert(1)">']])
        page.evaluate("window.__ds13Xss = 0")
        upload("ds13-hostile.csv", buffer.getvalue().encode("utf-8"))
        expect(page.locator("#quality")).to_contain_text("Valid: 2")
        expect(page.locator("#preview")).to_contain_text(header)
        expect(page.locator("#preview")).to_contain_text(cell)
        expect(page.locator("#preview img, #preview svg, #preview script")).to_have_count(0)
        require(page.evaluate("window.__ds13Xss") == 0, "Imported markup executed")
        require(not dialogs, f"Unexpected dialogs: {dialogs}")
        return {"headers_and_cells_rendered_as_text": True, **snapshot(page, folder, "hostile-import")}

    def keyboard_tables():
        observations = []
        for target in ("frequency-table", "ogive-table", "boxplot-table", "preview"):
            region = page.locator(f"#{target}")
            region.focus()
            expect(region).to_be_focused()
            overflow = region.evaluate("el => el.scrollWidth > el.clientWidth + 1")
            region.press("ArrowRight")
            if overflow:
                page.wait_for_function("id => document.getElementById(id).scrollLeft > 0", arg=target)
            observations.append({"region": target, "overflow": overflow,
                                 "scrollLeft": region.evaluate("el => el.scrollLeft")})
        return observations

    def nonnumeric_import():
        upload("ds13-nonnumeric.csv", b"name,note\nAlice,hello\nBob,world\n")
        expect(page.locator("#quality")).to_contain_text("Valid: 0")
        expect(page.locator("#statistics")).to_contain_text("No valid numeric values")
        expect(page.locator("#export-controls")).to_be_hidden()
        expect(page.get_by_role("img")).to_have_count(0)
        return snapshot(page, folder, "nonnumeric")

    def malformed_retry():
        # Establish visible valid results first, so error cleanup is exercised.
        upload("ds13-synthetic.csv", SYNTHETIC)
        expect(page.locator("#export-controls")).to_be_visible()
        payload = {"name": "ds13-malformed.csv", "mimeType": "text/csv", "buffer": b'value\n"not closed\n'}
        # Mutation counts prove that the second identical selection invoked the
        # application again instead of merely matching the previous error text.
        page.evaluate("""() => {
            window.__ds13StatusChanges = 0;
            window.__ds13Observer = new MutationObserver(records => {
                window.__ds13StatusChanges += records.length;
            });
            window.__ds13Observer.observe(document.getElementById('status'),
                {childList: true, characterData: true, subtree: true});
        }""")
        attempts = []
        for _ in range(2):
            before = page.evaluate("window.__ds13StatusChanges")
            page.locator("#csv-file").set_input_files(payload)
            page.wait_for_function("before => window.__ds13StatusChanges > before", arg=before)
            expect(page.locator("#status")).to_contain_text("MALFORMED_QUOTE")
            expect(page.locator("#status")).to_have_attribute("role", "alert")
            expect(page.locator("#status")).to_have_attribute("aria-live", "assertive")
            expect(page.locator("#csv-file")).to_have_value("")
            expect(page.locator("#export-controls")).to_be_hidden()
            expect(page.locator("#workspace")).to_have_attribute("aria-busy", "false")
            attempts.append({"status_mutations_before": before,
                             "status_mutations_after": page.evaluate("window.__ds13StatusChanges")})
        page.evaluate("window.__ds13Observer.disconnect()")
        return {"same_file_attempts": attempts, **snapshot(page, folder, "malformed")}

    def recovery():
        page.locator("#sample-ties").click()
        expect(page.locator("#quality")).to_contain_text("Valid: 3")
        expect(page.locator("#quality")).to_contain_text("Missing: 3")
        expect(page.locator("#quality")).to_contain_text("Invalid: 1")
        expect(page.locator("#status")).to_have_attribute("role", "status")
        expect(page.locator("#export-controls")).to_be_visible()
        upload("ds13-synthetic.csv", SYNTHETIC)
        expect(page.locator("#quality")).to_contain_text("Valid: 10")
        expect(page.locator("#export-controls")).to_be_visible()
        return {"sample_and_file_recovery": True, **snapshot(page, folder, "recovery")}

    try:
        if not checks.run("real-origin-navigation-and-fresh-storage", navigation):
            return result
        phase[0] = "application"
        checks.run("keyboard-skip-link-and-sample", keyboard)
        if checks.run("synthetic-file-import-and-secure-hash", numeric_import):
            checks.run("labels-table-and-chart-accessible-names", lambda: verify_accessibility(page, expect))
            checks.run("numeric-column-and-bin-selectors", selections)
            checks.run("scrolling-tables-are-keyboard-accessible", keyboard_tables)
            checks.run("numeric-layout", lambda: snapshot(page, folder, "numeric"))
            phase[0] = "axe-numeric"
            checks.run("axe-numeric-serious-critical-gate", lambda: axe_scan(page, axe_source, folder, "numeric"))
            phase[0] = "downloads"
            checks.run("eight-saved-downloads-and-manifest-sha256", lambda: save_exports(page, folder))
        phase[0] = "application"
        checks.run("untrusted-headers-and-cells", hostile_import)
        checks.run("nonnumeric-file", nonnumeric_import)
        checks.run("malformed-file-and-identical-file-retry", malformed_retry)
        phase[0] = "axe-error"
        checks.run("axe-error-serious-critical-gate", lambda: axe_scan(page, axe_source, folder, "error"))
        phase[0] = "application"
        checks.run("load-recovery", recovery)
        checks.run("storage-remains-empty", empty_storage)
        phase[0] = "csp-negative-test"
        checks.run("csp-blocks-dom-inserted-inline-script", lambda: inline_csp_probe(page))
        phase[0] = "complete"
    except Exception as error:
        checks.items.append({"name": "scenario-execution", "status": "fail", "error": str(error),
                             "traceback": traceback.format_exc()})
    finally:
        def network_check():
            off_origin = [item for item in requests if urlsplit(item["url"]).scheme in ("http", "https")
                          and origin(item["url"]) != origin(url)]
            after_load = [item for item in requests if item["phase"] != "navigation"
                          and urlsplit(item["url"]).scheme in ("http", "https")]
            non_get = [item for item in requests if item["method"] != "GET"]
            http_errors = [item for item in responses if item["status"] >= 400]
            require(not off_origin, f"Outgoing cross-origin requests: {off_origin}")
            require(not after_load, f"Unexpected HTTP(S) requests after load: {after_load}")
            require(not non_get and not failed_requests and not http_errors,
                    f"Network failures: non_get={non_get}, failed={failed_requests}, HTTP={http_errors}")
            return {"request_count": len(requests), "cross_origin_requests": off_origin,
                    "http_requests_after_load": after_load, "observation_end": utc_now()}

        expected_csp_console = [item for item in console if item["phase"] == "csp-negative-test"
                                and re.search(r"content.security.policy|script-src", item["text"], re.I)
                                and re.search(r"inline|refused|violat|blocked", item["text"], re.I)]
        unexpected_errors = [item for item in console if item["type"] == "error"
                             and item not in expected_csp_console]
        checks.run("observed-network-is-local-and-idle-after-load", network_check)
        checks.run("no-unexpected-runtime-console-errors-or-dialogs", lambda: require(
            not page_errors and not unexpected_errors and not dialogs,
            f"Page errors={page_errors}; unexpected console errors={unexpected_errors}; dialogs={dialogs}"))
        diagnostics = {"requests": requests, "responses": responses, "request_failures": failed_requests,
                       "console": console, "expected_csp_negative_test_console": expected_csp_console,
                       "unexpected_console_errors": unexpected_errors, "page_errors": page_errors,
                       "dialogs": dialogs}
        write_json(folder / "network-and-console.json", diagnostics)
        result["finished_at"] = utc_now()
        result["status"] = "fail" if any(item["status"] == "fail" for item in checks.items) else "pass"
        write_json(folder / "result.json", result)
        context.close()
    return result


def parse_args():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--browser", required=True, choices=("chromium", "firefox", "webkit"))
    parser.add_argument("--output", required=True, type=Path, help="New evidence directory for this run")
    parser.add_argument("--site-root", type=Path, default=ROOT, help="Static root; defaults to repository root")
    parser.add_argument("--axe", type=Path, default=ROOT / "node_modules/axe-core/axe.min.js")
    parser.add_argument("--url", help="Use one deployed HTTP(S) page instead of starting a loopback server")
    launch = parser.add_mutually_exclusive_group()
    launch.add_argument("--channel", help="Installed Chromium channel, for example msedge")
    launch.add_argument("--executable", type=Path, help="Browser executable path")
    args = parser.parse_args()
    if args.channel and args.browser != "chromium":
        parser.error("--channel is supported only with --browser chromium")
    if args.url and urlsplit(args.url).scheme not in ("http", "https"):
        parser.error("--url must be an ordinary HTTP(S) URL")
    return args


def main():
    args = parse_args()
    output = args.output.resolve()
    reserved = ["report.json", "server-requests.json", "ds13-synthetic.csv"]
    reserved.extend(f"{label}-{width}" for label in ("root", "project-subpath", "deployed")
                    for width, _height in VIEWPORTS)
    conflicts = [str(output / name) for name in reserved if (output / name).exists()]
    if conflicts:
        print(f"Refusing to overwrite existing evidence artifacts: {conflicts}", file=sys.stderr)
        return 2
    output.mkdir(parents=True, exist_ok=True)
    site_root = args.site_root.resolve()
    report = {"schema": "datasense-real-origin-browser-qa-v1", "started_at": utc_now(),
              "browser_requested": args.browser, "channel": args.channel,
              "executable": str(args.executable.resolve()) if args.executable else None,
              "python": sys.version, "platform": platform.platform(),
              "runner_sha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
              "caveat": CAVEAT, "scenarios": []}
    exit_code = 1
    try:
        from playwright.sync_api import sync_playwright, expect
        report["playwright_version"] = importlib.metadata.version("playwright")
        report["served_source"] = source_inventory(site_root)
        axe_path = args.axe.resolve()
        axe_source = axe_path.read_text(encoding="utf-8")
        report["axe_source"] = {"path": str(axe_path),
                                "sha256": hashlib.sha256(axe_path.read_bytes()).hexdigest()}
        (output / "ds13-synthetic.csv").write_bytes(SYNTHETIC)
        report["synthetic_source"] = {"file": "ds13-synthetic.csv", "bytes": len(SYNTHETIC),
                                      "sha256": SYNTHETIC_HASH}
        with sync_playwright() as playwright:
            launch_options = {"headless": True}
            if args.channel:
                launch_options["channel"] = args.channel
            if args.executable:
                launch_options["executable_path"] = str(args.executable.resolve())
            browser = getattr(playwright, args.browser).launch(**launch_options)
            report["browser_version"] = browser.version
            try:
                def visit(urls):
                    for label, url in urls:
                        for width, height in VIEWPORTS:
                            print(f"RUN {args.browser} {label} {width}x{height} {url}", flush=True)
                            result = run_scenario(browser, url, label, width, height, output, axe_source, expect)
                            report["scenarios"].append(result)
                            write_json(output / "report.json", report)
                            failed = [item["name"] for item in result["checks"] if item["status"] == "fail"]
                            print(f"{result['status'].upper()} {label} {width}: {failed or 'all checks passed'}", flush=True)

                if args.url:
                    report["mode"] = "deployed-origin"
                    report["served_source"]["scope"] = "Local reference snapshot; deployed response hash is recorded per scenario"
                    visit([("deployed", args.url)])
                else:
                    report["mode"] = "loopback-root-and-project-subpath"
                    with static_origin(site_root) as (base, server_log):
                        visit([("root", base + "/"), ("project-subpath", base + SUBPATH)])
                        write_json(output / "server-requests.json", server_log)
            finally:
                browser.close()
        report["status"] = "pass" if report["scenarios"] and all(
            item["status"] == "pass" for item in report["scenarios"]) else "fail"
        exit_code = 0 if report["status"] == "pass" else 1
    except Exception as error:
        report["status"] = "setup-or-run-error"
        report["error"] = str(error)
        report["traceback"] = traceback.format_exc()
        print(f"ERROR: {error}", file=sys.stderr)
    finally:
        report["finished_at"] = utc_now()
        write_json(output / "report.json", report)
    print(f"Evidence: {output / 'report.json'}", flush=True)
    print(CAVEAT, flush=True)
    return exit_code


if __name__ == "__main__":
    raise SystemExit(main())
