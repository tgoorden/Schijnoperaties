import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';

const execFileAsync = promisify(execFile);
const projectRoot = path.resolve('.');

async function htmlFiles(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await htmlFiles(entryPath));
    if (entry.isFile() && entry.name.endsWith('.html')) files.push(entryPath);
  }
  return files;
}

test('extra images render only on their catalogue detail page with fullscreen controls', async () => {
  await execFileAsync('npm', ['run', 'build'], {
    cwd: projectRoot,
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024
  });

  const cases = [
    ['metadata/068_german-proverbs/index.html', ['11_extra.png']],
    ['metadata/027_man-forces-a-dogfoxs-nose-down-onto-a-grindstone/index.html', ['129 extra.jpg']],
    ['metadata/150_james-i-holding-the-popes-nose-to-the-grindstone/index.html', ['134 extra a.jpg', '134 extra b.jpg']],
    ['metadata/013_baker-of-fools/index.html', ['16_extra.png']],
    ['metadata/022_the-forging-of-heads/index.html', ['68_forgingextra.jpg']]
  ];
  const builtHtmlFiles = await htmlFiles(path.join(projectRoot, '_site'));
  const builtPages = await Promise.all(builtHtmlFiles.map(async file => [file, await fs.readFile(file, 'utf8')]));

  for (const [relativeDetailPage, images] of cases) {
    const detailPage = path.join(projectRoot, '_site', relativeDetailPage);
    const detailHtml = await fs.readFile(detailPage, 'utf8');
    assert.match(detailHtml, /class="extra-images"[^>]*aria-label="Additional views"/);
    const extraViewers = detailHtml.match(/class="detail-image extra-image" data-image-viewer/g) || [];
    assert.equal(extraViewers.length, images.length, `${relativeDetailPage} should render one viewer per extra image`);
    const fullscreenControls = detailHtml.match(/data-image-fullscreen-toggle/g) || [];
    assert.equal(fullscreenControls.length, images.length + 1, `${relativeDetailPage} should give every image a fullscreen control`);

    for (const image of images) {
      assert.ok(detailHtml.includes(`/img/originals/${image}`), `${image} should render on ${relativeDetailPage}`);
      const pagesContainingImage = builtPages
        .filter(([, html]) => html.includes(`/img/originals/${image}`))
        .map(([file]) => path.relative(path.join(projectRoot, '_site'), file));
      assert.deepEqual(pagesContainingImage, [relativeDetailPage], `${image} should appear only on its detail page`);
    }
  }

  const stylesheet = await fs.readFile(path.join(projectRoot, 'src/assets/css/site.css'), 'utf8');
  assert.match(stylesheet, /\.extra-images\s*\{[\s\S]*?grid-template-columns:\s*repeat\(3,/);
  assert.match(stylesheet, /nth-child\(2\)[\s\S]*?grid-template-columns:\s*repeat\(2,/);
});

test('diameter-only dimensions render with a d suffix', async () => {
  await execFileAsync('npm', ['run', 'build'], {
    cwd: projectRoot,
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024
  });

  const diameterCases = [
    ['metadata/078_fools-platter/index.html', '78.9 cm d'],
    ['metadata/082_the-extraction-of-the-stone-of-folly/index.html', '30.2 cm d']
  ];

  for (const [relativeDetailPage, expectedDimensions] of diameterCases) {
    const detailHtml = await fs.readFile(path.join(projectRoot, '_site', relativeDetailPage), 'utf8');
    const dimensionsRow = detailHtml.match(/<dt>Dimensions<\/dt>[\s\S]*?<dd>([\s\S]*?)<\/dd>/);
    assert.ok(dimensionsRow, `${relativeDetailPage} should include a Dimensions row`);
    assert.equal(dimensionsRow[1].trim(), expectedDimensions);
  }
});
