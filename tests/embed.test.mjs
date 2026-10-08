import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeScreens, websiteTag } from '../src/lib/embed-tag.ts';
import { copyText } from '../src/lib/clipboard.ts';

test('screen selection supports combinations and an exclusive all-devices option', () => {
  assert.deepEqual(normalizeScreens(['all'], ['all', 'desktop']), ['desktop']);
  assert.deepEqual(normalizeScreens(['desktop'], ['desktop', 'tablet']), ['desktop', 'tablet']);
  assert.deepEqual(normalizeScreens(['desktop', 'tablet'], ['desktop', 'tablet', 'all']), ['all']);
  assert.deepEqual(normalizeScreens(['mobile'], []), ['all']);
  assert.deepEqual(normalizeScreens(['desktop', 'tablet'], ['desktop', 'tablet', 'mobile']), ['all']);
  assert.match(websiteTag('placement', 'https://ads.example', ['mobile', 'tablet']), /data-one-device="mobile,tablet"/);
  assert.match(websiteTag('placement', 'https://ads.example', ['all']), /ad\.js\?v=3/);
});

test('copy uses the clipboard API and falls back when permission is denied', async () => {
  const calls = [];
  assert.equal(await copyText('tag', { clipboard: { async writeText(value) { calls.push(value); } } }, {}), true);
  assert.deepEqual(calls, ['tag']);
  const field = { value: '', style: {}, setAttribute() {}, focus() { calls.push('focus'); }, select() { calls.push('select'); }, remove() { calls.push('remove'); } };
  const page = { createElement() { return field; }, body: { appendChild() { calls.push('append'); } }, execCommand(command) { calls.push(command); return true; } };
  assert.equal(await copyText('<div>ad</div>', { clipboard: { async writeText() { throw new Error('Denied'); } } }, page), true);
  assert.equal(field.value, '<div>ad</div>');
  assert.deepEqual(calls.slice(1), ['append', 'focus', 'select', 'copy', 'remove']);
});
