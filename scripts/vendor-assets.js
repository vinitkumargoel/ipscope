import { cpSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const leafletSrc = join(root, 'node_modules', 'leaflet', 'dist');
const leafletDest = join(root, 'public', 'vendor', 'leaflet');

if (!existsSync(leafletSrc)) {
  console.warn('leaflet not installed — run npm install');
  process.exit(0);
}

mkdirSync(leafletDest, { recursive: true });
for (const file of ['leaflet.js', 'leaflet.css', 'leaflet.js.map']) {
  const src = join(leafletSrc, file);
  if (existsSync(src)) cpSync(src, join(leafletDest, file));
}
console.log('Vendored leaflet → public/vendor/leaflet');