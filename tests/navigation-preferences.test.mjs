import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeNavigationMode,
  shouldExpandNavigation,
  PRIMARY_NAVIGATION_PAGES,
} from '../src/app/navigation-preferences.mjs';

test('desktop navigation defaults to focused mode and accepts only supported persisted values', () => {
  assert.equal(normalizeNavigationMode(), 'focused');
  assert.equal(normalizeNavigationMode('focused'), 'focused');
  assert.equal(normalizeNavigationMode('all'), 'all');
  assert.equal(normalizeNavigationMode('expanded'), 'focused');
});

test('secondary deep links reveal the complete navigation without changing the saved preference', () => {
  assert.equal(PRIMARY_NAVIGATION_PAGES.has('dashboard'), true);
  assert.equal(PRIMARY_NAVIGATION_PAGES.has('today'), true);
  assert.equal(PRIMARY_NAVIGATION_PAGES.has('local-life'), true);
  assert.equal(PRIMARY_NAVIGATION_PAGES.has('settings'), false);
  assert.equal(shouldExpandNavigation({ mode: 'focused', pageId: 'dashboard' }), false);
  assert.equal(shouldExpandNavigation({ mode: 'focused', pageId: 'settings' }), true);
  assert.equal(shouldExpandNavigation({ mode: 'all', pageId: 'dashboard' }), true);
});
