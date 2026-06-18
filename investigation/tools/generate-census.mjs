import { createHash } from 'node:crypto';
import { createReadStream, promises as fs } from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.argv[2] || '.');
const output = path.join(root, 'investigation/phase-01-repository-census/file_inventory.md');
const excludedRoots = new Set(['.git', 'investigation']);

function provenance(relativePath) {
  if (relativePath.startsWith('node_modules/')) return 'third-party dependency (root)';
  if (relativePath.startsWith('backend/node_modules/')) return 'third-party dependency (backend)';
  if (relativePath.startsWith('firefox-profile/')) return 'runtime browser profile';
  if (relativePath.startsWith('backend/dist/')) return 'generated backend build';
  if (relativePath.startsWith('dist/')) return 'generated extension build';
  if (relativePath.endsWith('.zip')) return 'release archive';
  if (/^(public\/icons\/.*\.(png|ico)|.*\.(png|jpg|jpeg|gif|webp|woff2?|ttf|otf))$/i.test(relativePath)) return 'binary asset';
  if (relativePath.endsWith('package-lock.json')) return 'generated dependency lock';
  return 'authored/configuration';
}

function kind(relativePath) {
  const base = path.basename(relativePath);
  const extension = path.extname(base).toLowerCase();
  if (!extension) return base.startsWith('.') ? 'extensionless config' : 'extensionless';
  return extension.slice(1);
}

async function hashFile(filename) {
  const hash = createHash('sha256');
  await new Promise((resolve, reject) => {
    const stream = createReadStream(filename);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', resolve);
  });
  return hash.digest('hex');
}

async function walk(directory, relative = '') {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  entries.sort((a, b) => a.name.localeCompare(b.name));
  const files = [];
  for (const entry of entries) {
    if (!relative && excludedRoots.has(entry.name)) continue;
    const childRelative = relative ? `${relative}/${entry.name}` : entry.name;
    const childAbsolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(childAbsolute, childRelative));
    else if (entry.isFile()) files.push(childRelative);
    else if (entry.isSymbolicLink()) files.push(childRelative);
  }
  return files;
}

const files = await walk(root);
const records = [];
for (const relativePath of files) {
  const absolutePath = path.join(root, relativePath);
  const stat = await fs.lstat(absolutePath);
  const linkTarget = stat.isSymbolicLink() ? await fs.readlink(absolutePath) : '';
  records.push({
    path: relativePath,
    class: provenance(relativePath),
    kind: stat.isSymbolicLink() ? 'symlink' : kind(relativePath),
    size: stat.size,
    hash: stat.isSymbolicLink()
      ? createHash('sha256').update(linkTarget).digest('hex')
      : await hashFile(absolutePath),
  });
}

const byClass = new Map();
const byKind = new Map();
let totalBytes = 0;
for (const record of records) {
  byClass.set(record.class, (byClass.get(record.class) || 0) + 1);
  byKind.set(record.kind, (byKind.get(record.kind) || 0) + 1);
  totalBytes += record.size;
}

const lines = [
  '# File Inventory',
  '',
  '## Scope',
  '',
  `- Baseline files examined mechanically: **${records.length.toLocaleString('en-US')}**`,
  `- Baseline bytes: **${totalBytes.toLocaleString('en-US')}**`,
  '- Excluded: `.git/` (empty repository metadata) and `investigation/` (self-generated evidence).',
  '- Examination fields: path, provenance class, extension/type, byte size, and SHA-256.',
  '- Content-level review status is tracked separately for authored/configuration files.',
  '',
  '## Provenance Summary',
  '',
  '| Class | Files |',
  '|---|---:|',
  ...[...byClass.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([name, count]) => `| ${name} | ${count.toLocaleString('en-US')} |`),
  '',
  '## Type Summary',
  '',
  '| Type | Files |',
  '|---|---:|',
  ...[...byKind.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([name, count]) => `| ${name.replaceAll('|', '\\|')} | ${count.toLocaleString('en-US')} |`),
  '',
  '## Complete Baseline Inventory',
  '',
  '| Path | Class | Type | Bytes | SHA-256 |',
  '|---|---|---|---:|---|',
  ...records.map((record) => `| \`${record.path.replaceAll('|', '\\|')}\` | ${record.class} | ${record.kind} | ${record.size} | \`${record.hash}\` |`),
  '',
];

await fs.writeFile(output, lines.join('\n'));
console.log(JSON.stringify({ output, files: records.length, bytes: totalBytes, classes: Object.fromEntries(byClass) }, null, 2));
