import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

function filesIn(directory) {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    return statSync(path).isDirectory() ? filesIn(path) : [path];
  });
}

const assets = filesIn('dist/assets');
const checks = [
  { label: 'JavaScript gzip', bytes: assets.filter((path) => path.endsWith('.js')).reduce((sum, path) => sum + gzipSync(readFileSync(path)).length, 0), limit: 480_000 },
  { label: 'CSS gzip', bytes: assets.filter((path) => path.endsWith('.css')).reduce((sum, path) => sum + gzipSync(readFileSync(path)).length, 0), limit: 12_000 },
  { label: 'Game images', bytes: filesIn('dist/assets/game').reduce((sum, path) => sum + statSync(path).size, 0), limit: 3_000_000 },
];
for (const { label, bytes, limit } of checks) {
  console.log(`${label}: ${bytes.toLocaleString('en-US')} / ${limit.toLocaleString('en-US')} bytes`);
  if (bytes > limit) process.exitCode = 1;
}
