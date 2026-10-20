import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCsvText, parseCsvBytes, CSV_LIMITS, CsvImportError } from '../dist/index.js';

function raises(code, fn) {
  assert.throws(fn, e => e instanceof CsvImportError && e.code === code);
}

test('DS14-S01: generated labels reserve all literal names regardless of order or case', () => {
  for (const header of ['score,score (2),score', 'score,score,SCORE (2)', 'x,X,x (2),X (3),x']) {
    const dataset = parseCsvText(header);
    const labels = dataset.headers.map(h => h.display.toLocaleLowerCase('en-US'));
    assert.equal(new Set(labels).size, labels.length);
    assert.deepEqual(dataset.headers.map(h => h.original), header.split(','));
    assert.deepEqual(dataset.headers.map(h => h.id), labels.map((_, i) => `column-${i}`));
  }
  assert.deepEqual(parseCsvText('score,score (2),score').headers.map(h => h.display),
    ['score', 'score (2)', 'score (3)']);
});

test('DS14-S02: excessive header width rejects before reading the next field', () => {
  raises('COLUMN_LIMIT', () => parseCsvText(','.repeat(100) + '"unclosed'));
  raises('COLUMN_LIMIT', () => parseCsvText(','.repeat(1_000_000)));
});

test('DS14-S02: data width rejects before reading an impossible extra field', () => {
  raises('FIELD_COUNT_MISMATCH', () => parseCsvText('a,b\n1,2,"unclosed'));
  raises('FIELD_COUNT_MISMATCH', () => parseCsvText('a\n1,' + ','.repeat(1_000_000)));
});

test('DS14-S02: exact width and quoted commas still parse', () => {
  const headers = Array.from({length:100}, (_,i) => `c${i}`).join(',');
  const row = Array(100).fill('"1,2"').join(',');
  const dataset = parseCsvText(`${headers}\r\n${row}\r\n`);
  assert.equal(dataset.headers.length, 100);
  assert.equal(dataset.rows[0].length, 100);
  assert.ok(dataset.rows[0].every(value => value === '1,2'));
});

test('DS14-S03: supplied metadata cannot bypass the text byte limit', () => {
  raises('FILE_TOO_LARGE', () => parseCsvText('x\n' + '1'.repeat(CSV_LIMITS.maxBytes), 1));
  raises('FILE_TOO_LARGE', () => parseCsvText('x\n' + 'é'.repeat(CSV_LIMITS.maxBytes / 2), 1));
});

test('DS14-S03: invalid or mismatching metadata rejects explicitly', () => {
  for (const size of [NaN, Infinity, -1, 0, 1, 4.5, 99]) {
    raises('INVALID_BYTE_LENGTH', () => parseCsvText('x\n1', size));
  }
  assert.equal(parseCsvText('x\n1', 3).byteLength, 3);
});

test('DS14-S03: both entry points retain exact UTF-8 byte counts including BOM', () => {
  for (const source of ['x\né', '\uFEFFx\nઅમદાવાદ', '\uFEFFx\n😀', 'x\n1']) {
    const bytes = new TextEncoder().encode(source);
    for (const dataset of [parseCsvText(source), parseCsvText(source, bytes.length), parseCsvBytes(bytes)]) {
      assert.equal(dataset.byteLength, bytes.length);
      assert.equal(dataset.headers[0].display, 'x');
    }
  }
});
