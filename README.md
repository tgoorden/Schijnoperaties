# Fictional Healing website

Eleventy website for browsing the Fictional Healing catalogue of historical
imagery. The website provides:

- a clean, accessible catalogue interface for historical imagery;
- an index page showing all `metadata/*.md` items as thumbnail cards;
- a left-hand navigation menu for selected subcollections only: `Locations` and `Subjects`;
- generated subcollection pages, for example `/subjects/2/`, showing matching catalogue items;
- lookup/translation data for all code tables, including bundles, motives, iconclasses, locations, and subjects;
- a simple overview sort button that reverses the card order between ascending and descending date order;
- a tabbed detail-card template with Overview, Inscriptions, Related, and Literature sections;
- an image-derivative script for generating smaller WebP versions of large originals.

The project uses Eleventy v3.x and expects Node.js 22 or newer. The exact local
development version is recorded in `.nvmrc`.

## Install

```bash
npm install
```

## Source structure

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

## Image derivatives

Metadata files use filenames in the `image` frontmatter field, for example:

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
