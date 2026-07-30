/**
 * ISO 3166-1 alpha-2 country reference data.
 *
 * Stored as pipe-delimited rows rather than object literals: the table is ~250
 * entries wide and the flat form stays diffable and hard to desynchronise.
 *
 *   code | name | continent | region | currency | callingCode | capital | languages
 *
 * An empty field means "not applicable" and becomes null. Uninhabited territories
 * legitimately have no capital, calling code, or language.
 */

/** EU member states — drives the `isEU` / `gdpr` flags. */
const EU = new Set([
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU',
  'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
]);

/**
 * Non-EU territories that are nonetheless inside GDPR's scope, either as EEA
 * members or as EU outermost regions / special territories.
 */
const GDPR_EXTRA = new Set([
  'GB', // UK GDPR — functionally equivalent
  'IS', 'LI', 'NO', // EEA
  'GF', 'GP', 'MQ', 'YT', 'RE', 'MF', // French outermost regions
  'AX', // Åland (Finland)
  'PT-20', // placeholder, unused — kept out of the lookup by construction
]);

export const CONTINENT_NAMES = {
  AF: 'Africa',
  AN: 'Antarctica',
  AS: 'Asia',
  EU: 'Europe',
  NA: 'North America',
  OC: 'Oceania',
  SA: 'South America',
};

const ROWS = `
AD|Andorra|EU|Southern Europe|EUR (€)|+376|Andorra la Vella|Catalan
AE|United Arab Emirates|AS|Western Asia|AED (د.إ)|+971|Abu Dhabi|Arabic
AF|Afghanistan|AS|South Asia|AFN (؋)|+93|Kabul|Pashto, Dari
AG|Antigua and Barbuda|NA|Caribbean|XCD ($)|+1-268|Saint John's|English
AI|Anguilla|NA|Caribbean|XCD ($)|+1-264|The Valley|English
AL|Albania|EU|Southern Europe|ALL (L)|+355|Tirana|Albanian
AM|Armenia|AS|Western Asia|AMD (֏)|+374|Yerevan|Armenian
AO|Angola|AF|Middle Africa|AOA (Kz)|+244|Luanda|Portuguese
AQ|Antarctica|AN|Antarctica|||
AR|Argentina|SA|South America|ARS ($)|+54|Buenos Aires|Spanish
AS|American Samoa|OC|Polynesia|USD ($)|+1-684|Pago Pago|English, Samoan
AT|Austria|EU|Western Europe|EUR (€)|+43|Vienna|German
AU|Australia|OC|Australia and New Zealand|AUD ($)|+61|Canberra|English
AW|Aruba|NA|Caribbean|AWG (ƒ)|+297|Oranjestad|Dutch, Papiamento
AX|Åland Islands|EU|Northern Europe|EUR (€)|+358|Mariehamn|Swedish
AZ|Azerbaijan|AS|Western Asia|AZN (₼)|+994|Baku|Azerbaijani
BA|Bosnia and Herzegovina|EU|Southern Europe|BAM (KM)|+387|Sarajevo|Bosnian, Croatian, Serbian
BB|Barbados|NA|Caribbean|BBD ($)|+1-246|Bridgetown|English
BD|Bangladesh|AS|South Asia|BDT (৳)|+880|Dhaka|Bengali
BE|Belgium|EU|Western Europe|EUR (€)|+32|Brussels|Dutch, French, German
BF|Burkina Faso|AF|Western Africa|XOF (Fr)|+226|Ouagadougou|French
BG|Bulgaria|EU|Eastern Europe|BGN (лв)|+359|Sofia|Bulgarian
BH|Bahrain|AS|Western Asia|BHD (.د.ب)|+973|Manama|Arabic
BI|Burundi|AF|Eastern Africa|BIF (Fr)|+257|Gitega|Kirundi, French
BJ|Benin|AF|Western Africa|XOF (Fr)|+229|Porto-Novo|French
BL|Saint Barthélemy|NA|Caribbean|EUR (€)|+590|Gustavia|French
BM|Bermuda|NA|Northern America|BMD ($)|+1-441|Hamilton|English
BN|Brunei|AS|Southeast Asia|BND ($)|+673|Bandar Seri Begawan|Malay
BO|Bolivia|SA|South America|BOB (Bs.)|+591|Sucre|Spanish, Quechua, Aymara
BQ|Caribbean Netherlands|NA|Caribbean|USD ($)|+599|Kralendijk|Dutch
BR|Brazil|SA|South America|BRL (R$)|+55|Brasília|Portuguese
BS|Bahamas|NA|Caribbean|BSD ($)|+1-242|Nassau|English
BT|Bhutan|AS|South Asia|BTN (Nu.)|+975|Thimphu|Dzongkha
BV|Bouvet Island|AN|Antarctica|NOK (kr)|||
BW|Botswana|AF|Southern Africa|BWP (P)|+267|Gaborone|English, Tswana
BY|Belarus|EU|Eastern Europe|BYN (Br)|+375|Minsk|Belarusian, Russian
BZ|Belize|NA|Central America|BZD ($)|+501|Belmopan|English
CA|Canada|NA|Northern America|CAD ($)|+1|Ottawa|English, French
CC|Cocos (Keeling) Islands|OC|Australia and New Zealand|AUD ($)|+61|West Island|English
CD|DR Congo|AF|Middle Africa|CDF (Fr)|+243|Kinshasa|French
CF|Central African Republic|AF|Middle Africa|XAF (Fr)|+236|Bangui|French, Sango
CG|Congo|AF|Middle Africa|XAF (Fr)|+242|Brazzaville|French
CH|Switzerland|EU|Western Europe|CHF (Fr)|+41|Bern|German, French, Italian, Romansh
CI|Côte d'Ivoire|AF|Western Africa|XOF (Fr)|+225|Yamoussoukro|French
CK|Cook Islands|OC|Polynesia|NZD ($)|+682|Avarua|English, Cook Islands Māori
CL|Chile|SA|South America|CLP ($)|+56|Santiago|Spanish
CM|Cameroon|AF|Middle Africa|XAF (Fr)|+237|Yaoundé|French, English
CN|China|AS|East Asia|CNY (¥)|+86|Beijing|Mandarin
CO|Colombia|SA|South America|COP ($)|+57|Bogotá|Spanish
CR|Costa Rica|NA|Central America|CRC (₡)|+506|San José|Spanish
CU|Cuba|NA|Caribbean|CUP ($)|+53|Havana|Spanish
CV|Cape Verde|AF|Western Africa|CVE ($)|+238|Praia|Portuguese
CW|Curaçao|NA|Caribbean|ANG (ƒ)|+599|Willemstad|Dutch, Papiamento
CX|Christmas Island|OC|Australia and New Zealand|AUD ($)|+61|Flying Fish Cove|English
CY|Cyprus|EU|Southern Europe|EUR (€)|+357|Nicosia|Greek, Turkish
CZ|Czechia|EU|Eastern Europe|CZK (Kč)|+420|Prague|Czech
DE|Germany|EU|Western Europe|EUR (€)|+49|Berlin|German
DJ|Djibouti|AF|Eastern Africa|DJF (Fr)|+253|Djibouti|French, Arabic
DK|Denmark|EU|Northern Europe|DKK (kr)|+45|Copenhagen|Danish
DM|Dominica|NA|Caribbean|XCD ($)|+1-767|Roseau|English
DO|Dominican Republic|NA|Caribbean|DOP ($)|+1-809|Santo Domingo|Spanish
DZ|Algeria|AF|Northern Africa|DZD (د.ج)|+213|Algiers|Arabic, Berber
EC|Ecuador|SA|South America|USD ($)|+593|Quito|Spanish
EE|Estonia|EU|Northern Europe|EUR (€)|+372|Tallinn|Estonian
EG|Egypt|AF|Northern Africa|EGP (£)|+20|Cairo|Arabic
EH|Western Sahara|AF|Northern Africa|MAD (د.م.)|+212|Laayoune|Arabic
ER|Eritrea|AF|Eastern Africa|ERN (Nfk)|+291|Asmara|Tigrinya, Arabic, English
ES|Spain|EU|Southern Europe|EUR (€)|+34|Madrid|Spanish
ET|Ethiopia|AF|Eastern Africa|ETB (Br)|+251|Addis Ababa|Amharic
FI|Finland|EU|Northern Europe|EUR (€)|+358|Helsinki|Finnish, Swedish
FJ|Fiji|OC|Melanesia|FJD ($)|+679|Suva|English, Fijian, Fiji Hindi
FK|Falkland Islands|SA|South America|FKP (£)|+500|Stanley|English
FM|Micronesia|OC|Micronesia|USD ($)|+691|Palikir|English
FO|Faroe Islands|EU|Northern Europe|DKK (kr)|+298|Tórshavn|Faroese, Danish
FR|France|EU|Western Europe|EUR (€)|+33|Paris|French
GA|Gabon|AF|Middle Africa|XAF (Fr)|+241|Libreville|French
GB|United Kingdom|EU|Northern Europe|GBP (£)|+44|London|English
GD|Grenada|NA|Caribbean|XCD ($)|+1-473|St. George's|English
GE|Georgia|AS|Western Asia|GEL (₾)|+995|Tbilisi|Georgian
GF|French Guiana|SA|South America|EUR (€)|+594|Cayenne|French
GG|Guernsey|EU|Northern Europe|GBP (£)|+44|St Peter Port|English
GH|Ghana|AF|Western Africa|GHS (₵)|+233|Accra|English
GI|Gibraltar|EU|Southern Europe|GIP (£)|+350|Gibraltar|English
GL|Greenland|NA|Northern America|DKK (kr)|+299|Nuuk|Greenlandic
GM|Gambia|AF|Western Africa|GMD (D)|+220|Banjul|English
GN|Guinea|AF|Western Africa|GNF (Fr)|+224|Conakry|French
GP|Guadeloupe|NA|Caribbean|EUR (€)|+590|Basse-Terre|French
GQ|Equatorial Guinea|AF|Middle Africa|XAF (Fr)|+240|Malabo|Spanish, French, Portuguese
GR|Greece|EU|Southern Europe|EUR (€)|+30|Athens|Greek
GS|South Georgia and the South Sandwich Islands|AN|Antarctica|GBP (£)|||English
GT|Guatemala|NA|Central America|GTQ (Q)|+502|Guatemala City|Spanish
GU|Guam|OC|Micronesia|USD ($)|+1-671|Hagåtña|English, Chamorro
GW|Guinea-Bissau|AF|Western Africa|XOF (Fr)|+245|Bissau|Portuguese
GY|Guyana|SA|South America|GYD ($)|+592|Georgetown|English
HK|Hong Kong|AS|East Asia|HKD ($)|+852|Hong Kong|Cantonese, English
HM|Heard Island and McDonald Islands|AN|Antarctica|AUD ($)|||
HN|Honduras|NA|Central America|HNL (L)|+504|Tegucigalpa|Spanish
HR|Croatia|EU|Southern Europe|EUR (€)|+385|Zagreb|Croatian
HT|Haiti|NA|Caribbean|HTG (G)|+509|Port-au-Prince|French, Haitian Creole
HU|Hungary|EU|Eastern Europe|HUF (Ft)|+36|Budapest|Hungarian
ID|Indonesia|AS|Southeast Asia|IDR (Rp)|+62|Jakarta|Indonesian
IE|Ireland|EU|Northern Europe|EUR (€)|+353|Dublin|English, Irish
IL|Israel|AS|Western Asia|ILS (₪)|+972|Jerusalem|Hebrew, Arabic
IM|Isle of Man|EU|Northern Europe|GBP (£)|+44|Douglas|English, Manx
IN|India|AS|South Asia|INR (₹)|+91|New Delhi|Hindi, English
IO|British Indian Ocean Territory|AS|Indian Ocean|USD ($)|+246|Diego Garcia|English
IQ|Iraq|AS|Western Asia|IQD (ع.د)|+964|Baghdad|Arabic, Kurdish
IR|Iran|AS|South Asia|IRR (﷼)|+98|Tehran|Persian
IS|Iceland|EU|Northern Europe|ISK (kr)|+354|Reykjavík|Icelandic
IT|Italy|EU|Southern Europe|EUR (€)|+39|Rome|Italian
JE|Jersey|EU|Northern Europe|GBP (£)|+44|Saint Helier|English
JM|Jamaica|NA|Caribbean|JMD ($)|+1-876|Kingston|English
JO|Jordan|AS|Western Asia|JOD (د.ا)|+962|Amman|Arabic
JP|Japan|AS|East Asia|JPY (¥)|+81|Tokyo|Japanese
KE|Kenya|AF|Eastern Africa|KES (Sh)|+254|Nairobi|Swahili, English
KG|Kyrgyzstan|AS|Central Asia|KGS (с)|+996|Bishkek|Kyrgyz, Russian
KH|Cambodia|AS|Southeast Asia|KHR (៛)|+855|Phnom Penh|Khmer
KI|Kiribati|OC|Micronesia|AUD ($)|+686|South Tarawa|English, Gilbertese
KM|Comoros|AF|Eastern Africa|KMF (Fr)|+269|Moroni|Comorian, Arabic, French
KN|Saint Kitts and Nevis|NA|Caribbean|XCD ($)|+1-869|Basseterre|English
KP|North Korea|AS|East Asia|KPW (₩)|+850|Pyongyang|Korean
KR|South Korea|AS|East Asia|KRW (₩)|+82|Seoul|Korean
KW|Kuwait|AS|Western Asia|KWD (د.ك)|+965|Kuwait City|Arabic
KY|Cayman Islands|NA|Caribbean|KYD ($)|+1-345|George Town|English
KZ|Kazakhstan|AS|Central Asia|KZT (₸)|+7|Astana|Kazakh, Russian
LA|Laos|AS|Southeast Asia|LAK (₭)|+856|Vientiane|Lao
LB|Lebanon|AS|Western Asia|LBP (ل.ل)|+961|Beirut|Arabic
LC|Saint Lucia|NA|Caribbean|XCD ($)|+1-758|Castries|English
LI|Liechtenstein|EU|Western Europe|CHF (Fr)|+423|Vaduz|German
LK|Sri Lanka|AS|South Asia|LKR (Rs)|+94|Sri Jayawardenepura Kotte|Sinhala, Tamil
LR|Liberia|AF|Western Africa|LRD ($)|+231|Monrovia|English
LS|Lesotho|AF|Southern Africa|LSL (L)|+266|Maseru|Sesotho, English
LT|Lithuania|EU|Northern Europe|EUR (€)|+370|Vilnius|Lithuanian
LU|Luxembourg|EU|Western Europe|EUR (€)|+352|Luxembourg|Luxembourgish, French, German
LV|Latvia|EU|Northern Europe|EUR (€)|+371|Riga|Latvian
LY|Libya|AF|Northern Africa|LYD (ل.د)|+218|Tripoli|Arabic
MA|Morocco|AF|Northern Africa|MAD (د.م.)|+212|Rabat|Arabic, Berber
MC|Monaco|EU|Western Europe|EUR (€)|+377|Monaco|French
MD|Moldova|EU|Eastern Europe|MDL (L)|+373|Chișinău|Romanian
ME|Montenegro|EU|Southern Europe|EUR (€)|+382|Podgorica|Montenegrin
MF|Saint Martin|NA|Caribbean|EUR (€)|+590|Marigot|French
MG|Madagascar|AF|Eastern Africa|MGA (Ar)|+261|Antananarivo|Malagasy, French
MH|Marshall Islands|OC|Micronesia|USD ($)|+692|Majuro|Marshallese, English
MK|North Macedonia|EU|Southern Europe|MKD (ден)|+389|Skopje|Macedonian
ML|Mali|AF|Western Africa|XOF (Fr)|+223|Bamako|French
MM|Myanmar|AS|Southeast Asia|MMK (Ks)|+95|Naypyidaw|Burmese
MN|Mongolia|AS|East Asia|MNT (₮)|+976|Ulaanbaatar|Mongolian
MO|Macao|AS|East Asia|MOP (P)|+853|Macao|Cantonese, Portuguese
MP|Northern Mariana Islands|OC|Micronesia|USD ($)|+1-670|Saipan|English, Chamorro
MQ|Martinique|NA|Caribbean|EUR (€)|+596|Fort-de-France|French
MR|Mauritania|AF|Western Africa|MRU (UM)|+222|Nouakchott|Arabic
MS|Montserrat|NA|Caribbean|XCD ($)|+1-664|Plymouth|English
MT|Malta|EU|Southern Europe|EUR (€)|+356|Valletta|Maltese, English
MU|Mauritius|AF|Eastern Africa|MUR (₨)|+230|Port Louis|English, French
MV|Maldives|AS|South Asia|MVR (.ރ)|+960|Malé|Dhivehi
MW|Malawi|AF|Eastern Africa|MWK (MK)|+265|Lilongwe|English, Chichewa
MX|Mexico|NA|Central America|MXN ($)|+52|Mexico City|Spanish
MY|Malaysia|AS|Southeast Asia|MYR (RM)|+60|Kuala Lumpur|Malay
MZ|Mozambique|AF|Eastern Africa|MZN (MT)|+258|Maputo|Portuguese
NA|Namibia|AF|Southern Africa|NAD ($)|+264|Windhoek|English
NC|New Caledonia|OC|Melanesia|XPF (Fr)|+687|Nouméa|French
NE|Niger|AF|Western Africa|XOF (Fr)|+227|Niamey|French
NF|Norfolk Island|OC|Australia and New Zealand|AUD ($)|+672|Kingston|English
NG|Nigeria|AF|Western Africa|NGN (₦)|+234|Abuja|English
NI|Nicaragua|NA|Central America|NIO (C$)|+505|Managua|Spanish
NL|Netherlands|EU|Western Europe|EUR (€)|+31|Amsterdam|Dutch
NO|Norway|EU|Northern Europe|NOK (kr)|+47|Oslo|Norwegian
NP|Nepal|AS|South Asia|NPR (₨)|+977|Kathmandu|Nepali
NR|Nauru|OC|Micronesia|AUD ($)|+674|Yaren|Nauruan, English
NU|Niue|OC|Polynesia|NZD ($)|+683|Alofi|Niuean, English
NZ|New Zealand|OC|Australia and New Zealand|NZD ($)|+64|Wellington|English, Māori
OM|Oman|AS|Western Asia|OMR (ر.ع.)|+968|Muscat|Arabic
PA|Panama|NA|Central America|PAB (B/.)|+507|Panama City|Spanish
PE|Peru|SA|South America|PEN (S/)|+51|Lima|Spanish, Quechua
PF|French Polynesia|OC|Polynesia|XPF (Fr)|+689|Papeete|French
PG|Papua New Guinea|OC|Melanesia|PGK (K)|+675|Port Moresby|English, Tok Pisin
PH|Philippines|AS|Southeast Asia|PHP (₱)|+63|Manila|Filipino, English
PK|Pakistan|AS|South Asia|PKR (₨)|+92|Islamabad|Urdu, English
PL|Poland|EU|Eastern Europe|PLN (zł)|+48|Warsaw|Polish
PM|Saint Pierre and Miquelon|NA|Northern America|EUR (€)|+508|Saint-Pierre|French
PN|Pitcairn Islands|OC|Polynesia|NZD ($)|+64|Adamstown|English
PR|Puerto Rico|NA|Caribbean|USD ($)|+1-787|San Juan|Spanish, English
PS|Palestine|AS|Western Asia|ILS (₪)|+970|Ramallah|Arabic
PT|Portugal|EU|Southern Europe|EUR (€)|+351|Lisbon|Portuguese
PW|Palau|OC|Micronesia|USD ($)|+680|Ngerulmud|Palauan, English
PY|Paraguay|SA|South America|PYG (₲)|+595|Asunción|Spanish, Guaraní
QA|Qatar|AS|Western Asia|QAR (ر.ق)|+974|Doha|Arabic
RE|Réunion|AF|Eastern Africa|EUR (€)|+262|Saint-Denis|French
RO|Romania|EU|Eastern Europe|RON (lei)|+40|Bucharest|Romanian
RS|Serbia|EU|Southern Europe|RSD (дин)|+381|Belgrade|Serbian
RU|Russia|EU|Eastern Europe|RUB (₽)|+7|Moscow|Russian
RW|Rwanda|AF|Eastern Africa|RWF (Fr)|+250|Kigali|Kinyarwanda, English, French
SA|Saudi Arabia|AS|Western Asia|SAR (ر.س)|+966|Riyadh|Arabic
SB|Solomon Islands|OC|Melanesia|SBD ($)|+677|Honiara|English
SC|Seychelles|AF|Eastern Africa|SCR (₨)|+248|Victoria|Seychellois Creole, English, French
SD|Sudan|AF|Northern Africa|SDG (ج.س)|+249|Khartoum|Arabic, English
SE|Sweden|EU|Northern Europe|SEK (kr)|+46|Stockholm|Swedish
SG|Singapore|AS|Southeast Asia|SGD ($)|+65|Singapore|English, Malay, Mandarin, Tamil
SH|Saint Helena|AF|Western Africa|SHP (£)|+290|Jamestown|English
SI|Slovenia|EU|Southern Europe|EUR (€)|+386|Ljubljana|Slovene
SJ|Svalbard and Jan Mayen|EU|Northern Europe|NOK (kr)|+47|Longyearbyen|Norwegian
SK|Slovakia|EU|Eastern Europe|EUR (€)|+421|Bratislava|Slovak
SL|Sierra Leone|AF|Western Africa|SLE (Le)|+232|Freetown|English
SM|San Marino|EU|Southern Europe|EUR (€)|+378|San Marino|Italian
SN|Senegal|AF|Western Africa|XOF (Fr)|+221|Dakar|French
SO|Somalia|AF|Eastern Africa|SOS (Sh)|+252|Mogadishu|Somali, Arabic
SR|Suriname|SA|South America|SRD ($)|+597|Paramaribo|Dutch
SS|South Sudan|AF|Eastern Africa|SSP (£)|+211|Juba|English
ST|São Tomé and Príncipe|AF|Middle Africa|STN (Db)|+239|São Tomé|Portuguese
SV|El Salvador|NA|Central America|USD ($)|+503|San Salvador|Spanish
SX|Sint Maarten|NA|Caribbean|ANG (ƒ)|+1-721|Philipsburg|Dutch, English
SY|Syria|AS|Western Asia|SYP (£)|+963|Damascus|Arabic
SZ|Eswatini|AF|Southern Africa|SZL (L)|+268|Mbabane|Swazi, English
TC|Turks and Caicos Islands|NA|Caribbean|USD ($)|+1-649|Cockburn Town|English
TD|Chad|AF|Middle Africa|XAF (Fr)|+235|N'Djamena|French, Arabic
TF|French Southern Territories|AN|Antarctica|EUR (€)||Port-aux-Français|French
TG|Togo|AF|Western Africa|XOF (Fr)|+228|Lomé|French
TH|Thailand|AS|Southeast Asia|THB (฿)|+66|Bangkok|Thai
TJ|Tajikistan|AS|Central Asia|TJS (ЅМ)|+992|Dushanbe|Tajik
TK|Tokelau|OC|Polynesia|NZD ($)|+690||Tokelauan, English
TL|Timor-Leste|AS|Southeast Asia|USD ($)|+670|Dili|Tetum, Portuguese
TM|Turkmenistan|AS|Central Asia|TMT (m)|+993|Ashgabat|Turkmen
TN|Tunisia|AF|Northern Africa|TND (د.ت)|+216|Tunis|Arabic
TO|Tonga|OC|Polynesia|TOP (T$)|+676|Nuku'alofa|Tongan, English
TR|Türkiye|AS|Western Asia|TRY (₺)|+90|Ankara|Turkish
TT|Trinidad and Tobago|NA|Caribbean|TTD ($)|+1-868|Port of Spain|English
TV|Tuvalu|OC|Polynesia|AUD ($)|+688|Funafuti|Tuvaluan, English
TW|Taiwan|AS|East Asia|TWD (NT$)|+886|Taipei|Mandarin
TZ|Tanzania|AF|Eastern Africa|TZS (Sh)|+255|Dodoma|Swahili, English
UA|Ukraine|EU|Eastern Europe|UAH (₴)|+380|Kyiv|Ukrainian
UG|Uganda|AF|Eastern Africa|UGX (Sh)|+256|Kampala|English, Swahili
UM|United States Minor Outlying Islands|OC|Micronesia|USD ($)|||English
US|United States|NA|Northern America|USD ($)|+1|Washington, D.C.|English
UY|Uruguay|SA|South America|UYU ($)|+598|Montevideo|Spanish
UZ|Uzbekistan|AS|Central Asia|UZS (so'm)|+998|Tashkent|Uzbek
VA|Vatican City|EU|Southern Europe|EUR (€)|+379|Vatican City|Italian, Latin
VC|Saint Vincent and the Grenadines|NA|Caribbean|XCD ($)|+1-784|Kingstown|English
VE|Venezuela|SA|South America|VES (Bs.)|+58|Caracas|Spanish
VG|British Virgin Islands|NA|Caribbean|USD ($)|+1-284|Road Town|English
VI|United States Virgin Islands|NA|Caribbean|USD ($)|+1-340|Charlotte Amalie|English
VN|Vietnam|AS|Southeast Asia|VND (₫)|+84|Hanoi|Vietnamese
VU|Vanuatu|OC|Melanesia|VUV (Vt)|+678|Port Vila|Bislama, English, French
WF|Wallis and Futuna|OC|Polynesia|XPF (Fr)|+681|Mata-Utu|French
WS|Samoa|OC|Polynesia|WST (T)|+685|Apia|Samoan, English
XK|Kosovo|EU|Southern Europe|EUR (€)|+383|Pristina|Albanian, Serbian
YE|Yemen|AS|Western Asia|YER (﷼)|+967|Sanaa|Arabic
YT|Mayotte|AF|Eastern Africa|EUR (€)|+262|Mamoudzou|French
ZA|South Africa|AF|Southern Africa|ZAR (R)|+27|Pretoria|Afrikaans, English, Zulu, Xhosa
ZM|Zambia|AF|Eastern Africa|ZMW (K)|+260|Lusaka|English
ZW|Zimbabwe|AF|Eastern Africa|ZWG (Z$)|+263|Harare|English, Shona, Ndebele
`;

/**
 * MaxMind and other providers emit non-ISO placeholder codes for traffic they
 * cannot attribute to a country. Naming them beats rendering a bare code.
 */
const PSEUDO = {
  EU: { name: 'Europe (unattributed)', continentCode: 'EU', region: 'Europe' },
  AP: { name: 'Asia/Pacific (unattributed)', continentCode: 'AS', region: 'Asia-Pacific' },
  A1: { name: 'Anonymous Proxy', continentCode: null, region: null },
  A2: { name: 'Satellite Provider', continentCode: null, region: null },
  O1: { name: 'Other Country', continentCode: null, region: null },
};

const nz = (s) => {
  const t = s.trim();
  return t === '' ? null : t;
};

const META = {};
for (const line of ROWS.trim().split('\n')) {
  const [code, name, continentCode, region, currency, callingCode, capital, languages] =
    line.split('|');
  META[code] = {
    name: name.trim(),
    continentCode: nz(continentCode),
    region: nz(region),
    currency: nz(currency ?? ''),
    callingCode: nz(callingCode ?? ''),
    capital: nz(capital ?? ''),
    languages: nz(languages ?? ''),
    tld: `.${code.toLowerCase()}`,
  };
}

/** Every ISO code in the table, sorted — the country-page URL universe. */
export const COUNTRY_CODES = Object.keys(META).sort();

/** Display name for an ISO 3166-1 alpha-2 code, or null if unknown. */
export function getCountryName(code) {
  if (!code) return null;
  const c = String(code).toUpperCase();
  return META[c]?.name ?? PSEUDO[c]?.name ?? null;
}

/** True if the code is a real ISO country/territory we can build a page for. */
export function isKnownCountry(code) {
  return Boolean(code) && Object.hasOwn(META, String(code).toUpperCase());
}

export function getCountryMeta(code) {
  if (!code) return null;
  const c = String(code).toUpperCase();

  const base = META[c] ??
    PSEUDO[c] ?? {
      name: null,
      continentCode: null,
      region: null,
      currency: null,
      callingCode: null,
      capital: null,
      languages: null,
    };

  return {
    // The `.xx` TLD guess only holds for real ISO codes; pseudo codes get none.
    tld: META[c] ? base.tld : null,
    ...base,
    continent: base.continentCode ? (CONTINENT_NAMES[base.continentCode] ?? null) : null,
    isEU: EU.has(c),
    gdpr: EU.has(c) || GDPR_EXTRA.has(c),
  };
}

/** Codes grouped by continent, for continent listings on country pages. */
export function countriesByContinent() {
  const out = {};
  for (const code of COUNTRY_CODES) {
    const cc = META[code].continentCode;
    if (!cc) continue;
    (out[cc] ??= []).push(code);
  }
  return out;
}
