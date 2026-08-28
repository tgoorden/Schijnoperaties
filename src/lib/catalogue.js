export function catalogueId(itemOrPage) {
  const fileSlug = itemOrPage?.fileSlug || itemOrPage?.data?.page?.fileSlug || '';
  return String(fileSlug).match(/^\d{3}/)?.[0] || '';
}
