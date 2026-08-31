import slugify from 'slugify';
import {
      imageDetailUrl,
      imageThumbUrl,
      imageSrcset,
} from "./lib/image.js";
import { compareCollectionItems } from './lib/collection.js';

function slug(value) {
  return slugify(String(value ?? ''), { lower: true, strict: true, trim: true }) || 'item';
}
function toText(value) {
  if (Array.isArray(value)) return value.map(toText).filter(Boolean).join(' · ');
  if (value && typeof value === 'object') return JSON.stringify(value);
  return String(value ?? '');
}
function html(value) {
  return toText(value).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
}
function asArray(value) {
  if (value === undefined || value === null || value === '') return [];
  return Array.isArray(value) ? value : [value];
}
function dataValue(data, names) {
  for (const name of asArray(names)) {
    const value = data?.[name];
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return '';
}
function valuesFor(data, names) {
  for (const name of asArray(names)) {
    const arr = asArray(data?.[name]).filter(Boolean);
    if (arr.length) return arr;
  }
  return [];
}
function dateLabel(item) {
  const d = item.data || {};
  const start = [dataValue(d, ['date_start_prefix', 'datestartprefix']), dataValue(d, ['date_start', 'datestart'])].filter(Boolean).join(' ');
  const end = [dataValue(d, ['date_end_prefix', 'dateendprefix']), dataValue(d, ['date_end', 'dateend'])].filter(Boolean).join(' ');
  if (start && end && String(start) !== String(end)) return `${start}–${end}`;
  return start || end || 'Date unknown';
}
function sortNumber(item, fields) {
  const value = dataValue(item.data, fields);
  if (value === '') return null;
  const n = Number(String(value).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : null;
}
function sortByDate(a, b) {
  const aStart = sortNumber(a, ['date_start', 'datestart', 'begin_date', 'begindatum']);
  const bStart = sortNumber(b, ['date_start', 'datestart', 'begin_date', 'begindatum']);
  if (aStart === null && bStart === null) return compareCollectionItems(a, b);
  if (aStart === null) return 1;
  if (bStart === null) return -1;
  if (aStart !== bStart) return aStart - bStart;

  const aEnd = sortNumber(a, ['date_end', 'dateend', 'end_date', 'einddatum']);
  const bEnd = sortNumber(b, ['date_end', 'dateend', 'end_date', 'einddatum']);
  if (aEnd === null && bEnd === null) return compareCollectionItems(a, b);
  if (aEnd === null) return -1;
  if (bEnd === null) return 1;
  if (aEnd !== bEnd) return aEnd - bEnd;
  return compareCollectionItems(a, b);
}

export default class TaxonomyPages {
  data() {
    return {
      layout: 'base.njk',
      pagination: {
        data: 'taxonomyPageEntries',
        size: 1,
        alias: 'taxonomyPage'
      },
      permalink(data) {
        return `${data.taxonomyPage.taxonomy.base}${slug(data.taxonomyPage.key)}/index.html`;
      },
      title: 'Subcollection'
    };
  }

  render(data) {
    const { taxonomy, key, label } = data.taxonomyPage;
    const emptyValue = data.site?.ui?.emptyValue || '-';
    const fields = taxonomy.aliases || [taxonomy.field];
    const items = (data.collections.metadata || []).filter((item) => {
      return valuesFor(item.data, fields).map(String).includes(String(key));
    }).sort(sortByDate);

    return `
<section class="page-heading page-heading-with-action" aria-labelledby="page-title">
  <div>
    <p class="eyebrow">${html(taxonomy.singular)}</p>
    <h1 id="page-title">${html(label)}</h1>
  </div>
  <button class="button button-secondary sort-toggle" type="button" data-reverse-grid aria-pressed="false">Ascending</button>
</section>

<ol class="card-grid" data-card-grid>
${items.map((item) => {
  const title = item.data.title || item.fileSlug || 'Untitled image';
  const creator = toText(item.data.creator) || emptyValue;
  const img = imageDetailUrl(item.data);
  const srcset = imageSrcset(item.data);
  return `<li class="image-card" data-card data-date-start="${html(dataValue(item.data, ['date_start', 'datestart']) || '')}">
    <a href="${html(item.url)}" class="card-link">
      <figure>
        ${img ? `<img src="${html(img)}" srcset="${html(srcset)}" sizes="(min-width: 1200px) 18rem, (min-width: 800px) 25vw, 50vw" alt="${html(title)}" loading="lazy" decoding="async">` : `<div class="placeholder-image" role="img" aria-label="No thumbnail available for ${html(title)}">No image</div>`}
        <figcaption><strong>${html(title)}</strong><em class="card-creator">${html(creator)}</em><span class="card-date">${html(dateLabel(item))}</span></figcaption>
      </figure>
    </a>
  </li>`;
}).join('\n')}
</ol>`;
  }
}
