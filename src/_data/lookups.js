import fs from 'node:fs';
import path from 'node:path';

function readLookup(name) {
  const file = path.join(process.cwd(), 'src', '_data', 'lookups', `${name}.json`);
  if (!fs.existsSync(file)) return {};
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function readAllLookups() {
  const dir = path.join(process.cwd(), 'src', '_data', 'lookups');
  if (!fs.existsSync(dir)) return {};
  return Object.fromEntries(
    fs.readdirSync(dir)
      .filter((file) => file.endsWith('.json'))
      .map((file) => [path.basename(file, '.json'), readLookup(path.basename(file, '.json'))])
  );
}

export default readAllLookups();
