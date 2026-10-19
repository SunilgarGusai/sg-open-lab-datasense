import { lstat, mkdir, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { parseArgs } from 'node:util';

// This is an explicit publication allowlist, not a copy of the repository.
const policyDocuments = ['STATISTICAL_METHODS.md', 'EXPORT_POLICY.md', 'CSV_IMPORT_POLICY.md', 'PRIVACY.md', 'PRIVACY_POLICY.md'];

async function statIfPresent(filename) {
  try { return await lstat(filename); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

function assertRegular(stat, name) {
  if (stat?.isSymbolicLink()) throw new Error(`Symbolic links are not publishable: ${name}`);
  if (!stat?.isFile()) throw new Error(`Missing required file: ${name}`);
}

async function stageSite(root, commit) {
  root = await realpath(root);
  const output = path.resolve(root, '_site');
  // Only this fixed child may be replaced, and never through a symlink/junction.
  if (path.dirname(output) !== root || path.basename(output) !== '_site') throw new Error('Unsafe staging output path');
  const outputStat = await statIfPresent(output);
  if (outputStat?.isSymbolicLink()) throw new Error('Refusing symlinked staging output');
  if (outputStat && !outputStat.isDirectory()) throw new Error('Staging output must be a directory');

  const files = new Map();
  async function readSource(name) {
    let source = root;
    for (const part of name.split('/')) {
      source = path.join(source, part);
      if ((await statIfPresent(source))?.isSymbolicLink()) throw new Error(`Symbolic links are not publishable: ${name}`);
    }
    assertRegular(await statIfPresent(source), name);
    return readFile(source);
  }
  async function collectDirectory(name, accept, required = false) {
    const directory = path.join(root, ...name.split('/'));
    const stat = await statIfPresent(directory);
    if (stat?.isSymbolicLink()) throw new Error(`Symbolic links are not publishable: ${name}`);
    if (!stat) {
      if (required) throw new Error(`Missing required directory: ${name}`);
      return;
    }
    if (!stat.isDirectory()) throw new Error(`Expected a directory: ${name}`);
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const child = `${name}/${entry.name}`;
      if (entry.isSymbolicLink()) throw new Error(`Symbolic links are not publishable: ${child}`);
      if (entry.name.startsWith('.')) continue;
      if (entry.isDirectory()) await collectDirectory(child, accept);
      else if (accept(child)) files.set(child, await readSource(child));
    }
  }

  const pkg = JSON.parse(await readSource('package.json'));
  if (typeof pkg.version !== 'string' || !pkg.version) throw new Error('Package version is required');
  let html = (await readSource('index.html')).toString('utf8');
  if (!/<head\b[^>]*>/i.test(html)) throw new Error('index.html must contain a head element');
  html = html.replace(/<meta\b[^>]*\bname\s*=\s*["']robots["'][^>]*>/gi, '');
  html = html.replace(/<head\b[^>]*>/i, '$&\n  <meta name="robots" content="noindex, nofollow, noarchive" />');
  files.set('index.html', Buffer.from(html));
  files.set('styles.css', await readSource('styles.css'));
  await collectDirectory('dist', name => name.endsWith('.js'), true);
  if (![...files.keys()].some(name => name.startsWith('dist/'))) throw new Error('No compiled JavaScript found in dist');
  await collectDirectory('public/examples', name => name.endsWith('.csv'));
  for (const filename of policyDocuments) {
    const name = `docs/${filename}`;
    if (html.includes(name)) files.set(name, await readSource(name));
  }
  for (const [name, bytes] of files) {
    if (name.endsWith('.js')) {
      const js = bytes.toString('utf8')
        .replace(/^[\t ]*\/\/[#@][\t ]*sourceMappingURL=.*(?:\r?\n|$)/gm, '')
        .replace(/^[\t ]*\/\*[#@][\t ]*sourceMappingURL=[^\r\n]*?\*\/[\t ]*(?:\r?\n|$)/gm, '');
      files.set(name, Buffer.from(js));
    }
  }
  // Indexing hints are not authentication or a confidentiality boundary.
  files.set('robots.txt', Buffer.from('User-agent: *\nDisallow: /\n'));
  const sorted = [...files.entries()].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
  const manifest = {
    schemaVersion: 1,
    version: pkg.version,
    releaseChannel: 'alpha-staging',
    commit,
    hashAlgorithm: 'SHA-256',
    hashScope: 'All published files except staging-manifest.json itself',
    files: sorted.map(([name, bytes]) => ({ path: name, bytes: bytes.byteLength, sha256: createHash('sha256').update(bytes).digest('hex') })),
  };
  // Validate/read every source before touching a previously prepared artifact.
  await rm(output, { recursive: true, force: true });
  for (const [name, bytes] of sorted) {
    const target = path.join(output, ...name.split('/'));
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, bytes);
  }
  await writeFile(path.join(output, 'staging-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  return { output, version: pkg.version, commit, files: files.size + 1 };
}

try {
  const { values } = parseArgs({ options: { root: { type: 'string', default: process.cwd() }, commit: { type: 'string' } } });
  let commit = values.commit ?? process.env.GITHUB_SHA ?? null;
  if (!commit) {
    const result = spawnSync('git', ['-C', values.root, 'rev-parse', 'HEAD'], { encoding: 'utf8' });
    if (result.status === 0) commit = result.stdout.trim();
  }
  if (commit !== null && !/^(?:[a-f\d]{40}|[a-f\d]{64})$/i.test(commit)) throw new Error('Commit must be a full hexadecimal Git commit ID');
  console.log(JSON.stringify(await stageSite(path.resolve(values.root), commit), null, 2));
} catch (error) {
  console.error(`Staging failed: ${error.message}`);
  process.exitCode = 1;
}
