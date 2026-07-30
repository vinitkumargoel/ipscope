/**
 * Exports every cacheable page to dist/ as static HTML, ready to upload as
 * Cloudflare Workers Static Assets.
 *
 * What is exported: the registered pages, the blog, and the programmatic ASN and
 * country pages. What is NOT exported: /api/* and /lookup/:ip, which need the
 * MMDBs and stay on the Node origin — the Worker proxies those through.
 *
 *   npm run build-static
 */
import { cp, mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { PAGES } from '../lib/site-config.js';
import { hasView } from '../lib/views.js';
import { renderRegisteredPage, renderBlogPost, render404 } from '../lib/pages.js';
import { POSTS } from '../lib/blog.js';
import {
  renderAsnPage,
  renderCountryPage,
  asnIndexAvailable,
  listIndexedAsns,
  listIndexedCountries,
} from '../lib/programmatic.js';
import {
  urlset,
  sitemapIndex,
  indexChildren,
  pageEntries,
  blogEntries,
  asnEntries,
  countryEntries,
  robotsTxt,
} from '../lib/sitemap.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const PUBLIC = join(ROOT, 'public');

/**
 * Workers Static Assets allows 20,000 assets on the free plan and 100,000 on paid.
 *
 * The number that counts is wrangler's *manifest entry* count, not the file count,
 * and they are not the same: a page written to `dist/about/index.html` produces TWO
 * manifest entries — one for `/about/index.html` and one for the extensionless
 * `/about` that `html_handling` serves. So every page costs 2, and the effective
 * page ceiling on the free plan is roughly 10,000, not 20,000.
 *
 * Budget in manifest entries, therefore, and count them the way wrangler does.
 * ASSET_FILE_BUDGET is expressed in manifest entries; raise it to 99,000 on paid.
 */
const ENTRY_BUDGET = Number(process.env.ASSET_FILE_BUDGET) || 19_500;

/** A page at a sub-path costs 2 entries; the root index.html and 404.html cost 1. */
const ENTRIES_PER_PAGE = 2;

let written = 0;
/** Running manifest-entry total, including the copied public/ tree. */
let entries = 0;

async function emit(urlPath, html) {
  // `/about` -> dist/about/index.html, which Workers serves at both /about and
  // /about/ without any extra routing config.
  const rel = urlPath === '/' ? 'index.html' : join(urlPath.replace(/^\//, ''), 'index.html');
  const dest = join(DIST, rel);
  await mkdir(dirname(dest), { recursive: true });
  await writeFile(dest, html);
  written += 1;
  entries += urlPath === '/' ? 1 : ENTRIES_PER_PAGE;
}

async function countFiles(dir) {
  let n = 0;
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) n += await countFiles(join(dir, entry.name));
    else n += 1;
  }
  return n;
}

async function main() {
  console.log('Cleaning dist/…');
  await rm(DIST, { recursive: true, force: true });
  await mkdir(DIST, { recursive: true });

  // public/ contributes assets only. Every page now renders from views/ through
  // lib/pages.js, so copying the superseded hand-written .html files would put
  // /about.html back alongside /about — the exact duplicate-content problem the
  // Express canonicalisation middleware exists to prevent. The Worker serves
  // Static Assets directly and has no such middleware, so the filter is the only
  // thing standing between us and two URLs per page.
  console.log('Copying public/ (excluding .html and .map) …');
  const skippedAssets = [];
  await cp(PUBLIC, DIST, {
    recursive: true,
    filter(src) {
      if (/\.(html?|map)$/i.test(src)) {
        skippedAssets.push(relative(PUBLIC, src));
        return false;
      }
      return true;
    },
  });
  if (skippedAssets.length) {
    console.log(`  skipped ${skippedAssets.length}: ${skippedAssets.join(', ')}`);
  }

  // Copied assets have real extensions, so they cost exactly one entry each.
  const copiedAssets = await countFiles(DIST);
  entries += copiedAssets;
  console.log(`  ${copiedAssets} asset files (1 manifest entry each)`);

  console.log('Rendering registered pages…');
  let skipped = 0;
  for (const page of PAGES) {
    if (!hasView(page.view)) {
      console.warn(`  skip ${page.path} — views/${page.view}.html missing`);
      skipped += 1;
      continue;
    }
    await emit(page.path, renderRegisteredPage(page));
  }
  console.log(`  ${PAGES.length - skipped} pages`);

  console.log('Rendering blog…');
  let posts = 0;
  for (const post of POSTS) {
    const html = renderBlogPost(post.slug);
    if (!html) {
      console.warn(`  skip /blog/${post.slug} — view missing`);
      continue;
    }
    await emit(`/blog/${post.slug}`, html);
    posts += 1;
  }
  console.log(`  ${posts} posts`);

  let asnWritten = 0;
  let countryWritten = 0;
  /** The ASNs actually exported — what sitemap-asn.xml is allowed to list. */
  let exportedAsns = [];

  if (!asnIndexAvailable()) {
    console.warn('ASN index not built — skipping /asn/* and /country/*. Run: npm run build-index');
  } else {
    const countries = listIndexedCountries();
    console.log(`Rendering ${countries.length} country pages…`);
    for (const cc of countries) {
      const html = await renderCountryPage(cc);
      if (html) {
        await emit(`/country/${cc.toLowerCase()}`, html);
        countryWritten += 1;
      }
    }

    // Reserve one entry for 404.html, then divide the remaining budget by the
    // per-page entry cost. Dividing by 2 here is the whole point: budgeting in raw
    // files silently overshoots the plan limit by ~2x and wrangler rejects the
    // upload only at deploy time.
    const allAsns = listIndexedAsns();
    const remaining = Math.max(0, ENTRY_BUDGET - entries - 1);
    const affordable = Math.floor(remaining / ENTRIES_PER_PAGE);
    const asns = allAsns.slice(0, affordable);

    console.log(`Rendering ${asns.length} ASN pages…`);
    for (const num of asns) {
      const html = await renderAsnPage(String(num));
      if (html) {
        await emit(`/asn/AS${num}`, html);
        asnWritten += 1;
      }
      if (asnWritten % 2000 === 0 && asnWritten) console.log(`  ${asnWritten}…`);
    }

    exportedAsns = asns;

    // Never let a cap look like full coverage.
    if (allAsns.length > asns.length) {
      console.warn(
        `\n  NOTE: ${(allAsns.length - asns.length).toLocaleString('en-US')} ASN pages were ` +
          `NOT exported — the ${ENTRY_BUDGET.toLocaleString('en-US')} manifest-entry budget ` +
          `was reached. They are excluded from sitemap-asn.xml too, so nothing is ` +
          `advertised that does not exist. Raise ASSET_FILE_BUDGET (Workers paid allows ` +
          `100,000 entries) or lower SITEMAP_ASN_LIMIT to change what is dropped.`,
      );
    }
  }

  // Workers Static Assets resolves `not_found_handling = "404-page"` to /404.html.
  console.log('Writing 404.html, sitemaps and robots.txt…');
  await writeFile(join(DIST, '404.html'), render404());
  await writeFile(join(DIST, 'robots.txt'), robotsTxt());
  await writeFile(join(DIST, 'sitemap.xml'), sitemapIndex(indexChildren()));
  await writeFile(join(DIST, 'sitemap-pages.xml'), urlset(pageEntries()));
  await writeFile(join(DIST, 'sitemap-blog.xml'), urlset(blogEntries()));
  if (asnIndexAvailable()) {
    await writeFile(join(DIST, 'sitemap-asn.xml'), urlset(asnEntries(exportedAsns)));
    await writeFile(join(DIST, 'sitemap-country.xml'), urlset(countryEntries()));
  }

  const totalFiles = await countFiles(DIST);
  // 404.html, robots.txt and the sitemaps were written after the asset count.
  const manifestEntries = entries + (totalFiles - copiedAssets - written);

  console.log(`
Done.
  HTML pages written : ${written.toLocaleString('en-US')}
  country pages      : ${countryWritten}
  ASN pages          : ${asnWritten.toLocaleString('en-US')}
  files on disk      : ${totalFiles.toLocaleString('en-US')}
  manifest entries   : ${manifestEntries.toLocaleString('en-US')}  ← the number Cloudflare limits
  budget             : ${ENTRY_BUDGET.toLocaleString('en-US')}  (free plan 20,000 · paid 100,000)
  output             : dist/

Each page costs 2 manifest entries: /about/index.html and the extensionless /about.
Verify before deploying:  npx wrangler deploy --dry-run
Deploy with:              npx wrangler deploy
`);

  if (manifestEntries > 20_000) {
    console.warn(
      `WARNING: ${manifestEntries.toLocaleString('en-US')} manifest entries exceeds the ` +
        `20,000 free-plan limit. This deploy needs the paid Workers plan, or lower ` +
        `SITEMAP_ASN_LIMIT.\n`,
    );
  }
}

if (!existsSync(PUBLIC)) {
  console.error('public/ not found — run from the project root.');
  process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
