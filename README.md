# IPScope

Self-hosted IP geolocation web app. See your public IPv4/IPv6 address, city, ISP, timezone, ASN, map, and registry details — resolved offline with MMDB databases. No API keys.

## Features

- **What is my IP** — automatic detection with WebRTC fallback
- **IPv4 & IPv6** lookup for any public address
- **Offline geolocation** — DB-IP + GeoLite2 MMDB merge
- **RDAP enrichment** — ASN, abuse contact, network range
- **VPN/Proxy/Datacenter detection** — heuristic threat badges
- **Bulk IP lookup** — up to 20 addresses via UI or API
- **Shareable URLs** — `/lookup/8.8.8.8`
- **Export JSON**, copy IP, print report, recent lookups
- **Dark mode** with system preference detection
- **REST API** — `/api/me`, `/api/lookup/:ip`, `/api/bulk`
- **Legal pages** — Privacy, Terms, DMCA, Cookie Policy, FAQ

## Quick start

```bash
npm install
npm run download-db   # downloads MMDB files (~100MB)
npm start             # http://localhost:3920
```

## API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check |
| `/api/me` | GET | Your IP geolocation |
| `/api/lookup/:ip` | GET | Lookup any IP |
| `/api/bulk` | POST | Bulk lookup `{"ips":["8.8.8.8"]}` |

See [API docs](public/api-docs.html) for full reference.

## Environment

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3920` | Server port |
| `SITE_URL` | `https://ip.vinitk.dev` | Canonical URL for sitemap |
| `SITE_EMAIL` | `legal@vinitk.dev` | Contact email |

## Data sources

- [sapics/ip-location-db](https://github.com/sapics/ip-location-db) — DB-IP + GeoLite2
- Public RDAP registries (RIPE, ARIN, APNIC, etc.)
- OpenStreetMap tiles via Leaflet

## License

MIT. Geolocation database files are subject to their respective licenses.

## SEO

- `robots.txt`, dynamic `sitemap.xml`
- Open Graph + Twitter Card meta tags
- JSON-LD structured data (WebApplication, FAQPage)
- Canonical URLs on all pages