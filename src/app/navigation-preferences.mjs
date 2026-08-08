export const PRIMARY_NAVIGATION_PAGES = new Set([
  'dashboard', 'life', 'decisions', 'today', 'tasks',
  'local-life', 'spark-media', 'lingli', 'calendar', 'intelligence',
]);

export function normalizeNavigationMode(value) {
  return value === 'all' ? 'all' : 'focused';
}

export function shouldExpandNavigation({ mode, pageId, primaryPages = PRIMARY_NAVIGATION_PAGES } = {}) {
  return normalizeNavigationMode(mode) === 'all'
    || (Boolean(pageId) && !primaryPages.has(pageId));
}
