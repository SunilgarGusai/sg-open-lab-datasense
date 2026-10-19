"""DS-12 browser workload observation (in-memory assets, not HTTP-origin validation)."""
import json,time
from playwright.sync_api import sync_playwright
from release_smoke import html
rows=50_000;columns=8
head=','.join(f'x{i}' for i in range(columns))+'\n'
csv=head+'\n'.join(','.join(str((i*17+j*19)%7000) for j in range(columns)) for i in range(rows))+'\n'
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=b.new_page(viewport={'width':390,'height':844})
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.set_content(html,wait_until='load')
    start=time.perf_counter()
    page.locator('#csv-file').set_input_files({'name':'large.csv','mimeType':'text/csv','buffer':csv.encode()})
    page.locator('#export-controls').wait_for(state='visible',timeout=30_000)
    ms=round((time.perf_counter()-start)*1000)
    assert 'Valid: 50000' in page.locator('#quality').inner_text()
    assert page.locator('svg[role=img]').count()==3
    page.locator('#column-select').select_option('column-7')
    assert 'Valid: 50000' in page.locator('#quality').inner_text()
    assert not errors,errors
    print(json.dumps({'view':'Chromium mobile-sized in-memory','rows':rows,'columns':columns,'bytes':len(csv.encode()),'load_and_render_wall_ms':ms,'three_charts':True,'column_switch':True,'page_errors':len(errors),'caveat':'single run, container performance only; not general phone SLA'},indent=2))
    b.close()
