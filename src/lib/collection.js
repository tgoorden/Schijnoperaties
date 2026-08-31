function stableItemKey(item) {
  return String(
    item?.inputPath
    || item?.url
    || item?.filePathStem
    || item?.fileSlug
    || ''
  );
}

export function compareCollectionItems(a, b) {
  const aKey = stableItemKey(a);
  const bKey = stableItemKey(b);
  if (aKey < bKey) return -1;
  if (aKey > bKey) return 1;
  return 0;
}
