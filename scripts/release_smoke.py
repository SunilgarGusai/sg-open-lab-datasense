"""DS-12 browser behavior and keyboard audit via in-memory Chromium assets.

NOTE: local HTTP and file navigation are restricted in the execution environment.
This does not verify deployed security headers, production network traffic, or assistive technology.
"""
import base64
import json
import re
import tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

ROOT=Path(__file__).resolve().parents[1]
CACHE={}

def module_url(path):
    path=path.resolve()
    if path in CACHE:
        return CACHE[path]
    code=path.read_text()
    def replace(match):
        item=match.group(1)
        if not item.startswith('.'):
            raise ValueError(f'Unexpected external module in {path}: {item}')
        return 'from '+json.dumps(module_url(path.parent / item))
    code=re.sub(r'from [\x22\x27]([^\x22\x27]+)[\x22\x27]',replace,code)
    url='data:text/javascript;base64,'+base64.b64encode(code.encode()).decode()
    CACHE[path]=url
    return url

html=(ROOT/'index.html').read_text()
assert 'Content-Security-Policy' in html
html=re.sub(r'<meta http-equiv="Content-Security-Policy"[^>]*>','',html)
html=html.replace('<link rel="stylesheet" href="./styles.css" />','<style>'+(ROOT/'styles.css').read_text()+'</style>')
html=html.replace('<script type="module" src="./dist/app/browser.js"></script>',
                  '<script type="module">import '+json.dumps(module_url(ROOT/'dist/app/browser.js'))+';</script>')

def run(browser,width,height,mobile):
    context=browser.new_context(viewport={'width':width,'height':height},accept_downloads=True,is_mobile=mobile,has_touch=mobile)
    page=context.new_page();errors=[];requests=[]
    page.on('pageerror', lambda e:errors.append(str(e)))
    page.on('request', lambda r:requests.append(r.url))
    page.set_content(html,wait_until='load')
    page.keyboard.press('Tab')
    assert page.evaluate('document.activeElement.classList.contains("skip-link")'),'Skip navigation link not first tab stop'
    page.keyboard.press('Enter')
    assert page.evaluate('document.activeElement.id')=='main','Skip navigation target not focused'
    page.locator('#sample-scores').click()
    page.locator('#export-controls').wait_for(state='visible',timeout=15000)
    assert page.locator('svg[role="img"] title').count()==3
    assert page.locator('svg[role="img"] desc').count()==3
    assert page.locator('table caption').count()==4
    assert page.locator('table th[scope="col"]').count()>0
    assert page.locator('#workspace').get_attribute('aria-busy')=='false'
    assert page.locator('#status').get_attribute('role')=='status'
    assert 'Valid: 10' in page.locator('#quality').inner_text()
    page.locator('#bin-select').select_option('5')
    assert page.locator('#frequency-table tbody tr').count()==5
    for k in ('summary','frequency','ogive','boxplot','manifest','histogram-svg','ogive-svg','boxplot-svg'):
        with page.expect_download() as result:page.locator(f'button[data-export="{k}"]').click()
        download=result.value
        with tempfile.TemporaryDirectory() as folder:
            dest=Path(folder)/download.suggested_filename
            download.save_as(dest)
            assert dest.stat().st_size>25
            if k=='manifest':
                doc=json.loads(dest.read_text())
                assert doc['dataQuality']['valid']==10
                assert doc['computed']['ogive'][-1]['cumulative']==10
    malicious='value,"<img src=x onerror=alert(1)>"\n1,safe\n2,hello\n'
    page.locator('#csv-file').set_input_files({'name':'danger.csv','mimeType':'text/csv','buffer':malicious.encode()})
    expect(page.locator('#quality')).to_contain_text('Valid: 2')
    assert page.locator('#preview img').count()==0
    assert '<img src=x' in page.locator('#preview').inner_text()
    bad=b'value\n"not closed\n'
    page.locator('#csv-file').set_input_files({'name':'bad.csv','mimeType':'text/csv','buffer':bad})
    expect(page.locator('#status')).to_contain_text('MALFORMED_QUOTE')
    assert page.locator('#status').get_attribute('role')=='alert'
    assert page.locator('#csv-file').input_value()==''
    assert page.locator('#export-controls').is_hidden()
    page.locator('#csv-file').set_input_files({'name':'bad.csv','mimeType':'text/csv','buffer':bad})
    assert page.locator('#status').get_attribute('role')=='alert'
    page.locator('#sample-ties').click()
    assert page.locator('#status').get_attribute('role')=='status'
    expect(page.locator('#quality')).to_contain_text('Valid: 3')
    assert page.evaluate('document.documentElement.scrollWidth<=window.innerWidth+2'),'Horizontal viewport overflow'
    assert not requests, f'Unexpected external requests: {requests}'
    assert not errors, f'Runtime errors: {errors}'
    if width in (1280,390):
        path=ROOT/'docs'/'previews'/f'v04-{width}.png'
        page.screenshot(path=str(path),full_page=True)
    context.close()
    print(f'PASS viewport={width}x{height}, keyboard, DOM-XSS, 8 exports, accessible tables, error recovery, no network')

if __name__ == '__main__':
    with sync_playwright() as p:
        browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
        for args in [(1280,900,False),(390,844,True),(320,740,True)]:run(browser,*args)
        browser.close()
    print('IN-MEMORY CHROMIUM SMOKE PASSED; deployed-origin/assistive-tech testing still REQUIRED.')
