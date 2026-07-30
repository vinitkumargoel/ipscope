# IPScope

Self-hosted IP geolocation web app. See your public IPv4/IPv6 address, city, ISP, timezone, ASN, map, and registry details — resolved offline with MMDB databases. No API keys.

## Features

- **What is my IP** — automatic detection with WebRTC fallback
- **IPv4 & IPv6** lookup for any public address
- **Offline geolocation** — DB-IP + GeoLite2 MMDB merge
- **RDAP enrichment** — ASN, abuse contact, network range
- **VPN/Proxy/Datacenter detection** — heuristic threat badges
- **Bulk IP lookup** — up to 100 addresses via UI or API, with CSV/JSON export
- **Dedicated tools** — timezone check, VPN check, reverse DNS, abuse contact, bulk lookup
- **Programmatic pages** — per-ASN (`/asn/AS15169`) and per-country (`/country/in`)
- **Shareable, server-rendered lookups** — `/lookup/8.8.8.8`
- **Blog** — nine long-form guides on IP addressing and geolocation
- **REST API** — `/api/me`, `/api/lookup/:ip`, `/api/bulk`
- **Dark mode** with system preference detection
- **Legal pages** — Privacy, Terms, DMCA, Cookie Policy, Disclaimer, Comment Policy, FAQ

## Quick start

```bash
npm install
npm run download-db   # MMDB files (~190MB)
npm start             # http://localhost:3920
```

That is enough to run everything except the `/asn/*` and `/country/*` pages, which
need an index (see below). The server logs a notice when they are unavailable and
returns 404 for those routes rather than failing to boot.

## Architecture

Express 4 with ES modules, no build step and no framework. Pages are plain
template functions.

```
lib/site-config.js   Single source of truth for page metadata (title, description, h1…)
lib/render.js        The one place <head> is produced — canonical, OG, Twitter, JSON-LD
lib/pages.js         Page renderers shared by the server AND the static exporter
lib/sitemap.js       Sitemap + robots.txt generation, likewise shared
lib/views.js         Loads views/*.html body fragments, with mtime as <lastmod>
lib/programmatic.js  Renders /asn/* and /country/* from the built index
views/               Body fragments only — no <html>, <head>, <main> or <footer>
worker/index.js      Cloudflare Worker: static assets at the edge, origin for MMDB routes
```

`lib/pages.js` and `lib/sitemap.js` exist specifically so the Express server and
`scripts/build-static.js` cannot disagree about how a page renders or which URLs
exist. Add a page by adding an entry to `PAGES` in `lib/site-config.js` and a
matching fragment in `views/` — metadata, canonical, breadcrumbs, footer links and
sitemap entry all follow automatically.

## Build scripts

| Script | What it does | Notes |
|---|---|---|
| `npm run download-db` | Fetches the MMDB databases | ~190MB, required |
| `npm run build-assets` | Generates favicons + the OG card | Needs Python 3 + Pillow |
| `npm run build-index` | Builds `data/asn-index.json` + `data/country-index.json` | Downloads ~17MB of CIDR CSVs, takes a few minutes |
| `npm run build-static` | Renders every cacheable page to `dist/` | ~15,300 files, ~190MB |
| `npm run build` | `build-index` then `build-static` | |

`build-index` inverts the ASN CIDR CSVs (prefix → ASN) because the MMDBs only
answer the opposite question. Organisation names and per-prefix countries come
from the MMDBs already on disk, so no extra dataset is needed.

## Deploying to Cloudflare

A full Workers migration is not possible: the MMDBs total ~190MB (three files
individually exceed the 25 MiB static-asset cap), `maxmind` reads them through
`fs`, and `geo-tz` ships ~69MB of geojson. The Worker is therefore a hybrid.

- **Static Assets** serve `dist/` at the edge — every page, the blog, and all
  ASN/country pages. No origin hit.
- **The Node origin** (behind the existing tunnel) handles `/api/*` and
  `/lookup/:ip`, which need arbitrary-IP MMDB lookups.
- **`request.cf`** answers `/api/me` at the edge with no database and no origin
  round-trip. Set `EDGE_ME = "off"` in `wrangler.toml` to always use the origin
  instead — origin responses are richer (RDAP, reverse DNS, threat signals).

```bash
npm run build-assets
npm run build           # build-index + build-static
# set ORIGIN in wrangler.toml to the tunnel hostname (NOT ip.vinitk.dev)
npx wrangler deploy
```

`dist/` currently holds ~15,305 files, within the 20,000-file free-plan limit.
Raising `SITEMAP_ASN_LIMIT` above ~19,000 requires the paid plan (100,000 files);
`build-static` warns explicitly when ASN pages are dropped rather than letting a
cap look like full coverage.

## API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check |
| `/api/me` | GET | Your IP geolocation |
| `/api/lookup/:ip` | GET | Lookup any IP |
| `/api/bulk` | POST | Bulk lookup `{"ips":["8.8.8.8"]}`, max 100 |

See [/api-docs](views/api-docs.html) for the full reference.

## Environment

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3920` | Server port |
| `HOST` | `0.0.0.0` | Bind address |
| `SITE_URL` | `https://ip.vinitk.dev` | Canonical origin for URLs and sitemaps |
| `SITE_EMAIL` | `legal@vinitk.dev` | Contact email |
| `DMCA_EMAIL` | `legal@vinitk.dev` | DMCA agent email |
| `SITE_TWITTER` | *(unset)* | `twitter:site` handle. Left unset deliberately — only set it once the handle is actually owned |
| `GOOGLE_SITE_VERIFICATION` | *(unset)* | Emits `<meta name="google-site-verification">` |
| `BING_SITE_VERIFICATION` | *(unset)* | Emits `<meta name="msvalidate.01">` |
| `CF_BEACON_TOKEN` | *(unset)* | Cloudflare Web Analytics token, loaded same-origin via `/cdn-cgi/` so the strict CSP needs no change |
| `SITEMAP_ASN_LIMIT` | `15000` | ASN pages listed in the sitemap and exported |
| `ASSET_FILE_BUDGET` | `19000` | Static Assets file ceiling for `build-static` |

Every SEO token is unset by default; nothing fake is ever emitted.

## Data sources

- [sapics/ip-location-db](https://github.com/sapics/ip-location-db) — DB-IP + GeoLite2 MMDB and ASN CIDR CSVs
- Public RDAP registries (RIPE, ARIN, APNIC, etc.)
- OpenStreetMap tiles via Leaflet (lazy-loaded on scroll)

## SEO

- Server-rendered `<head>` for every page — one code path, so no page can ship
  without a canonical, description, OG and Twitter card
- Server-rendered footer, so the internal link graph exists without JavaScript
- 301s from the legacy `.html` URLs, trailing slashes and mixed case, in both the
  Express origin and the Worker
- Sitemap index split into pages / blog / ASN / country, each with `<lastmod>`
- JSON-LD: WebSite, Organization, WebApplication, BreadcrumbList, FAQPage,
  Article, Blog, Dataset, Place — all derived from the same data that renders the
  visible page, so schema cannot drift from content
- `/lookup/:ip` is server-rendered per IP, and `noindex, follow` for anything
  outside a curated allowlist of well-known resolvers — an index-bloat guard

## License

MIT. Geolocation database files are subject to their respective licenses.
