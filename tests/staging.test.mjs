import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const script = fileURLToPath(new URL('../scripts/stage-site.mjs', import.meta.url));
const commit = '0123456789abcdef0123456789abcdef01234567';

async function fixture(t) {
  const root = await mkdtemp(path.join(tmpdir(), 'datasense-staging-test-'));
  t.after(async () => {
    assert.equal(path.dirname(path.resolve(root)), path.resolve(tmpdir()));
    assert.ok(path.basename(root).startsWith('datasense-staging-test-'));
    await rm(root, { recursive: true, force: true });
  });
  const files = {
    'package.json': '{"version":"0.4.0-alpha.1"}',
    'index.html': '<!doctype html><html><head><meta name="robots" content="index,follow"><title>Alpha</title></head><body><a href="./docs/STATISTICAL_METHODS.md">Methods</a><script type="module" src="./dist/app/browser.js"></script></body></html>',
    'styles.css': 'body { color: black; }\n',
    'dist/app/browser.js': 'export const example = 1;\n//# sourceMappingURL=browser.js.map\n',
    'dist/app/browser.js.map': '{"sourcesContent":["private source"]}',
    'dist/app/browser.d.ts': 'export declare const example = 1;',
    'dist/core/summary.js': 'export const value = 2;\n/*# sourceMappingURL=summary.js.map */\n',
    'public/examples/scores.csv': 'score\n1\n2\n',
    'public/examples/.secret': 'must not ship',
    'public/private.json': '{"secret":true}',
    'docs/STATISTICAL_METHODS.md': '# Methods\n',
    'docs/EXPORT_POLICY.md': '# Unlinked policy\n',
    'docs/VALIDATION_REPORT.md': 'private evidence',
    'src/private.ts': 'private source',
    'tests/private.test.mjs': 'private test',
    'evidence/private.json': 'private evidence',
    '.github/workflows/private.yml': 'private workflow',
    '.git/config': 'private repository metadata',
  };
  for (const [name, contents] of Object.entries(files)) {
    await mkdir(path.dirname(path.join(root, name)), { recursive: true });
    await writeFile(path.join(root, name), contents);
  }
  return root;
}

function stage(root, extra = []) {
  return spawnSync(process.execPath, [script, '--root', root, '--commit', commit, ...extra], { encoding: 'utf8' });
}

async function listFiles(root, prefix = '') {
  const files = [];
  for (const entry of await readdir(path.join(root, prefix), { withFileTypes: true })) {
    const name = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) files.push(...await listFiles(root, name));
    else files.push(name);
  }
  return files.sort();
}

test('DS-13 staging publishes only reviewed static assets and referenced policy documents', async (t) => {
  const root = await fixture(t);
  const result = stage(root);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(await listFiles(path.join(root, '_site')), [
    'dist/app/browser.js', 'dist/core/summary.js', 'docs/STATISTICAL_METHODS.md',
    'index.html', 'public/examples/scores.csv', 'robots.txt', 'staging-manifest.json', 'styles.css',
  ]);
  const html = await readFile(path.join(root, '_site/index.html'), 'utf8');
  assert.match(html, /name="robots" content="noindex, nofollow, noarchive"/);
  assert.doesNotMatch(html, /content="index,follow"/);
  assert.equal(await readFile(path.join(root, '_site/robots.txt'), 'utf8'), 'User-agent: *\nDisallow: /\n');
  assert.doesNotMatch(await readFile(path.join(root, '_site/dist/app/browser.js'), 'utf8'), /sourceMappingURL/);
  assert.doesNotMatch(await readFile(path.join(root, '_site/dist/core/summary.js'), 'utf8'), /sourceMappingURL/);
  assert.match(await readFile(path.join(root, 'dist/app/browser.js'), 'utf8'), /sourceMappingURL/);
});

test('DS-13 staging manifest identifies the release and hashes exact shipped bytes reproducibly', async (t) => {
  const root = await fixture(t);
  assert.equal(stage(root).status, 0);
  const first = await readFile(path.join(root, '_site/staging-manifest.json'), 'utf8');
  const manifest = JSON.parse(first);
  assert.equal(manifest.version, '0.4.0-alpha.1');
  assert.equal(manifest.commit, commit);
  assert.equal(manifest.releaseChannel, 'alpha-staging');
  assert.equal(manifest.files.length, 7);
  for (const entry of manifest.files) {
    const bytes = await readFile(path.join(root, '_site', entry.path));
    assert.equal(entry.bytes, bytes.byteLength);
    assert.equal(entry.sha256, createHash('sha256').update(bytes).digest('hex'));
  }
  await writeFile(path.join(root, '_site/stale-private.txt'), 'must not survive a second build');
  assert.equal(stage(root).status, 0);
  assert.equal(await readFile(path.join(root, '_site/staging-manifest.json'), 'utf8'), first);
  assert.ok(!(await listFiles(path.join(root, '_site'))).includes('stale-private.txt'));
});

test('DS-13 staging rejects missing build assets before replacing an existing site', async (t) => {
  const root = await fixture(t);
  await mkdir(path.join(root, '_site'));
  await writeFile(path.join(root, '_site/keep.txt'), 'previous artifact');
  await rm(path.join(root, 'dist'), { recursive: true });
  const result = stage(root);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Missing required directory: dist/);
  assert.equal(await readFile(path.join(root, '_site/keep.txt'), 'utf8'), 'previous artifact');
});

test('DS-13 staging refuses a symlinked output directory without modifying its target', async (t) => {
  const root = await fixture(t);
  await mkdir(path.join(root, 'keep'));
  await writeFile(path.join(root, 'keep/private.txt'), 'untouched');
  try {
    await symlink(path.join(root, 'keep'), path.join(root, '_site'), process.platform === 'win32' ? 'junction' : 'dir');
  } catch (error) {
    if (error.code === 'EPERM') return t.skip('Directory symlink creation is unavailable on this host.');
    throw error;
  }
  const result = stage(root);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Refusing symlinked staging output/);
  assert.equal(await readFile(path.join(root, 'keep/private.txt'), 'utf8'), 'untouched');
});

test('DS-13 staging rejects symlinked assets instead of publishing files outside the allowlist', async (t) => {
  const root = await fixture(t);
  await mkdir(path.join(root, 'private'));
  await writeFile(path.join(root, 'private/secret.js'), 'private code');
  try {
    await symlink(path.join(root, 'private'), path.join(root, 'dist/linked'), process.platform === 'win32' ? 'junction' : 'dir');
  } catch (error) {
    if (error.code === 'EPERM') return t.skip('Directory symlink creation is unavailable on this host.');
    throw error;
  }
  const result = stage(root);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Symbolic links are not publishable/);
});

test('DS-13 staging rejects a symlinked parent of an otherwise allowed document', async (t) => {
  const root = await fixture(t);
  await mkdir(path.join(root, 'private'));
  await writeFile(path.join(root, 'private/STATISTICAL_METHODS.md'), 'private content');
  await rm(path.join(root, 'docs'), { recursive: true });
  try {
    await symlink(path.join(root, 'private'), path.join(root, 'docs'), process.platform === 'win32' ? 'junction' : 'dir');
  } catch (error) {
    if (error.code === 'EPERM') return t.skip('Directory symlink creation is unavailable on this host.');
    throw error;
  }
  const result = stage(root);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Symbolic links are not publishable/);
});
