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

// The source map is deliberately not copied — it is a development artefact and
// server.js refuses to serve `.map` anyway.
for (const file of ['leaflet.js', 'leaflet.css']) {
  const src = join(leafletSrc, file);
  if (existsSync(src)) cpSync(src, join(leafletDest, file));
}

// leaflet.css resolves the default marker/shadow icons relative to itself, so
// images/ must ship too. Without it L.marker() renders nothing and the page
// throws 404s for marker-icon.png.
const imagesSrc = join(leafletSrc, 'images');
if (existsSync(imagesSrc)) {
  cpSync(imagesSrc, join(leafletDest, 'images'), { recursive: true });
} else {
  console.warn('leaflet dist/images missing — map markers will not render');
}

console.log('Vendored leaflet → public/vendor/leaflet');