#!/usr/bin/env node
import fs from 'node:fs/promises';
import fssync from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import sharp from 'sharp';

function usage() {
  console.log(`
Usage:
  npm run images -- --input-dir src/img/originals --output-dir src/img/resized

Options:
  --metadata-dir   Directory with generated markdown files. Default: src/metadata
  --input-dir      Directory containing the large originals named in the image field. Default: src/img/originals
  --output-dir     Directory for resized webp derivatives. Default: src/img/resized
  --sizes          Comma-separated widths. Default: 320,640,960,1280
  --quality        WebP quality, 1-100. Default: 82
  --force          Regenerate even if output exists.
  --help, -h       Show this help.
`);
}

function parseArgs(argv) {
  const opts = {
    metadataDir: 'src/metadata',
    inputDir: 'src/img/originals',
    outputDir: 'src/img/resized',
    sizes: [320, 640, 960, 1280],
    quality: 82,
    force: false
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => {
      if (i + 1 >= argv.length) throw new Error(`Missing value for ${a}`);
      return argv[++i];
    };
    switch (a) {
      case '--metadata-dir': opts.metadataDir = next(); break;
      case '--input-dir': opts.inputDir = next(); break;
      case '--output-dir': opts.outputDir = next(); break;
      case '--sizes': opts.sizes = next().split(',').map(n => Number(n.trim())).filter(Number.isFinite); break;
      case '--quality': opts.quality = Number(next()); break;
      case '--force': opts.force = true; break;
      case '--help': case '-h': opts.help = true; break;
      default: throw new Error(`Unknown option: ${a}`);
    }
  }
  return opts;
}

function frontmatter(source) {
  const match = source.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  return yaml.load(match[1]) || {};
}

function asArray(value) {
  if (value === undefined || value === null || value === '') return [];
  return Array.isArray(value) ? value : [value];
}

function imageNames(data) {
  const values = asArray(data.image || data.image_file || data.image_filename);
  return values
    .map(value => String(value).trim())
    .filter(Boolean)
    .filter(value => !/^https?:\/\//.test(value))
    .map(value => path.basename(value));
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) { usage(); return; }
  if (!opts.sizes.length) throw new Error('At least one image size is required.');

  const metadataDir = path.resolve(opts.metadataDir);
  const inputDir = path.resolve(opts.inputDir);
  const outputDir = path.resolve(opts.outputDir);
  await fs.mkdir(outputDir, { recursive: true });

  const files = (await fs.readdir(metadataDir)).filter(file => file.endsWith('.md'));
  const names = new Set();
  for (const file of files) {
    const data = frontmatter(await fs.readFile(path.join(metadataDir, file), 'utf8'));
    for (const name of imageNames(data)) names.add(name);
  }

  let generated = 0;
  let missing = 0;
  for (const name of names) {
    const input = path.join(inputDir, name);
    if (!fssync.existsSync(input)) {
      console.warn(`Missing original: ${input}`);
      missing += 1;
      continue;
    }
    const base = name.replace(/\.[^.]+$/, '');
    const metadata = await sharp(input).metadata();
    for (const width of opts.sizes) {
      const output = path.join(outputDir, `${base}-${width}.webp`);
      if (!opts.force && fssync.existsSync(output)) continue;
      await sharp(input)
        .rotate()
        .resize({ width, withoutEnlargement: true })
        .webp({ quality: opts.quality })
        .toFile(output);
      generated += 1;
    }
    if (metadata.width) {
      console.log(`${name}: source ${metadata.width}px wide → ${opts.sizes.join(', ')}px variants`);
    }
  }

  console.log(JSON.stringify({ originalsFound: names.size - missing, originalsMissing: missing, filesGenerated: generated, outputDir }, null, 2));
}

main().catch(err => {
  console.error(`Error: ${err.message}`);
  process.exit(1);
});
