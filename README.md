# xls-to-11ty-datafiles

Converts a workbook into files for an Eleventy/11ty site and includes a starter 11ty website scaffold for browsing the generated catalogue of historical imagery.

The converter creates:

- one main sheet as a collection folder containing one Markdown file per data row;
- main-sheet columns as YAML frontmatter keys, except `Preview`,
  `Inscriptions`, and keys starting with `column_`;
- the `Inscriptions` cell as the Markdown body of each item;
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

### Workbook input contract

The converter expects an `.xlsx` workbook. Legacy `.xls` input is accepted only
when LibreOffice's `soffice` command is available to convert it first.

The main worksheet is selected by `--main-sheet`, then by the 1-based
`--main-sheet-index`, and otherwise defaults to the first worksheet. It has this
structure:

- row 1 contains the column headers;
- rows 2 and later each become one Markdown file, unless the entire row is empty
  and has no embedded image;
- only columns present in row 1 are read; a blank header becomes `column_N`;
- columns are written to YAML frontmatter except `Preview`, `Inscriptions`, and
  any normalized key starting with `column_`. The `Inscriptions` value becomes
  the Markdown body of the item instead. By default, other headers are trimmed,
  lowercased, and converted to snake_case-like keys: for example, `Former
  attribution` becomes `former_attribution`;
- use `--preserve-header-case` to retain header spelling and case, although
  newlines are replaced with spaces and colons with underscores;
- normalized header names must be unique. If two headers normalize to the same
  YAML key, the later column overwrites the earlier one;
- text containing semicolons is split into a YAML array. Empty cells are written
  as empty strings unless `--omit-empty` is used;
- dates become `YYYY-MM-DD`. Rich text and hyperlinks become text, and formula
  cells use the cached formula result stored in the workbook.

There are no mandatory main-sheet column names. The only column name hard coded
as a default is `Title`:

- `--file-name-column` defaults to `Title`; its value is slugged and appended to
  each Markdown filename;
- `--image-name-column` has no default, but when supplied its value is slugged
  and appended to extracted image filenames;
- named-column matching accepts the exact header, a slug-equivalent header, or
  the default normalized YAML key. If the requested column is absent, conversion
  continues silently and filenames contain only their numeric prefix.

Embedded images must be anchored to cells in the main worksheet. They are
extracted to `--img-folder`, and the frontmatter value for the image's column is
replaced by its public URL. The converter also adds the hard-coded default
frontmatter key `image_file` containing the extracted filename; change this with
`--image-filename-frontmatter-key`, or pass an empty value to disable it.
Use `--ignore-embedded-images` when the workbook contains preview images but
`image_file` refers to separate original files. In that mode, no embedded images
are extracted and all cell values, including `image_file`, remain unchanged.

Every worksheet other than the main worksheet is treated as a lookup table,
regardless of its name:

- row 1 is ignored;
- from row 2 onward, column A is the JSON key and column B is its value;
- rows with an empty column A are skipped;
- semicolon-separated text in column B becomes an array;
- a row-2 header pair such as `id`/`Label`, `key`/`Label`, or `code`/`Label` is
  detected and skipped;
- the worksheet name is slugged to form the lookup JSON filename.

For reference, the supplied `input/test.xlsx` uses `metadata` as its main sheet.
Its headers include `image`, `Preview`, `Title`, `Creator`, and the other
catalogue fields consumed by the site templates. Those template-specific fields
are site requirements, not converter requirements.

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

## Deploy to Bunny.net

The published [`eleventy-bunny-sync`](https://www.npmjs.com/package/eleventy-bunny-sync)
package creates a SHA-256 deployment manifest as part of every standalone
Eleventy build. Rendered files come from `eleventy.after.results`; passthrough
files come from Eleventy's destination-to-source passthrough map. The output
directory is never scanned, so stale files left in `_site/` cannot enter a
deployment.

Synchronization compares the ignored local manifest with a compact manifest in
Bunny Storage. It never lists the Storage Zone. As a result, files uploaded
manually—and therefore absent from the remote manifest—are never changed or
deleted. Comparisons use only paths and SHA-256 hashes, not timestamps.

The scripts require Node.js 22 or newer. Credentials and settings are read
only from environment variables, so the same commands work locally and in
GitHub Actions.

A local `.envrc` file is provided and ignored by Git. Add the real values, then
allow it with [direnv](https://direnv.net/):

```bash
direnv allow
npm run deploy:check
```

The available settings are:

| Environment variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `BUNNY_STORAGE_ZONE_NAME` | yes | — | Bunny.net storage-zone name |
| `BUNNY_ACCESS_KEY` | yes | — | Storage-zone access key |
| `BUNNY_STORAGE_REGION` | no | Frankfurt, DE | Leave blank (or use `de`) for Frankfurt; otherwise use `uk`, `ny`, `la`, `sg`, `se`, `br`, `jh`, or `syd` |
| `BUNNY_STORAGE_PATH` | no | `/` | Destination directory within the storage zone |
| `BUNNY_MAX_CONCURRENT_OPERATIONS` | no | `12` | Parallel uploads and parallel deletions |
| `BUNNY_MAX_ATTEMPTS` | no | `4` | Total attempts for retryable HTTP requests |
| `BUNNY_REQUEST_TIMEOUT_MS` | no | `120000` | Per-request timeout in milliseconds |
| `BUNNY_CDN_HOSTNAME` | no | — | Pull Zone hostname used for selective invalidation; requires `BUNNY_API_KEY` |
| `BUNNY_API_KEY` | no | — | Account API key for CDN purges—not the Storage Zone key |
| `BUNNY_PULL_ZONE_ID` | no | — | Numeric Pull Zone ID; enables one full-zone purge when the threshold is reached |
| `BUNNY_FULL_PURGE_THRESHOLD` | no | `100` | Affected URL count at which one full-zone purge replaces targeted purges |
| `BUNNY_MAX_CONCURRENT_PURGES` | no | `8` | Parallel exact-URL CDN invalidations |

Synchronization metadata uses fixed paths. The build writes the ignored local
manifest to `.bunny-sync/manifest.json`; the deploy stores its remote form at
the same path inside `BUNNY_STORAGE_PATH`. The remote purge journal is
`.bunny-sync/purge-log.json`.

Build and compare without changing remote files:

```bash
npm run build
npm run deploy:check
```

The check downloads the remote manifest but performs no uploads, deletions,
purges, or manifest update.

Build and upload:

```bash
npm run deploy
```

For an active terminal display showing the current stage, completed and active
request counts, elapsed time, the latest path, and HTTP retries:

```bash
npm run build
npm run deploy:upload -- --interactive
```

Uploads use `BUNNY_MAX_CONCURRENT_OPERATIONS` streaming HTTP connections in
parallel. Deletions have a separate pool of the same size and can run alongside
uploads. Bunny's current limits allow 100 concurrent HTTP connections per IP
and server, 250 per zone and server, and 30 simultaneous deletes, so the
default of 12 per pool remains comfortably below those limits.

If the local manifest is missing, deployment stops and asks you to run the
build first. If the remote manifest is missing, the deploy automatically treats
the destination as a first deployment and uploads every local manifest entry:

```bash
npm run build
npm run deploy:upload
```

Synchronize from an already generated local manifest:

```bash
npm run deploy:upload
```

Uploads and deletes run concurrently. Deletion is limited to paths owned by the
previous remote manifest; an already-missing path is reported as a warning so
an interrupted deployment can resume. Changed CDN URLs are purged after all
storage mutations succeed. Once they do, the deploy records a pending purge
journal and advances the remote manifest before invalidating the CDN. Targeted
purges use `exactPath=true`, ensuring Bunny
applies its higher-throughput exact-purge limit rather than the prefix-purge
limit. If
`BUNNY_PULL_ZONE_ID` is configured and at least
`BUNNY_FULL_PURGE_THRESHOLD` URLs are affected, the deploy makes one full-zone
purge request instead. The default crossover of 100 leaves headroom below
Bunny's documented 120-token exact-purge burst. An `index.html` output in targeted mode is purged by its
public trailing-slash URL (`about/index.html` becomes `/about/`) with Bunny's
`exactPath=true`. A `429` response honors both the `Retry-After` header and
Bunny's JSON `retry_after_seconds` value.

If CDN invalidation fails, the command still exits with an error, but the
remote manifest remains current because Storage completed successfully. The
remote purge journal remains `pending`, including the remaining paths and error
details. A later deployment retries those paths even when the local and remote
manifests already match, then marks the journal `completed`. This also avoids
re-uploading files solely because an earlier CDN request failed. Deployments
with no file changes also write a completed purge journal with an empty path
list, providing a timestamp for the latest synchronization attempt.

For a future GitHub Actions workflow, use Node.js 22 and map repository
variables/secrets to the same environment names:

```yaml
- uses: actions/setup-node@v4
  with:
    node-version: 22
- run: npm ci
- run: npm run deploy
  env:
    BUNNY_STORAGE_ZONE_NAME: ${{ vars.BUNNY_STORAGE_ZONE_NAME }}
    BUNNY_ACCESS_KEY: ${{ secrets.BUNNY_ACCESS_KEY }}
    BUNNY_CDN_HOSTNAME: ${{ vars.BUNNY_CDN_HOSTNAME }}
    BUNNY_PULL_ZONE_ID: ${{ vars.BUNNY_PULL_ZONE_ID }}
    BUNNY_API_KEY: ${{ secrets.BUNNY_API_KEY }}
    BUNNY_STORAGE_REGION: ${{ vars.BUNNY_STORAGE_REGION }}
    BUNNY_STORAGE_PATH: ${{ vars.BUNNY_STORAGE_PATH }}
```

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
- Inscriptions: the rendered Markdown body imported from `Inscriptions`;
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
