# xls-to-11ty-datafiles

Converts a workbook into files for an Eleventy/11ty site and includes a starter 11ty website scaffold for browsing the generated catalogue of historical imagery.

The converter creates:

- one main sheet as a collection folder containing one Markdown file per data row;
- all main-sheet columns as YAML frontmatter keys;
- semicolon-separated cell text as YAML arrays;
- embedded images anchored to cells in the main sheet extracted to `img/` and referenced from frontmatter;
- all other sheets as lookup JSON files in `_data/lookups`, using column A as the key and column B as the value.

The website scaffold adds:

- a clean, accessible catalogue interface for historical imagery;
- an index page showing all `metadata/*.md` items as thumbnail cards;
- a left-hand navigation menu for selected subcollections only: `Locations` and `Subjects`;
- generated subcollection pages, for example `/subjects/2/`, showing matching catalogue items;
- lookup/translation data for all code tables, including bundles, motives, iconclasses, locations, and subjects;
- a simple overview sort button that reverses the card order between ascending and descending date order;
- a tabbed detail-card template with Overview, Inscriptions, Related, and Literature sections;
- an image-derivative script for generating smaller WebP versions of large originals.

The project uses Eleventy v3.x and expects Node.js 18 or newer.

## Install

```bash
npm install
```

## Convert a workbook into the 11ty `src/` structure

```bash
npm run convert -- \
  --input ../test.xlsx \
  --out ./src \
  --main-sheet metadata \
  --file-name-column Title
```

Typical result:

```text
src/
  metadata/
    metadata.11tydata.js
    001_depiction-of-the-marvellous-workshop-of-simplicissimus-the-world-roaming-physician.md
    002_fools-platter.md
  _data/
    site.js
    taxonomyPageEntries.js
    lookups.js
    lookups/
      bundles.json
      iconclasses.json
      locations.json
      motives.json
      subjects.json
  img/
    originals/
      02.jpg
    resized/
      02-320.webp
      02-640.webp
      02-960.webp
      02-1280.webp
```

After running the converter, make sure `src/metadata/metadata.11tydata.js` exists. It should contain:

```js
export default {
  layout: 'layouts/item.njk',
  tags: 'metadata'
};
```

## Image derivatives

The updated workbook uses filenames in the `image` frontmatter field, for example:

```yaml
image: 02.jpg
```

Put the large originals in `src/img/originals/` using those exact filenames. Then run:

```bash
npm run images
```

This creates responsive WebP derivatives in `src/img/resized/` at 320, 640, 960, and 1280 pixels wide. You can override the defaults:

```bash
npm run images -- \
  --input-dir ./src/img/originals \
  --output-dir ./src/img/resized \
  --sizes 320,640,960,1280,1600 \
  --quality 84 \
  --force
```

The templates use the resized files for thumbnails and detail images. The originals can remain in `src/img/originals/` as the archival/large-format source.

## Build or serve the website

```bash
npm run build
npm start
```

The generated site is written to `_site/`. The development server is started by Eleventy with `eleventy --serve`.

## Selected subcollection pages

Only `Locations` and `Subjects` are exposed in the left navigation and have generated overview pages. The other lookup tables remain available as translation/label data through the global `lookups` object:

```njk
{{ bundle | labelFor(lookups.bundles) }}
{{ motive | labelFor(lookups.motives) }}
{{ iconclass | labelFor(lookups.iconclasses) }}
```

To add another visible subcollection, add it in both:

- `src/_data/site.js`
- `src/_data/taxonomyPageEntries.js`

## Detail tabs

Each item page uses `src/_includes/layouts/item.njk`. The tabbed card contains:

- Overview: title, creator, former attribution, date range, location, medium, dimensions, classification, collection, credit line;
- Inscriptions: signatures and inscriptions;
- Related: bundles, iconclass, subjects;
- Literature: literature field.

The tabs are keyboard-accessible and use `role="tablist"`, `role="tab"`, `role="tabpanel"`, `aria-selected`, and `aria-controls`.

## Converter options

```bash
node bin/xls-to-11ty.mjs \
  --input ./workbook.xlsx \
  --out ./src \
  --main-sheet metadata \
  --file-name-column Title \
  --image-name-column Title \
  --image-filename-frontmatter-key image_file
```

For legacy `.xls`, the script attempts to call LibreOffice's `soffice` to convert it to `.xlsx` first. Install LibreOffice or convert the file manually if that is not available.
