#!/usr/bin/env node
import fs from 'node:fs/promises';
import fssync from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import ExcelJS from 'exceljs';
import yaml from 'js-yaml';
import slugify from 'slugify';

function usage() {
  console.log(`
Usage:
  npx xls-to-11ty --input workbook.xlsx --out src

Options:
  --input, -i              Input .xlsx file. .xls is attempted via LibreOffice conversion.
  --out, -o                Output folder. Default: ./dist-11ty-data
  --main-sheet             Main collection sheet name. Default: first sheet.
  --main-sheet-index       1-based main collection sheet index. Used only if --main-sheet is omitted.
  --collection-folder      Folder for generated markdown. Default: main sheet name.
  --data-folder            Folder for lookup JSON files. Default: _data/lookups
  --img-folder             Folder for extracted images. Default: img
  --image-name-column      Column whose value is appended to image filenames, e.g. Title.
  --file-name-column       Column whose value is appended to markdown filenames.
  --image-url-prefix       Frontmatter path prefix for images. Default: /img/
  --image-filename-frontmatter-key
                          YAML key for extracted image filename(s). Default: image_file.
                          Use an empty value to disable this extra key.
  --preserve-header-case   Use column headers as YAML keys exactly as written, except unsafe characters.
  --omit-empty             Omit empty cells from markdown frontmatter. Default: keep as empty string.
  --dry-run                Print what would be exported, without writing files.
  --help, -h               Show this help.

Examples:
  npm run convert -- --input test.xlsx --out ./src --image-name-column Title
  node bin/xls-to-11ty.mjs -i test.xlsx -o ./src --main-sheet metadata --file-name-column Title
`);
}

function parseArgs(argv) {
  const opts = {
    out: './src',
    dataFolder: '_data/lookups',
    imgFolder: 'img',
    imageUrlPrefix: '/img/',
    imageFilenameFrontmatterKey: 'image_file',
    fileNameColumn: 'Title',
    preserveHeaderCase: false,
    omitEmpty: false,
    dryRun: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => {
      if (i + 1 >= argv.length) throw new Error(`Missing value for ${a}`);
      return argv[++i];
    };
    switch (a) {
      case '--input': case '-i': opts.input = next(); break;
      case '--out': case '-o': opts.out = next(); break;
      case '--main-sheet': opts.mainSheet = next(); break;
      case '--main-sheet-index': opts.mainSheetIndex = Number(next()); break;
      case '--collection-folder': opts.collectionFolder = next(); break;
      case '--data-folder': opts.dataFolder = next(); break;
      case '--img-folder': opts.imgFolder = next(); break;
      case '--image-name-column': opts.imageNameColumn = next(); break;
      case '--file-name-column': opts.fileNameColumn = next(); break;
      case '--image-url-prefix': opts.imageUrlPrefix = next(); break;
      case '--image-filename-frontmatter-key': opts.imageFilenameFrontmatterKey = next(); break;
      case '--preserve-header-case': opts.preserveHeaderCase = true; break;
      case '--omit-empty': opts.omitEmpty = true; break;
      case '--dry-run': opts.dryRun = true; break;
      case '--help': case '-h': opts.help = true; break;
      default: throw new Error(`Unknown option: ${a}`);
    }
  }
  return opts;
}

function pad3(n) {
  return String(n).padStart(3, '0');
}

function makeSlug(value, fallback = 'item') {
  const s = slugify(String(value ?? ''), {
    lower: true,
    strict: true,
    trim: true,
    locale: 'en',
  });
  return s || fallback;
}

function yamlKey(header, preserve) {
  const raw = String(header ?? '').trim();
  if (!raw) return '';
  if (preserve) return raw.replace(/[\r\n]+/g, ' ').replace(/:/g, '_').trim();
  // Keep meaningful underscores from source headers such as date_start and credit_line.
  const normalized = raw
    .replace(/[\r\n]+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
    .replace(/[^a-z0-9_]+/g, '')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
  return normalized;
}

function isEmptyValue(v) {
  return v === null || v === undefined || v === '';
}

function cellToPlainValue(cell) {
  const v = cell?.value;
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'object') {
    if (Array.isArray(v.richText)) return v.richText.map(x => x.text ?? '').join('');
    if ('hyperlink' in v && 'text' in v) return v.text || v.hyperlink || '';
    if ('formula' in v) return v.result ?? '';
    if ('result' in v) return v.result ?? '';
    if ('text' in v) return v.text ?? '';
    if ('error' in v) return v.error ?? '';
  }
  return v;
}

function normalizeValue(value) {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (trimmed.includes(';')) {
    return trimmed
      .split(';')
      .map(part => part.trim())
      .filter(Boolean);
  }
  return trimmed;
}

function findHeaderIndex(headers, requested) {
  if (!requested) return -1;
  const needleSlug = makeSlug(requested);
  const needleKey = yamlKey(requested, false);
  return headers.findIndex(h => {
    const raw = String(h.raw ?? '').trim();
    return raw === requested || makeSlug(raw) === needleSlug || h.key === needleKey;
  });
}

async function ensureCleanDir(dir, dryRun) {
  if (dryRun) return;
  await fs.mkdir(dir, { recursive: true });
}

function asJsonKey(v) {
  if (v === null || v === undefined) return '';
  return String(v).trim();
}

function getCellImageMap(workbook, worksheet) {
  const map = new Map();
  if (typeof worksheet.getImages !== 'function') return map;
  for (const img of worksheet.getImages()) {
    const tl = img.range?.tl;
    if (!tl) continue;
    const row = (tl.nativeRow ?? tl.row ?? 0) + 1;
    const col = (tl.nativeCol ?? tl.col ?? 0) + 1;
    const key = `${row}:${col}`;
    if (!map.has(key)) map.set(key, []);
    const media = typeof workbook.getImage === 'function'
      ? workbook.getImage(img.imageId)
      : (workbook.model?.media || []).find(m => m.index === img.imageId || m.name === img.imageId || m.id === img.imageId);
    if (media) map.get(key).push({ ...img, media });
  }
  return map;
}

function imageBuffer(media) {
  if (media.buffer) return Buffer.isBuffer(media.buffer) ? media.buffer : Buffer.from(media.buffer);
  if (media.base64) {
    const b64 = String(media.base64).replace(/^data:[^;]+;base64,/, '');
    return Buffer.from(b64, 'base64');
  }
  return null;
}

function mediaExtension(media) {
  const ext = String(media.extension || media.type || '').replace(/^\./, '').toLowerCase();
  if (ext === 'jpeg') return 'jpg';
  return ext || 'bin';
}

async function convertXlsIfNeeded(input) {
  const ext = path.extname(input).toLowerCase();
  if (ext !== '.xls') return input;
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'xls-to-11ty-'));
  try {
    execFileSync('soffice', ['--headless', '--convert-to', 'xlsx', '--outdir', tmp, input], { stdio: 'pipe' });
  } catch (err) {
    throw new Error('This script can read .xlsx directly. For legacy .xls, install LibreOffice so the `soffice` command can convert it to .xlsx first.');
  }
  const converted = path.join(tmp, `${path.basename(input, path.extname(input))}.xlsx`);
  if (!fssync.existsSync(converted)) throw new Error('LibreOffice conversion ran, but no .xlsx output was found.');
  return converted;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) { usage(); return; }
  if (!opts.input) throw new Error('Missing --input workbook.xlsx');

  const input = await convertXlsIfNeeded(path.resolve(opts.input));
  const outDir = path.resolve(opts.out);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(input);
  if (!workbook.worksheets.length) throw new Error('Workbook has no worksheets.');

  let mainSheet;
  if (opts.mainSheet) {
    mainSheet = workbook.getWorksheet(opts.mainSheet);
    if (!mainSheet) throw new Error(`Main sheet not found: ${opts.mainSheet}`);
  } else if (opts.mainSheetIndex) {
    mainSheet = workbook.worksheets[opts.mainSheetIndex - 1];
    if (!mainSheet) throw new Error(`Main sheet index not found: ${opts.mainSheetIndex}`);
  } else {
    mainSheet = workbook.worksheets[0];
  }

  const collectionName = makeSlug(opts.collectionFolder || mainSheet.name, 'collection');
  const collectionDir = path.join(outDir, collectionName);
  const dataDir = path.join(outDir, opts.dataFolder);
  const imgDir = path.join(outDir, opts.imgFolder);

  await ensureCleanDir(collectionDir, opts.dryRun);
  await ensureCleanDir(dataDir, opts.dryRun);
  await ensureCleanDir(imgDir, opts.dryRun);

  const headerRow = mainSheet.getRow(1);
  const headers = [];
  for (let col = 1; col <= headerRow.cellCount; col++) {
    const raw = cellToPlainValue(headerRow.getCell(col));
    const key = yamlKey(raw, opts.preserveHeaderCase);
    headers.push({ col, raw, key: key || `column_${col}` });
  }

  const imageNameIdx = findHeaderIndex(headers, opts.imageNameColumn);
  const fileNameIdx = findHeaderIndex(headers, opts.fileNameColumn);
  const cellImages = getCellImageMap(workbook, mainSheet);

  let mdCount = 0;
  let imageCount = 0;
  const imageFilenameSeen = new Map();

  for (let rowNumber = 2; rowNumber <= mainSheet.rowCount; rowNumber++) {
    const row = mainSheet.getRow(rowNumber);
    const hasContent = headers.some(h => !isEmptyValue(cellToPlainValue(row.getCell(h.col)))) ||
      [...cellImages.keys()].some(k => k.startsWith(`${rowNumber}:`));
    if (!hasContent) continue;

    const frontmatter = {};
    for (const h of headers) {
      const rawValue = cellToPlainValue(row.getCell(h.col));
      if (opts.omitEmpty && isEmptyValue(rawValue)) continue;
      frontmatter[h.key] = normalizeValue(rawValue);
    }

    for (const h of headers) {
      const imgs = cellImages.get(`${rowNumber}:${h.col}`) || [];
      if (!imgs.length) continue;
      const paths = [];
      const filenames = [];
      for (let i = 0; i < imgs.length; i++) {
        const media = imgs[i].media;
        const buf = imageBuffer(media);
        if (!buf) continue;
        const ext = mediaExtension(media);
        const extra = imageNameIdx >= 0 ? makeSlug(cellToPlainValue(row.getCell(headers[imageNameIdx].col)), '') : '';
        let base = `${pad3(rowNumber - 1)}${extra ? `_${extra}` : ''}`;
        if (imgs.length > 1) base += `_${i + 1}`;
        let filename = `${base}.${ext}`;
        const prior = imageFilenameSeen.get(filename) || 0;
        imageFilenameSeen.set(filename, prior + 1);
        if (prior > 0) filename = `${base}_${prior + 1}.${ext}`;
        if (!opts.dryRun) await fs.writeFile(path.join(imgDir, filename), buf);
        filenames.push(filename);
        paths.push(`${opts.imageUrlPrefix.replace(/\/$/, '')}/${filename}`);
        imageCount++;
      }
      if (paths.length) {
        frontmatter[h.key] = paths.length === 1 ? paths[0] : paths;
        if (opts.imageFilenameFrontmatterKey) {
          frontmatter[opts.imageFilenameFrontmatterKey] = filenames.length === 1 ? filenames[0] : filenames;
        }
      }
    }

    const fileExtra = fileNameIdx >= 0 ? makeSlug(cellToPlainValue(row.getCell(headers[fileNameIdx].col)), '') : '';
    const mdFile = `${pad3(rowNumber - 1)}${fileExtra ? `_${fileExtra}` : ''}.md`;
    const fm = yaml.dump(frontmatter, { noRefs: true, lineWidth: -1, sortKeys: false }).trimEnd();
    const body = `---\n${fm}\n---\n`;
    if (!opts.dryRun) await fs.writeFile(path.join(collectionDir, mdFile), body, 'utf8');
    mdCount++;
  }

  const dataFile = path.join(collectionDir, `${collectionName}.11tydata.js`);
  if (!opts.dryRun && !fssync.existsSync(dataFile)) {
    await fs.writeFile(dataFile, "export default {\n  layout: 'item.njk',\n  tags: 'metadata'\n};\n", 'utf8');
  }

  let jsonCount = 0;
  for (const ws of workbook.worksheets) {
    if (ws.id === mainSheet.id) continue;
    const lookup = {};
    for (let rowNumber = 2; rowNumber <= ws.rowCount; rowNumber++) {
      const row = ws.getRow(rowNumber);
      const key = asJsonKey(cellToPlainValue(row.getCell(1)));
      const value = normalizeValue(cellToPlainValue(row.getCell(2)));
      if (!key) continue;
      // Some exported code tables have a decorative first row and put their real
      // id/label header on row 2. Do not include that as a lookup entry.
      if (rowNumber === 2 && ['id', 'key', 'code'].includes(key.toLowerCase()) && String(value).toLowerCase().includes('label')) continue;
      lookup[key] = value;
    }
    const file = path.join(dataDir, `${makeSlug(ws.name, 'lookup')}.json`);
    if (!opts.dryRun) await fs.writeFile(file, `${JSON.stringify(lookup, null, 2)}\n`, 'utf8');
    jsonCount++;
  }

  console.log(JSON.stringify({
    input: opts.input,
    out: outDir,
    mainSheet: mainSheet.name,
    collectionFolder: path.relative(process.cwd(), collectionDir),
    dataFolder: path.relative(process.cwd(), dataDir),
    imgFolder: path.relative(process.cwd(), imgDir),
    markdownFiles: mdCount,
    jsonFiles: jsonCount,
    imagesExtracted: imageCount,
    dryRun: opts.dryRun,
  }, null, 2));
}

main().catch(err => {
  console.error(`Error: ${err.message}`);
  process.exit(1);
});
