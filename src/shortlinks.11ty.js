import { catalogueId } from './lib/catalogue.js';

function html(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
}

export default class Shortlinks {
  data() {
    return {
      pagination: {
        data: 'collections.metadata',
        size: 1,
        alias: 'catalogueItem'
      },
      eleventyExcludeFromCollections: true,
      permalink(data) {
        const id = catalogueId(data.catalogueItem);
        if (!id) throw new Error(`Catalogue item has no three-digit ID: ${data.catalogueItem?.fileSlug || 'unknown'}`);
        return `/s/${id}/index.html`;
      }
    };
  }

  render({ catalogueItem, site }) {
    const target = catalogueItem.url;
    const canonicalTarget = `${site.host}${target}`;
    const title = catalogueItem.data.title || catalogueItem.fileSlug || 'catalogue item';

    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="refresh" content="0; url=${html(target)}">
  <link rel="canonical" href="${html(canonicalTarget)}">
  <meta property="og:url" content="${html(canonicalTarget)}">
  <title>Redirecting to ${html(title)}</title>
</head>
<body>
  <p>Redirecting to <a href="${html(target)}">${html(title)}</a>…</p>
  <script>window.location.replace(${JSON.stringify(target)});</script>
</body>
</html>`;
  }
}
