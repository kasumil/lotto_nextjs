import { readFile, writeFile } from 'node:fs/promises';
const rows = JSON.parse(await readFile(new URL('../public/lotto_sellers.json', import.meta.url), 'utf8'));
if (!Array.isArray(rows)) throw new Error('Seller source must be an array');
const compact = rows.map((row) => ({
  RTLRID: String(row.RTLRID ?? ''),
  BPLCDORODTLADRES: row.BPLCDORODTLADRES ?? '',
  FIRMNM: row.FIRMNM ?? '',
  LATITUDE: Number(row.LATITUDE),
  LONGITUDE: Number(row.LONGITUDE),
  RTLRSTRTELNO: row.RTLRSTRTELNO ?? '',
})).filter((row) => Number.isFinite(row.LATITUDE) && Number.isFinite(row.LONGITUDE));
await writeFile(new URL('../public/lotto-sellers-map.json', import.meta.url), JSON.stringify(compact));
console.log(`Prepared ${compact.length} public map sellers`);
