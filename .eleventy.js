import slugify from 'slugify';
import {
      imageDetailUrl,
      imageThumbUrl,
      imageSrcset,
} from "./src/lib/image.js";

function asArray(value) {
  if (value === undefined || value === null || value === '') return [];
  return Array.isArray(value) ? value : [value];
}

function slug(value) {
  return slugify(String(value ?? ''), { lower: true, strict: true, trim: true }) || 'item';
}

function dataValue(data, names) {
  for (const name of asArray(names)) {
    const value = data?.[name];
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return '';
}

function numberOrNull(value) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(String(value).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : null;
}

function sortByDate(items, dir = 'asc') {
  const factor = dir === 'desc' ? -1 : 1;
  return [...(items || [])].sort((a, b) => {
    const av = numberOrNull(dataValue(a?.data, ['date_start', 'datestart', 'begin_date', 'begindatum']));
    const bv = numberOrNull(dataValue(b?.data, ['date_start', 'datestart', 'begin_date', 'begindatum']));
    if (av === null && bv === null) return 0;
    if (av === null) return 1;
    if (bv === null) return -1;
    return (av - bv) * factor;
  });
}

function toText(value) {
  if (Array.isArray(value)) return value.map(toText).filter(Boolean).join(' · ');
  if (value && typeof value === 'object') return JSON.stringify(value);
  return String(value ?? '');
}

function labelFor(value, lookup = {}) {
  const values = asArray(value);
  if (values.length > 1) return values.map(v => labelFor(v, lookup)).join(' · ');
  const key = String(values[0] ?? '');
  return toText(lookup?.[key] ?? key);
}

function valuesFor(data, names) {
  for (const name of asArray(names)) {
    const value = data?.[name];
    const arr = asArray(value).filter(v => v !== '');
    if (arr.length) return arr;
  }
  return [];
}

function titleFor(item) {
  return dataValue(item?.data, ['title', 'Title']) || item?.fileSlug || 'Untitled image';
}

function dateRange(itemOrData) {
  const d = itemOrData?.data || itemOrData || {};
  const start = [dataValue(d, ['date_start_prefix', 'datestartprefix']), dataValue(d, ['date_start', 'datestart', 'begindatum'])].filter(Boolean).join(' ');
  const end = [dataValue(d, ['date_end_prefix', 'dateendprefix']), dataValue(d, ['date_end', 'dateend', 'einddatum'])].filter(Boolean).join(' ');
  if (start && end && String(start) !== String(end)) return `${start}–${end}`;
  return start || end || 'Date unknown';
}

function dimensions(data) {
  const h = dataValue(data, ['dimensions_height', 'dimensionsheight']);
  const w = dataValue(data, ['dimensions_width', 'dimensionswidth']);
  const d = dataValue(data, ['dimensions_diameter', 'dimensionsdiameter']);
  const parts = [];
  if (h || w) parts.push([h && `H ${h}`, w && `W ${w}`].filter(Boolean).join(' × '));
  if (d) parts.push(`Diameter ${d}`);
  return parts.join('; ');
}

function metadataEntries(item) {
  const hidden = new Set(['layout', 'tags', 'permalink', 'eleventyNavigation', 'page', 'collections', 'pkg']);
  return Object.entries(item?.data || {})
    .filter(([key, value]) => !hidden.has(key) && value !== undefined && value !== null && value !== '')
    .map(([key, value]) => ({ key, label: key.replace(/_/g, ' '), value }));
}

export default function(eleventyConfig) {
  eleventyConfig.addPassthroughCopy({ 'src/assets': 'assets' });
  eleventyConfig.addPassthroughCopy({ 'src/img': 'img' });

  eleventyConfig.addCollection('metadata', (collectionApi) => {
    return collectionApi.getFilteredByGlob('src/metadata/*.md');
  });

  eleventyConfig.addFilter('asArray', asArray);
  eleventyConfig.addFilter('slug', slug);
  eleventyConfig.addFilter('keys', obj => Object.keys(obj || {}));
  eleventyConfig.addFilter('sortByDate', sortByDate);
  eleventyConfig.addFilter('labelFor', labelFor);
  eleventyConfig.addFilter('titleFor', titleFor);
//  eleventyConfig.addFilter('imageUrl', imageUrl);
  eleventyConfig.addFilter('imageThumbUrl', imageThumbUrl);
  eleventyConfig.addFilter('imageDetailUrl', imageDetailUrl);
  eleventyConfig.addFilter('imageSrcset', imageSrcset);
  eleventyConfig.addFilter('dateRange', dateRange);
  eleventyConfig.addFilter('dimensions', dimensions);
  eleventyConfig.addFilter('metadataEntries', metadataEntries);
  eleventyConfig.addFilter('dataValue', dataValue);
  eleventyConfig.addFilter('valuesFor', valuesFor);
  eleventyConfig.addFilter('json', value => JSON.stringify(value));
  eleventyConfig.addFilter('readableKey', value => String(value ?? '').replace(/_/g, ' '));
  eleventyConfig.addFilter('nl2br', value => String(value ?? '').replace(/\n/g, '<br>'));

  return {
    dir: {
      input: 'src',
      includes: '_includes',
      layouts: '_includes/layouts',
      data: '_data',
      output: '_site'
    },
    markdownTemplateEngine: 'njk',
    htmlTemplateEngine: 'njk',
    dataTemplateEngine: 'njk'
  };
}
