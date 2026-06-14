import fs from 'node:fs';

const TAXONOMIES = [
  { key: 'locations', label: 'Locations', singular: 'Location', field: 'location', aliases: ['location'], dataName: 'locations', base: '/locations/' },
  { key: 'subjects', label: 'Subjects', singular: 'Subject', field: 'subject', aliases: ['subject', 'subjects'], dataName: 'subjects', base: '/subjects/' }
];

function toText(value) {
  if (Array.isArray(value)) return value.map(toText).filter(Boolean).join(' · ');
  if (value && typeof value === 'object') return JSON.stringify(value);
  return String(value ?? '');
}

function readLookup(name) {
  const url = new URL(`./lookups/${name}.json`, import.meta.url);
  if (!fs.existsSync(url)) return {};
  return JSON.parse(fs.readFileSync(url, 'utf8'));
}

export default function() {
  return TAXONOMIES.flatMap((taxonomy) => {
    const lookup = readLookup(taxonomy.dataName);
    return Object.keys(lookup).map((key) => ({ taxonomy, key, label: toText(lookup[key]) || key }));
  });
}
