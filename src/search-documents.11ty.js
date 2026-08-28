import fs from 'node:fs';
import yaml from 'js-yaml';
import { imageSrcset, imageThumbUrl } from './lib/image.js';

function asArray(value) {
  if (value === undefined || value === null || value === '') return [];
  return Array.isArray(value) ? value : [value];
}

function toText(value) {
  if (Array.isArray(value)) return value.map(toText).filter(Boolean).join(' · ');
  if (value && typeof value === 'object') return Object.values(value).map(toText).filter(Boolean).join(' ');
  return String(value ?? '');
}

function dateComposite(data) {
  const start = [data.date_start_prefix, data.date_start]
    .filter(value => value !== undefined && value !== null && value !== '')
    .join(' ');
  const end = [data.date_end_prefix, data.date_end]
    .filter(value => value !== undefined && value !== null && value !== '')
    .join(' ');
  if (start && end && start !== end) return `${start}–${end}`;
  return start || end || 'Date unknown';
}

function sourceDocument(item) {
  const source = fs.readFileSync(item.inputPath, 'utf8');
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  const fields = match ? yaml.load(match[1]) || {} : {};
  const content = match ? source.slice(match[0].length).trim() : source.trim();
  return { fields, content };
}

function lookupLabels(value, lookup) {
  return asArray(value).map(key => lookup?.[String(key)]).filter(Boolean);
}

export default class SearchDocuments {
  data() {
    return {
      permalink: '/assets/search/documents.json',
      eleventyExcludeFromCollections: true
    };
  }

  render(data) {
    const documents = (data.collections.metadata || []).map((item) => {
      const { fields, content } = sourceDocument(item);
      const title = toText(fields.title || fields.Title || item.fileSlug);
      const creatorText = toText(fields.creator);
      const dateText = dateComposite(fields);
      const lookupText = [
        ...lookupLabels(fields.subject || fields.subjects, data.lookups?.subjects),
        ...lookupLabels(fields.iconclass, data.lookups?.iconclass)
      ];
      const searchText = toText({ ...fields, content, lookupText });

      return {
        ...fields,
        id: item.url,
        url: item.url,
        content,
        title,
        creator_text: creatorText,
        date_composite: dateText,
        image_url: imageThumbUrl(fields, 640),
        image_srcset: imageSrcset(fields),
        search_text: searchText
      };
    });

    return JSON.stringify(documents).replace(/</g, '\\u003c');
  }
}
