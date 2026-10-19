import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseCsvText, parseCsvBytes, CsvImportError, CSV_LIMITS,
  profileCsvColumns, getColumnById, summarize, buildFrequency
} from '../dist/index.js';

function raises(code,fn) { assert.throws(fn,(e)=>e instanceof CsvImportError && e.code===code, code); }

// Named gate tests from the canonical SG Open Lab validation matrix.
test('DS-T017: quoted thousands separator remains invalid numeric input',()=>{
  const d=parseCsvText('amount,label\n"1,234",a\n5,b');
  const p=getColumnById(d,'column-0');
  assert.deepEqual([p.numeric.validCount,p.numeric.invalidCount],[1,1]);
  assert.deepEqual(p.numeric.values,[5]);
});
test('DS-T018: UTF-8 BOM + non-ASCII content remains intact',()=>{
  const bytes=new TextEncoder().encode('\uFEFFscore,city\r\n12,Rājkot\r\n20,અમદાવાદ\r\n');
  const d=parseCsvBytes(bytes);
  assert.equal(d.headers[0].display,'score');
  assert.equal(d.rows[0][1],'Rājkot');
  assert.equal(d.rows[1][1],'અમદાવાદ');
});
test('DS-T019: RFC-style quoted commas, quotes and multiline fields',()=>{
  const d=parseCsvText('"score, final",note\r\n7,"said ""hello"""\r\n8,"line one\nline two"\r\n');
  assert.equal(d.headers[0].display,'score, final');
  assert.deepEqual(d.rows,[['7','said "hello"'],['8','line one\nline two']]);
});
test('DS-T020: case-insensitive duplicate header labels retain unique IDs',()=>{
  const d=parseCsvText('x,X,x\n1,2,3');
  assert.deepEqual(d.headers.map(h=>h.id),['column-0','column-1','column-2']);
  assert.deepEqual(d.headers.map(h=>h.display),['x','X (2)','x (3)']);
  assert.equal(d.warnings.length,1);
  assert.deepEqual(getColumnById(d,'column-1').numeric.values,[2]);
});
test('DS-T021: malformed quotes reject with actionable errors',()=>{
  raises('MALFORMED_QUOTE',()=>parseCsvText('x\n"open'));
  raises('MALFORMED_QUOTE',()=>parseCsvText('x\n"done"stuff'));
  raises('UNEXPECTED_QUOTE',()=>parseCsvText('x\nab"cd'));
  raises('FIELD_COUNT_MISMATCH',()=>parseCsvText('a,b\n3'));
});
test('DS-T022: header-only CSV yields zero observations',()=>{
  const d=parseCsvText('score\n');
  assert.equal(d.totalRows,0);
  assert.equal(getColumnById(d,'column-0').numeric.validCount,0);
  assert.equal(summarize([]).mean,null);
});
test('DS-T023: do not auto-convert nonnumeric columns',()=>{
  const d=parseCsvText('name,score\nAlice,20\nBob,21\nCarol,22');
  const p=profileCsvColumns(d);
  assert.deepEqual(p.map(x=>x.eligible),[false,true]);
  assert.deepEqual(p[1].numeric.values,[20,21,22]);
  assert.equal(p[0].numeric.invalidCount,3);
});
test('DS-T024: file size guard applies before decode and on text API',()=>{
  const bytes=new Uint8Array(CSV_LIMITS.maxBytes+1);
  raises('FILE_TOO_LARGE',()=>parseCsvBytes(bytes));
  raises('FILE_TOO_LARGE',()=>parseCsvText('x\n1',CSV_LIMITS.maxBytes+1));
});
test('DS-T025: 50,001 data rows are rejected, 50k accepted',()=>{
  const data='value\n'+'1\n'.repeat(50_000);
  assert.equal(parseCsvText(data).totalRows,50_000);
  raises('ROW_LIMIT',()=>parseCsvText(data+'1\n'));
});
test('DS-T039: only missing values return no eligible numeric column',()=>{
  const d=parseCsvText('score\n\nNA\n-');
  const p=getColumnById(d,'column-0');
  assert.deepEqual([p.numeric.validCount,p.numeric.missingCount,p.numeric.invalidCount],[0,3,0]);
  assert.equal(p.eligible,false);
});
test('strict UTF-8 decoder rejects corrupt bytes and empty/headerless content',()=>{
  raises('INVALID_UTF8',()=>parseCsvBytes(Uint8Array.of(0x73,0x63,0x0a,0xff)));
  raises('EMPTY_CSV',()=>parseCsvText(''));
  raises('BLANK_HEADER',()=>parseCsvText('a, ,c\n1,2,3'));
  raises('COLUMN_LIMIT',()=>parseCsvText(Array.from({length:101},(_,i)=>`c${i}`).join(',')));
});
test('row shapes; blank internal row is retained, trailing newline is not data',()=>{
  const d=parseCsvText('value\r\n1\r\n\r\n3\r\n');
  assert.deepEqual(d.rows,[['1'],[''],['3']]);
  assert.equal(d.totalRows,3);
  assert.deepEqual([getColumnById(d,'column-0').numeric.validCount,getColumnById(d,'column-0').numeric.missingCount],[2,1]);
});
test('quotes and delimiters cannot execute code; user data remains inert strings',()=>{
  const d=parseCsvText('"<img src=x onerror=alert(1)>",name\n"=HYPERLINK(""https://example.com"",""x"")",safe');
  assert.equal(d.headers[0].original,'<img src=x onerror=alert(1)>');
  assert.match(d.rows[0][0],/^=HYPERLINK\(/);
});
test('DS-T043/044: numeric and frequency results do not depend on preview',()=>{
  const d=parseCsvText('score,name\n1,A\n2,B\n3,C\n4,D\n5,E');
  const vals=getColumnById(d,'column-0').numeric.values;
  const s=summarize(vals);
  assert.equal(s.mean,3);
  const a=buildFrequency(vals,2), b=buildFrequency(vals,4);
  assert.equal(a.bins.reduce((x,y)=>x+y.count,0),5);
  assert.equal(b.bins.reduce((x,y)=>x+y.count,0),5);
  assert.deepEqual(s,summarize(vals));
});
