import { readFileSync, statSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const VIEWS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'views');

// Views are read once in production. In dev they are re-read so editing a view
// does not require a restart.
const DEV = process.env.NODE_ENV !== 'production';
const cache = new Map();

function viewFile(name) {
  return join(VIEWS_DIR, `${name}.html`);
}

export function hasView(name) {
  // Guard against traversal: view names come from the router, but a typo that
  // let `../` through would expose arbitrary files.
  if (!/^[a-z0-9][a-z0-9/-]*$/i.test(name) || name.includes('..')) return false;
  return existsSync(viewFile(name));
}

/** @returns {{ html: string, lastmod: string }} */
export function loadView(name) {
  if (!DEV && cache.has(name)) return cache.get(name);
  if (!hasView(name)) throw new Error(`View not found: ${name}`);

  const file = viewFile(name);
  const entry = {
    html: readFileSync(file, 'utf8').replace(/\s+$/, ''),
    lastmod: statSync(file).mtime.toISOString().slice(0, 10),
  };
  cache.set(name, entry);
  return entry;
}

/** Newest mtime across a set of views — used for sitemap-index lastmod. */
export function newestLastmod(names) {
  return names
    .filter(hasView)
    .map((n) => loadView(n).lastmod)
    .sort()
    .pop() ?? new Date().toISOString().slice(0, 10);
}
