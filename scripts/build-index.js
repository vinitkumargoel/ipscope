/**
 * Builds data/asn-index.json and data/country-index.json — the inputs for the
 * programmatic /asn/* and /country/* pages.
 *
 * The MMDB files only answer "which ASN owns this IP", which is the wrong
 * direction for building per-ASN pages. The CIDR CSVs from the same upstream
 * release give us prefix -> ASN, which we invert here. Organisation names and
 * per-prefix countries come from the MMDBs already on disk, so no extra
 * name/country dataset is needed.
 *
 *   npm run build-index
 */
import { createReadStream, existsSync, mkdirSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { createInterface } from 'node:readline';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import maxmind from 'maxmind';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');
const CACHE_DIR = join(DATA_DIR, 'csv');

const BASE = 'https://github.com/sapics/ip-location-db/releases/download/latest';
const CSVS = ['dbip-asn-ipv4-cidr.csv', 'dbip-asn-ipv6-cidr.csv'];

// Keep the JSON bounded: the largest N prefixes per ASN and top N ASNs per country.
const TOP_PREFIXES_PER_ASN = 15;
const TOP_ASNS_PER_COUNTRY = 50;

async function ensureCsv(name) {
  const dest = join(CACHE_DIR, name);
  if (existsSync(dest)) {
    console.log(`  cached  ${name}`);
    return dest;
  }
  console.log(`  fetch   ${name}`);
  const res = await fetch(`${BASE}/${name}`);
  if (!res.ok) throw new Error(`Failed to download ${name}: ${res.status}`);
  await pipeline(res.body, createWriteStream(dest));
  return dest;
}

function ipv4Size(prefixLen) {
  return 2 ** (32 - prefixLen);
}

async function main() {
  mkdirSync(CACHE_DIR, { recursive: true });

  console.log('Databases:');
  const originPath = join(DATA_DIR, 'origin-asn.mmdb');
  const cityPath = join(DATA_DIR, 'dbip-city-ipv4.mmdb');
  const cityV6Path = join(DATA_DIR, 'dbip-city-ipv6.mmdb');
  for (const p of [originPath, cityPath, cityV6Path]) {
    if (!existsSync(p)) {
      console.error(`Missing ${p}. Run: npm run download-db`);
      process.exit(1);
    }
  }
  const originDb = await maxmind.open(originPath);
  const cityDb = await maxmind.open(cityPath);
  const cityV6Db = await maxmind.open(cityV6Path);
  console.log('  loaded  origin-asn, dbip-city v4 + v6');

  console.log('CSV sources:');
  const paths = [];
  for (const name of CSVS) paths.push(await ensureCsv(name));

  /** asn -> { prefixes4, prefixes6, ips4, prefixes: [[cidr, size]], countries: Set } */
  const asnMap = new Map();
  /** cc -> { prefixes4, prefixes6, ips4, asnIps: Map<asn, ips> } */
  const countryMap = new Map();

  let rows = 0;

  for (const path of paths) {
    const v6 = path.includes('ipv6');
    const rl = createInterface({ input: createReadStream(path), crlfDelay: Infinity });

    for await (const line of rl) {
      if (!line) continue;
      const first = line.indexOf(',');
      if (first < 0) continue;
      const cidr = line.slice(0, first);
      const rest = line.slice(first + 1);
      const second = rest.indexOf(',');
      const asnRaw = second < 0 ? rest : rest.slice(0, second);
      const asn = Number(asnRaw);
      if (!Number.isInteger(asn) || asn <= 0) continue;

      const slash = cidr.indexOf('/');
      if (slash < 0) continue;
      const network = cidr.slice(0, slash);
      const prefixLen = Number(cidr.slice(slash + 1));
      if (!Number.isInteger(prefixLen)) continue;

      const size = v6 ? 0 : ipv4Size(prefixLen);

      let a = asnMap.get(asn);
      if (!a) {
        a = { prefixes4: 0, prefixes6: 0, ips4: 0, prefixes: [], countries: new Set() };
        asnMap.set(asn, a);
      }
      if (v6) a.prefixes6 += 1;
      else {
        a.prefixes4 += 1;
        a.ips4 += size;
      }
      a.prefixes.push([cidr, size, v6]);

      // Country attribution: look the network address up in the city database.
      // The ip-location-db builds use a flat `country_code` field; genuine MaxMind
      // builds nest it under `country.iso_code`. Read both — getting this wrong
      // yields an empty country index with no error, which is exactly what
      // happened the first time this ran.
      let cc = null;
      try {
        const rec = v6 ? cityV6Db.get(network) : cityDb.get(network);
        cc = rec?.country_code || rec?.country?.iso_code || null;
      } catch {
        cc = null;
      }

      if (cc) {
        a.countries.add(cc);
        let c = countryMap.get(cc);
        if (!c) {
          c = { prefixes4: 0, prefixes6: 0, ips4: 0, asnIps: new Map() };
          countryMap.set(cc, c);
        }
        if (v6) c.prefixes6 += 1;
        else {
          c.prefixes4 += 1;
          c.ips4 += size;
        }
        c.asnIps.set(asn, (c.asnIps.get(asn) || 0) + size);
      }

      if (++rows % 250_000 === 0) console.log(`  ${rows.toLocaleString('en-US')} prefixes…`);
    }
  }

  console.log(`Parsed ${rows.toLocaleString('en-US')} prefixes across ${asnMap.size.toLocaleString('en-US')} ASNs.`);

  // Resolve organisation names from the largest prefix of each ASN.
  console.log('Resolving organisation names…');
  const asnOut = {};
  let named = 0;

  for (const [asn, a] of asnMap) {
    a.prefixes.sort((x, y) => y[1] - x[1]);

    let name = '';
    for (const [cidr] of a.prefixes.slice(0, 3)) {
      const network = cidr.slice(0, cidr.indexOf('/'));
      try {
        const rec = originDb.get(network);
        if (rec?.autonomous_system_organization) {
          name = rec.autonomous_system_organization;
          break;
        }
      } catch {
        /* keep trying the next prefix */
      }
    }
    if (name) named += 1;

    asnOut[asn] = {
      name,
      prefixes4: a.prefixes4,
      prefixes6: a.prefixes6,
      ips4: a.ips4,
      countries: [...a.countries].sort(),
      top: a.prefixes.slice(0, TOP_PREFIXES_PER_ASN).map(([cidr]) => cidr),
    };
  }

  const countryOut = {};
  for (const [cc, c] of countryMap) {
    const topAsns = [...c.asnIps.entries()]
      .sort((x, y) => y[1] - x[1])
      .slice(0, TOP_ASNS_PER_COUNTRY)
      .map(([asn, ips]) => [asn, ips, asnOut[asn]?.name || '']);

    countryOut[cc] = {
      prefixes4: c.prefixes4,
      prefixes6: c.prefixes6,
      ips4: c.ips4,
      asnCount: c.asnIps.size,
      topAsns,
    };
  }

  // Fail loudly rather than shipping an index that quietly covers nothing.
  if (Object.keys(countryOut).length === 0) {
    console.error(
      '\nCountry attribution produced 0 countries. The city MMDB schema is not what\n' +
        'this script expects — inspect a record and update the country_code read above.',
    );
    process.exit(1);
  }
  if (named === 0) {
    console.error('\nResolved 0 organisation names. Check origin-asn.mmdb.');
    process.exit(1);
  }

  const generated = new Date().toISOString().slice(0, 10);

  await writeFile(
    join(DATA_DIR, 'asn-index.json'),
    JSON.stringify({ generated, count: Object.keys(asnOut).length, asns: asnOut }),
  );
  await writeFile(
    join(DATA_DIR, 'country-index.json'),
    JSON.stringify({ generated, count: Object.keys(countryOut).length, countries: countryOut }),
  );

  console.log(`\nWrote data/asn-index.json (${Object.keys(asnOut).length.toLocaleString('en-US')} ASNs, ${named.toLocaleString('en-US')} named)`);
  console.log(`Wrote data/country-index.json (${Object.keys(countryOut).length} countries)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
