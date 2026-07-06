import { mkdir, writeFile } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');

const BASE = 'https://github.com/sapics/ip-location-db/releases/download/latest';

const FILES = [
  'dbip-city-ipv4.mmdb',
  'dbip-city-ipv6.mmdb',
  'dbip-asn.mmdb',
  'origin-asn.mmdb',
  'geolite2-city-ipv4.mmdb',
  'geolite2-city-ipv6.mmdb',
];

async function download(url, dest) {
  console.log(`Downloading ${url}...`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed ${url}: ${res.status}`);
  await pipeline(res.body, createWriteStream(dest));
  console.log(`  → ${dest}`);
}

await mkdir(DATA_DIR, { recursive: true });

for (const file of FILES) {
  await download(`${BASE}/${file}`, join(DATA_DIR, file));
}

console.log('\nDone. Databases saved to data/');