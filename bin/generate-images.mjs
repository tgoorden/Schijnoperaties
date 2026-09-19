#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const SUPPORTED_IMAGE_EXTENSIONS = new Set([
  '.avif',
  '.gif',
  '.heic',
  '.heif',
  '.jpeg',
  '.jpg',
  '.png',
  '.tif',
  '.tiff',
  '.webp'
]);

function usage() {
  console.log(`
Usage:
  npm run images -- --input-dir src/img/originals --output-dir src/img/resized

Options:
  --input-dir      Directory containing the original images. Default: src/img/originals
  --output-dir     Directory for resized webp derivatives. Default: src/img/resized
  --sizes          Comma-separated widths. Default: 320,640,960,1280
  --quality        WebP quality, 1-100. Default: 82
  --force          Regenerate even if output exists.
  --help, -h       Show this help.
`);
}

function parseArgs(argv) {
  const opts = {
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

async function originalImageNames(inputDir) {
  const entries = await fs.readdir(inputDir, { withFileTypes: true });
  return entries
    .filter(entry => entry.isFile())
    .map(entry => entry.name)
    .filter(name => SUPPORTED_IMAGE_EXTENSIONS.has(path.extname(name).toLowerCase()))
    .sort((a, b) => a.localeCompare(b, 'en'));
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) { usage(); return; }
  if (!opts.sizes.length) throw new Error('At least one image size is required.');

  const inputDir = path.resolve(opts.inputDir);
  const outputDir = path.resolve(opts.outputDir);
  await fs.mkdir(outputDir, { recursive: true });

  const names = await originalImageNames(inputDir);

  let generated = 0;
  for (const name of names) {
    const input = path.join(inputDir, name);
    const base = name.replace(/\.[^.]+$/, '');
    const metadata = await sharp(input).metadata();
    let generatedForImage = 0;
    for (const width of opts.sizes) {
      const output = path.join(outputDir, `${base}-${width}.webp`);
      if (!opts.force) {
        try {
          await fs.access(output);
          continue;
        } catch (error) {
          if (error.code !== 'ENOENT') throw error;
        }
      }
      await sharp(input)
        .rotate()
        .resize({ width, withoutEnlargement: true })
        .webp({ quality: opts.quality })
        .toFile(output);
      generated += 1;
      generatedForImage += 1;
    }
    if (generatedForImage > 0 && metadata.width) {
      console.log(`${name}: source ${metadata.width}px wide → generated ${generatedForImage} variant(s)`);
    }
  }

  console.log(JSON.stringify({ originalsFound: names.length, filesGenerated: generated, outputDir }, null, 2));
}

main().catch(err => {
  console.error(`Error: ${err.message}`);
  process.exit(1);
});
