const EU = new Set(['AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE','IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE']);

const META = {
  IN: { currency: 'INR (₹)', callingCode: '+91', capital: 'New Delhi', languages: 'Hindi, English', continentCode: 'AS', region: 'South Asia', tld: '.in' },
  US: { currency: 'USD ($)', callingCode: '+1', capital: 'Washington, D.C.', languages: 'English', continentCode: 'NA', region: 'North America', tld: '.us' },
  GB: { currency: 'GBP (£)', callingCode: '+44', capital: 'London', languages: 'English', continentCode: 'EU', region: 'Western Europe', tld: '.uk' },
  AU: { currency: 'AUD ($)', callingCode: '+61', capital: 'Canberra', languages: 'English', continentCode: 'OC', region: 'Oceania', tld: '.au' },
  CA: { currency: 'CAD ($)', callingCode: '+1', capital: 'Ottawa', languages: 'English, French', continentCode: 'NA', region: 'North America', tld: '.ca' },
  DE: { currency: 'EUR (€)', callingCode: '+49', capital: 'Berlin', languages: 'German', continentCode: 'EU', region: 'Western Europe', tld: '.de' },
  FR: { currency: 'EUR (€)', callingCode: '+33', capital: 'Paris', languages: 'French', continentCode: 'EU', region: 'Western Europe', tld: '.fr' },
  JP: { currency: 'JPY (¥)', callingCode: '+81', capital: 'Tokyo', languages: 'Japanese', continentCode: 'AS', region: 'East Asia', tld: '.jp' },
  CN: { currency: 'CNY (¥)', callingCode: '+86', capital: 'Beijing', languages: 'Mandarin', continentCode: 'AS', region: 'East Asia', tld: '.cn' },
  SG: { currency: 'SGD ($)', callingCode: '+65', capital: 'Singapore', languages: 'English, Malay, Mandarin, Tamil', continentCode: 'AS', region: 'Southeast Asia', tld: '.sg' },
  BR: { currency: 'BRL (R$)', callingCode: '+55', capital: 'Brasília', languages: 'Portuguese', continentCode: 'SA', region: 'South America', tld: '.br' },
  NL: { currency: 'EUR (€)', callingCode: '+31', capital: 'Amsterdam', languages: 'Dutch', continentCode: 'EU', region: 'Western Europe', tld: '.nl' },
  SE: { currency: 'SEK (kr)', callingCode: '+46', capital: 'Stockholm', languages: 'Swedish', continentCode: 'EU', region: 'Northern Europe', tld: '.se' },
  RU: { currency: 'RUB (₽)', callingCode: '+7', capital: 'Moscow', languages: 'Russian', continentCode: 'EU', region: 'Eastern Europe', tld: '.ru' },
  KR: { currency: 'KRW (₩)', callingCode: '+82', capital: 'Seoul', languages: 'Korean', continentCode: 'AS', region: 'East Asia', tld: '.kr' },
};

export function getCountryMeta(code) {
  if (!code) return null;
  const c = code.toUpperCase();
  const base = META[c] ?? { continentCode: null, region: null, tld: `.${c.toLowerCase()}`, currency: null, callingCode: null, capital: null, languages: null };
  return {
    ...base,
    isEU: EU.has(c),
    gdpr: EU.has(c) || c === 'GB',
  };
}