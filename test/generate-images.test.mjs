import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';
import sharp from 'sharp';

const execFileAsync = promisify(execFile);
const scriptPath = path.resolve('bin/generate-images.mjs');

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'generate-images-'));
  const inputDir = path.join(root, 'originals');
  const outputDir = path.join(root, 'resized');
  await fs.mkdir(inputDir);
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  return { inputDir, outputDir };
}

async function createImage(file, format = 'jpeg') {
  const image = sharp({
    create: {
      width: 120,
      height: 80,
      channels: 3,
      background: { r: 25, g: 100, b: 175 }
    }
  });
  await image[format]().toFile(file);
}

async function runGenerator(inputDir, outputDir, ...args) {
  const { stdout } = await execFileAsync(
    process.execPath,
    [scriptPath, '--input-dir', inputDir, '--output-dir', outputDir, ...args],
    { encoding: 'utf8' }
  );
  const match = stdout.match(/\{\n[\s\S]*\}\s*$/);
  assert.ok(match, `Expected JSON summary in output:\n${stdout}`);
  return JSON.parse(match[0]);
}

test('generates every expected size for all originals without metadata', async t => {
  const { inputDir, outputDir } = await fixture(t);
  await createImage(path.join(inputDir, 'unreferenced.jpg'));
  await createImage(path.join(inputDir, 'SECOND.PNG'), 'png');
  await fs.writeFile(path.join(inputDir, '.DS_Store'), 'not an image');
  await fs.writeFile(path.join(inputDir, 'notes.txt'), 'not an image');

  const summary = await runGenerator(inputDir, outputDir, '--sizes', '32,64');

  assert.equal(summary.originalsFound, 2);
  assert.equal(summary.filesGenerated, 4);
  assert.deepEqual(
    (await fs.readdir(outputDir)).sort(),
    [
      'SECOND-32.webp',
      'SECOND-64.webp',
      'unreferenced-32.webp',
      'unreferenced-64.webp'
    ]
  );
  assert.equal((await sharp(path.join(outputDir, 'unreferenced-32.webp')).metadata()).width, 32);
  assert.equal((await sharp(path.join(outputDir, 'SECOND-64.webp')).metadata()).width, 64);
});

test('generates only derivatives that are missing', async t => {
  const { inputDir, outputDir } = await fixture(t);
  await createImage(path.join(inputDir, 'original.jpg'));

  const first = await runGenerator(inputDir, outputDir, '--sizes', '40,80');
  assert.equal(first.filesGenerated, 2);

  const complete = await runGenerator(inputDir, outputDir, '--sizes', '40,80');
  assert.equal(complete.filesGenerated, 0);

  await fs.rm(path.join(outputDir, 'original-80.webp'));
  const repaired = await runGenerator(inputDir, outputDir, '--sizes', '40,80');
  assert.equal(repaired.filesGenerated, 1);
  assert.equal((await sharp(path.join(outputDir, 'original-80.webp')).metadata()).width, 80);
});

test('--force regenerates derivatives that already exist', async t => {
  const { inputDir, outputDir } = await fixture(t);
  await createImage(path.join(inputDir, 'original.jpg'));
  await runGenerator(inputDir, outputDir, '--sizes', '50');

  const output = path.join(outputDir, 'original-50.webp');
  await fs.writeFile(output, 'stale output');

  const skipped = await runGenerator(inputDir, outputDir, '--sizes', '50');
  assert.equal(skipped.filesGenerated, 0);
  assert.equal(await fs.readFile(output, 'utf8'), 'stale output');

  const forced = await runGenerator(inputDir, outputDir, '--sizes', '50', '--force');
  assert.equal(forced.filesGenerated, 1);
  assert.equal((await sharp(output).metadata()).format, 'webp');
});
