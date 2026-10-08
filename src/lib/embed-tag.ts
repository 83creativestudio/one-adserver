export type Screen = 'all' | 'desktop' | 'tablet' | 'mobile';
const specificScreens: Exclude<Screen, 'all'>[] = ['desktop', 'tablet', 'mobile'];

export function normalizeScreens(previous: Screen[], selected: Screen[]): Screen[] {
  const valid = [...new Set(selected.filter(value => value === 'all' || specificScreens.includes(value as Exclude<Screen, 'all'>)))];
  if (valid.includes('all') && !previous.includes('all')) return ['all'];
  const specific = specificScreens.filter(value => valid.includes(value));
  return specific.length === 0 || specific.length === specificScreens.length ? ['all'] : specific;
}

export function websiteTag(placementId: string, origin: string, screens: Screen[]) {
  const devices = screens.includes('all') ? 'all' : screens.join(',');
  return `<div data-one-placement="${placementId}" data-one-device="${devices}"></div>\n<script async src="${origin}/ad.js?v=3"></script>`;
}
