import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';

const TAXONOMIES = [
  { key: 'locations', label: 'Place of origin', singular: 'Location', field: 'place_creation', aliases: ['place_creation', 'location'], dataName: 'locations', base: '/locations/' },
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

function readMetadataValues(names) {
  const dir = path.join(process.cwd(), 'src', 'metadata');
  if (!fs.existsSync(dir)) return {};
  const values = {};
  for (const file of fs.readdirSync(dir).filter(file => file.endsWith('.md'))) {
    const source = fs.readFileSync(path.join(dir, file), 'utf8');
    const match = source.match(/^---\n([\s\S]*?)\n---/);
    const data = match ? yaml.load(match[1]) || {} : {};
    const value = names.map(name => data[name]).find(candidate =>
      candidate !== undefined && candidate !== null && candidate !== ''
    );
    for (const item of Array.isArray(value) ? value : [value]) {
      if (item !== undefined && item !== null && item !== '') {
        values[String(item)] = String(item);
      }
    }
  }
  return values;
}

export default function() {
  return TAXONOMIES.flatMap((taxonomy) => {
    const lookup = {
      ...readMetadataValues(taxonomy.aliases),
      ...readLookup(taxonomy.dataName)
    };
    return Object.keys(lookup).map((key) => ({ taxonomy, key, label: toText(lookup[key]) || key }));
  });
}
