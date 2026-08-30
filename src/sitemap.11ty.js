import slugify from 'slugify';

function xml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&apos;'
  })[character]);
}

export default class Sitemap {
  data() {
    return {
      permalink: '/sitemap.xml',
      eleventyExcludeFromCollections: true
    };
  }

  render({ collections, site, taxonomyPageEntries }) {
    const taxonomyUrls = (taxonomyPageEntries || []).map(({ taxonomy, key }) => {
      const slug = slugify(String(key ?? ''), { lower: true, strict: true, trim: true }) || 'item';
      return `${taxonomy.base}${slug}/`;
    });

    const urls = [...new Set(
      [
        ...(collections.all || []).map((page) => page.url),
        ...taxonomyUrls
      ].filter((url) => url && url.endsWith('/'))
    )].sort((a, b) => {
      if (a === '/') return -1;
      if (b === '/') return 1;
      return a.localeCompare(b, 'en');
    });

    const entries = urls
      .map((url) => `  <url><loc>${xml(site.host + url)}</loc></url>`)
      .join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries}
</urlset>`;
  }
}
