"""Isolate native-select CSP diagnostics using a real loopback HTTP origin.

Run separately in a pinned Playwright environment, e.g.:
  python probe_select_csp.py --browser webkit --output probe-webkit-164

Static fixtures use a same-origin external collector before form controls are
parsed. Additional phases isolate keyboard/focus/click, default and initial-caret
screenshots, local axe, and unmodified DataSense. No request routing,
set_content, CSP changes, or init scripts are used. All diagnostics are retained.
"""
import argparse
import hashlib
import importlib.metadata
import json
import platform
import re
import threading
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


CSP = ("default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; "
       "connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'")
CASES = {
    "plain-text": ("<p>Plain text control</p>", False),
    "text-input": ('<label>Text <input type="text"></label>', False),
    "range-input": ('<label>Range <input type="range"></label>', False),
    "date-input": ('<label>Date <input type="date"></label>', False),
    "one-select": ('<label>One <select><option>a</option><option>b</option></select></label>', False),
    "two-selects": ('<select aria-label="One"><option>a</option></select>'
                    '<select aria-label="Two"><option>b</option></select>', False),
    "dynamic-select": ('<div id="target"></div><script src="dynamic.js"></script>', False),
    "genuine-inline-attribute": ('<p style="color:rgb(255,0,0)">Intentional style attribute</p>', True),
    "genuine-style-element": ('<style>p{color:rgb(255,0,0)}</style><p>Intentional style element</p>', True),
}
COLLECTOR = """window.probeViolations = []; window.probeMutations = [];
window.probePhase = 'navigation';
document.addEventListener('securitypolicyviolation', e => {
  window.probeViolations.push({
    phase:window.probePhase,
    blockedURI:e.blockedURI, effectiveDirective:e.effectiveDirective,
    violatedDirective:e.violatedDirective, disposition:e.disposition,
    sourceFile:e.sourceFile, lineNumber:e.lineNumber, columnNumber:e.columnNumber,
    sample:e.sample, originalPolicy:e.originalPolicy,
    target:e.target.nodeName, targetMarkup:e.target.outerHTML || null
  });
});
new MutationObserver(records => {
  for (const record of records) {
    for (const node of record.addedNodes) {
      if (node.nodeName === 'STYLE') window.probeMutations.push({
        phase:window.probePhase, kind:'style-element-added', text:node.textContent
      });
    }
    if (record.type === 'attributes') window.probeMutations.push({
      phase:window.probePhase, kind:'style-attribute-changed',
      tag:record.target.tagName, value:record.target.getAttribute('style')
    });
  }
}).observe(document, {subtree:true, childList:true, attributes:true, attributeFilter:['style']});
"""
DYNAMIC = """const select = document.createElement('select');
select.setAttribute('aria-label', 'Dynamically created select');
for (const label of ['a','b']) {
  const option = document.createElement('option'); option.textContent = label;
  select.append(option);
}
document.getElementById('target').append(select);
"""


class Handler(SimpleHTTPRequestHandler):
    extensions_map = {**SimpleHTTPRequestHandler.extensions_map, '.js': 'text/javascript'}

    def __init__(self, *args, app_root=None, **kwargs):
        self.app_root = app_root
        super().__init__(*args, **kwargs)

    def do_GET(self):
        original_directory, original_path = self.directory, self.path
        if self.app_root and self.path.startswith('/app/'):
            self.directory = str(self.app_root)
            self.path = '/' + self.path[len('/app/'):]
        try:
            super().do_GET()
        finally:
            self.directory, self.path = original_directory, original_path

    def log_message(self, *_args):
        pass


def main():
    root = Path(__file__).resolve().parents[1]
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--browser', required=True, choices=['chromium', 'firefox', 'webkit'])
    parser.add_argument('--output', required=True, type=Path)
    parser.add_argument('--site-root', type=Path, default=root / '_site',
                        help='Unmodified DataSense static root; defaults to repository _site')
    parser.add_argument('--axe', type=Path, default=root / 'node_modules/axe-core/axe.min.js',
                        help='Local axe-core script; defaults to pinned repository dependency')
    launcher = parser.add_mutually_exclusive_group()
    launcher.add_argument('--channel')
    launcher.add_argument('--executable', type=Path)
    args = parser.parse_args()
    output = args.output.resolve()
    if (output / 'report.json').exists() or (output / 'served-fixtures').exists():
        parser.error('Choose new evidence artifacts; existing run.log is allowed')
    if args.channel and args.browser != 'chromium':
        parser.error('--channel is only supported for chromium')
    if not (args.site_root / 'index.html').is_file():
        parser.error(f'Staged application is missing: {args.site_root / "index.html"}')
    if not args.axe.is_file():
        parser.error(f'Local axe dependency is missing: {args.axe}')
    output.mkdir(parents=True, exist_ok=True)
    fixtures = output / 'served-fixtures'
    fixtures.mkdir()
    (fixtures / 'collector.js').write_text(COLLECTOR, encoding='utf-8')
    (fixtures / 'dynamic.js').write_text(DYNAMIC, encoding='utf-8')
    (fixtures / 'actions.js').write_text("""
document.getElementById('button').addEventListener('click', () => {
  document.getElementById('count').textContent = String(Number(document.getElementById('count').textContent) + 1);
});
window.replaceOptions = () => {
  const select = document.getElementById('select'); select.replaceChildren();
  for (const label of ['first','second','third']) {
    const option = document.createElement('option'); option.value = label; option.textContent = label;
    select.append(option);
  }
};
""", encoding='utf-8')
    fixture_cases = dict(CASES)
    fixture_cases['interaction-controls'] = (
        '<a id="skip" href="#main">Skip</a><main id="main" tabindex="-1">'
        '<button id="button">Increment</button><p id="count">0</p>'
        '<label>Text<input id="text"></label><label>File<input id="file" type="file"></label>'
        '<label>Selection<select id="select"><option>a</option><option>b</option></select></label>'
        '</main><script src="actions.js"></script>', False)
    for name, (body, _intentional_violation) in fixture_cases.items():
        html = ('<!doctype html>\n<html lang="en"><head>\n<meta charset="utf-8">\n'
                f'<meta http-equiv="Content-Security-Policy" content="{CSP}">\n'
                f'<title>{name}</title>\n<script src="collector.js"></script>\n'
                f'</head><body>\n{body}\n</body></html>\n')
        (fixtures / f'{name}.html').write_text(html, encoding='utf-8')

    from playwright.sync_api import sync_playwright
    report = {'purpose': 'native-select and screenshot CSP isolation', 'status': 'incomplete',
              'playwright': importlib.metadata.version('playwright'), 'platform': platform.platform(),
              'browser': args.browser, 'channel': args.channel, 'csp': CSP, 'cases': [], 'checks': [],
              'upstream_issue': 'https://github.com/microsoft/playwright/issues/43497',
              'screenshot_source': 'https://github.com/microsoft/playwright/blob/v1.63.0/packages/playwright-core/src/server/screenshotter.ts',
              'webkit_delegate_source': 'https://github.com/microsoft/playwright/blob/v1.63.0/packages/playwright-core/src/server/webkit/wkPage.ts',
              'limitations': 'Does not establish behavior of released Safari or every WebKit build.'}
    server = ThreadingHTTPServer(('127.0.0.1', 0), partial(
        Handler, directory=str(fixtures), app_root=args.site_root.resolve() if args.site_root else None))
    worker = threading.Thread(target=server.serve_forever, daemon=True)
    worker.start()
    try:
        with sync_playwright() as playwright:
            launch = {'headless': True}
            if args.channel:
                launch['channel'] = args.channel
            if args.executable:
                launch['executable_path'] = str(args.executable.resolve())
            browser = getattr(playwright, args.browser).launch(**launch)
            report['browser_version'] = browser.version
            try:
                def inspect(name, intentional=False, app=False):
                    context = browser.new_context()
                    page = context.new_page()
                    console, errors, requests = [], [], []
                    phase = ['navigation']
                    page.on('console', lambda m: console.append(
                        {'phase': phase[0], 'type': m.type, 'text': m.text, 'location': m.location}))
                    page.on('pageerror', lambda e: errors.append({'phase': phase[0], 'message': str(e)}))
                    page.on('request', lambda r: requests.append({'url': r.url, 'method': r.method}))
                    suffix = 'app/' if app else f'{name}.html'
                    url = f'http://127.0.0.1:{server.server_port}/{suffix}'
                    response = page.goto(url, wait_until='load')
                    if app:
                        # Observer only, installed after unmodified app navigation.
                        # No DOM changes or app/module replacements are performed.
                        page.evaluate(COLLECTOR)
                    page.wait_for_timeout(250)
                    operations = []
                    baseline = {'console': list(console), 'page_errors': list(errors),
                                'violations': page.evaluate('window.probeViolations')}

                    def step(label, action):
                        phase[0] = label
                        page.evaluate('label => window.probePhase = label', label)
                        before = len(console)
                        violation_count = page.evaluate('window.probeViolations.length')
                        mutation_count = page.evaluate('window.probeMutations.length')
                        action()
                        page.wait_for_timeout(150)
                        record = {'name': label, 'console': console[before:],
                                  'violations': page.evaluate('window.probeViolations')[violation_count:],
                                  'mutations': page.evaluate('window.probeMutations')[mutation_count:]}
                        operations.append(record)
                        return record

                    if name == 'interaction-controls':
                        step('keyboard-tab', lambda: page.keyboard.press('Tab'))
                        step('keyboard-enter-skip', lambda: page.keyboard.press('Enter'))
                        step('locator-focus', lambda: page.locator('#button').focus())
                        step('keyboard-enter-button', lambda: page.keyboard.press('Enter'))
                        step('locator-click', lambda: page.locator('#button').click())
                        step('select-option', lambda: page.locator('#select').select_option('b'))
                        step('replace-options', lambda: page.evaluate('window.replaceOptions()'))
                        step('set-input-files', lambda: page.locator('#file').set_input_files(
                            {'name': 'synthetic.csv', 'mimeType': 'text/csv', 'buffer': b'x\n1\n2\n'}))
                        if args.axe:
                            source = args.axe.read_text(encoding='utf-8')
                            step('axe-evaluate-and-scan', lambda: (page.evaluate(source), page.evaluate(
                                'async () => { const r = await axe.run(document); return {violations:r.violations.length,incomplete:r.incomplete.length}; }')))
                    if app:
                        step('app-sample-before-screenshot', lambda: (
                            page.locator('#sample-scores').click(),
                            page.locator('#export-controls').wait_for(state='visible')))
                    before_screenshots = {'console': list(console), 'page_errors': list(errors),
                                          'violations': page.evaluate('window.probeViolations'),
                                          'mutations': page.evaluate('window.probeMutations')}
                    if name == 'plain-text' or app:
                        step('screenshot-default', lambda: page.screenshot(path=str(output / f'{name}-default.png')))
                        step('screenshot-caret-initial', lambda: page.screenshot(
                            path=str(output / f'{name}-initial.png'), caret='initial', animations='allow'))
                    state = page.evaluate("""() => ({
                      url: location.href, origin: location.origin, secureContext:isSecureContext,
                      violations: window.probeViolations,
                      authorStyleElements: document.querySelectorAll('style').length,
                      authorStyleAttributes: document.querySelectorAll('[style]').length,
                      stylesheetCount: document.styleSheets.length,
                      selectCount: document.querySelectorAll('select').length,
                      bodyMarkup: document.body.innerHTML,
                      csp: document.querySelector('meta[http-equiv="Content-Security-Policy"]').content
                    })""")
                    state.update({'name': name, 'intentional_style_violation': intentional,
                                  'operations': operations, 'app_collector_after_navigation': app,
                                  'navigation_baseline': baseline, 'before_screenshots': before_screenshots,
                                  'http_status': response.status, 'console': list(console),
                                  'page_errors': list(errors), 'requests': list(requests),
                                  'response_sha256': hashlib.sha256(response.body()).hexdigest()})
                    report['cases'].append(state)
                    context.close()
                    print(f"{name}: {len(state['violations'])} CSP events, "
                          f"{sum(m['type'] == 'error' for m in console)} console errors", flush=True)

                for name, (_body, intentional) in fixture_cases.items():
                    inspect(name, intentional)
                if args.site_root:
                    inspect('datasense-unmodified', app=True)

                def check(name, condition, details):
                    report['checks'].append({'name': name, 'status': 'pass' if condition else 'fail', 'details': details})

                for case in report['cases']:
                    check(f"{case['name']}-no-page-errors", not case['page_errors'], case['page_errors'])
                    check(f"{case['name']}-csp-unchanged", case['csp'] == CSP, case['csp'])
                    before_errors = [m for m in case['console'] if m['type'] == 'error' and not m['phase'].startswith('screenshot-')]
                    if not case['intentional_style_violation']:
                        check(f"{case['name']}-clean-before-screenshots", not before_errors, before_errors)
                    else:
                        check(f"{case['name']}-genuine-violation-observed", bool(before_errors), before_errors)
                    for operation in case['operations']:
                        if not operation['name'].startswith('screenshot-'):
                            continue
                        failures = [m for m in operation['console'] if m['type'] == 'error']
                        if args.browser == 'webkit':
                            sync_styles = [m for m in operation['mutations']
                                           if m['kind'] == 'style-element-added' and m['text'].strip() == 'body {}']
                            expected = (len(failures) == 1 and bool(sync_styles)
                                        and bool(re.search(r'Refused to apply a stylesheet.*style-src', failures[0]['text']))
                                        and len(operation['violations']) == 1
                                        and operation['violations'][0]['effectiveDirective'].startswith('style-src'))
                            check(f"{case['name']}-{operation['name']}-isolates-tool-stylesheet", expected, operation)
                        else:
                            check(f"{case['name']}-{operation['name']}-no-errors", not failures, operation)
            finally:
                browser.close()
        select_cases = [case for case in report['cases'] if case['name'] in CASES and case['selectCount']]
        control_cases = [case for case in report['cases']
                         if case['name'] in CASES and not case['selectCount'] and not case['intentional_style_violation']]
        report['select_only_regression_signature_observed'] = (
            all(not case['navigation_baseline']['violations'] for case in control_cases)
            and all(case['navigation_baseline']['violations'] for case in select_cases)
            and all(case['authorStyleElements'] == case['authorStyleAttributes'] == 0 for case in select_cases))
        report['status'] = 'pass' if all(c['status'] == 'pass' for c in report['checks']) else 'fail'
    except Exception as error:
        report['error'] = str(error)
        raise
    finally:
        server.shutdown()
        server.server_close()
        worker.join(timeout=5)
        (output / 'report.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
    return 0 if report['status'] == 'pass' else 1


if __name__ == '__main__':
    raise SystemExit(main())

