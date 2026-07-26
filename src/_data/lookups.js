import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';

function readLookup(name) {
  const file = path.join(process.cwd(), 'src', '_data', 'lookups', `${name}.json`);
  if (!fs.existsSync(file)) return {};
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function readAllLookups() {
  const dir = path.join(process.cwd(), 'src', '_data', 'lookups');
  const lookups = fs.existsSync(dir) ? Object.fromEntries(
    fs.readdirSync(dir)
      .filter((file) => file.endsWith('.json'))
      .map((file) => [path.basename(file, '.json'), readLookup(path.basename(file, '.json'))])
  ) : {};

  const metadataDir = path.join(process.cwd(), 'src', 'metadata');
  const locations = {};
  if (fs.existsSync(metadataDir)) {
    for (const file of fs.readdirSync(metadataDir).filter(file => file.endsWith('.md'))) {
      const source = fs.readFileSync(path.join(metadataDir, file), 'utf8');
      const match = source.match(/^---\n([\s\S]*?)\n---/);
      const data = match ? yaml.load(match[1]) || {} : {};
      const value = data.place_creation || data.location;
      for (const location of Array.isArray(value) ? value : [value]) {
        if (location !== undefined && location !== null && location !== '') {
          locations[String(location)] = String(location);
        }
      }
    }
  }
  lookups.locations = { ...locations, ...(lookups.locations || {}) };

  return lookups;
}

export default readAllLookups();
