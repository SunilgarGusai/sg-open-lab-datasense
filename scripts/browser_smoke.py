"""Chromium in-memory compiled-module smoke test. Does not prove HTTP deployment or real browser origin privacy."""
import base64, json, re, tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
CACHE={}

def module_url(path):
    path=path.resolve()
    if path in CACHE:return CACHE[path]
    code=path.read_text()
    def replace(match):
        item=match.group(1)
        if not item.startswith('.'):
            raise ValueError(f'Nonlocal dependency in {path}: {item}')
        return 'from '+json.dumps(module_url(path.parent / item))
    code=re.sub(r'from [\x22\x27]([^\x22\x27]+)[\x22\x27]',replace,code)
    url='data:text/javascript;base64,'+base64.b64encode(code.encode()).decode()
    CACHE[path]=url
    return url

html=(ROOT/'index.html').read_text()
html=re.sub(r'<meta http-equiv="Content-Security-Policy"[^>]*>', '', html)
html=html.replace('<link rel="stylesheet" href="./styles.css" />','<style>'+(ROOT/'styles.css').read_text()+'</style>')
html=html.replace('<script type="module" src="./dist/app/browser.js"></script>',
                  '<script type="module">import '+json.dumps(module_url(ROOT/'dist/app/browser.js'))+';</script>')

def run_page(browser, viewport,device=False):
    context=browser.new_context(viewport=viewport,accept_downloads=True,is_mobile=device,has_touch=device)
    page=context.new_page()
    errors=[];requests=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('request',lambda r:requests.append(r.url))
    page.set_content(html,wait_until='load')
    page.locator('#sample-scores').click()
    page.locator('#export-controls').wait_for(state='visible',timeout=15000)
    assert page.locator('#frequency-chart svg').count()==1
    assert page.locator('#boxplot-chart svg').count()==1
    assert page.locator('#ogive-chart svg').count()==1
    assert page.locator('#ogive-table tbody tr').count()>=2
    assert page.locator('#boxplot-table tbody tr').count()==9
    assert page.locator('svg[role="img"]').count()==3
    assert 'Valid: 10' in page.locator('#quality').inner_text()
    page.locator('#bin-select').select_option('5')
    assert page.locator('#frequency-table tbody tr').count()==5
    for kind,expected in [('summary','sample_variance'),('frequency','cumulative_frequency'),
                          ('ogive','cumulative_percent'),('boxplot','outlier_count'),('manifest','sg-datasense-analysis-v1'),
                          ('histogram-svg','Histogram'),('ogive-svg','Cumulative frequency'),('boxplot-svg','box plot')]:
        with page.expect_download() as event:page.locator(f'button[data-export="{kind}"]').click()
        file=event.value
        with tempfile.TemporaryDirectory() as d:
            loc=Path(d)/file.suggested_filename;file.save_as(loc);contents=loc.read_text()
            assert expected.lower() in contents.lower(),f'{kind} missing expected content {expected}'
            if kind=='manifest':
                m=json.loads(contents)
                assert m['dataQuality']['valid']==10
                assert len(m['computed']['bins'])==5
                assert m['computed']['ogive'][-1]['cumulative']==10
                assert m['source']['sha256'] is None,'about:blank does not provide browser crypto.subtle'
    path=ROOT/'docs'/'previews'/('v03-mobile.png' if device else 'v03-desktop.png')
    page.screenshot(path=str(path),full_page=True)
    dims=page.evaluate('({width:document.documentElement.scrollWidth,viewport:window.innerWidth})')
    assert dims['width']<=dims['viewport']+2,f'page overflows {dims}'
    assert not requests,f'unexpected network access {requests}'
    assert not errors,errors
    page.locator('#csv-file').set_input_files({'name':'stats.csv','mimeType':'text/csv','buffer':b'A,A,B\n1,2,x\n2,NA,y\n'})
    page.locator('#export-controls').wait_for(state='visible')
    assert 'A (2)' in page.locator('#column-select').inner_text()
    page.locator('#column-select').select_option('column-1')
    assert 'Valid: 1' in page.locator('#quality').inner_text()
    page.locator('#csv-file').set_input_files({'name':'bad.csv','mimeType':'text/csv','buffer':b'A,B\n"not closed,42'})
    page.locator('#results').wait_for(state='hidden')
    assert 'MALFORMED_QUOTE' in page.locator('#status').inner_text()
    assert page.locator('#export-controls').is_hidden()
    assert not errors,errors
    context.close();return str(path)

with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
    print('DESKTOP PASS',run_page(browser,{'width':1440,'height':940}))
    print('MOBILE PASS',run_page(browser,{'width':390,'height':844},True))
    browser.close()
