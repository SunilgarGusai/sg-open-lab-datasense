import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const records = JSON.parse(await readFile(path.join(root, 'evidence/ds13/protected-baseline-sha256.json'), 'utf8'));
for (const record of records) {
  const contents = await readFile(path.join(root, record.path));
  const actual = createHash('sha256').update(contents).digest('hex');
  if (actual !== record.sha256) throw new Error(`Original mathematical contract/test changed: ${record.path}`);
}
console.log(`Preserved ${records.length} original core, contract, test and oracle files (SHA-256).`);
