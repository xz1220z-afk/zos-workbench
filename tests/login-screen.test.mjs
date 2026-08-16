import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { renderLogin } from '../src/app/views/login-view.mjs';

test('static shell starts with an owner login root and a hidden inert workspace', async () => {
  const [html, css, legacy] = await Promise.all([
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../assets/app.css', import.meta.url), 'utf8'),
    readFile(new URL('../src/legacy-app.mjs', import.meta.url), 'utf8'),
  ]);
  assert.match(html, /id="zosLoginRoot"/);
  assert.match(html, /id="zosAppRoot"[^>]*hidden[^>]*inert/);
  assert.match(css, /\.zos-login-screen/);
  assert.match(css, /min-height:\s*44px/);
  assert.match(css, /@media \(max-width:\s*767px\)[\s\S]*?\.zos-login-card/);
  assert.doesNotMatch(html, /id="syncPassword"|onclick="signInSyncPassword\(\)"|onclick="requestSyncOtp\(\)"/);
  assert.match(html, /data-owner-sign-out/);
  assert.match(legacy, /create_user:\s*false/);
});

test('login view uses password-manager semantics without embedding credentials', () => {
  const root = { innerHTML: '', querySelectorAll: () => [] };
  renderLogin(root, { status: 'signed_out', rememberedEmail: 'owner@example.com' }, {});
  assert.match(root.innerHTML, /autocomplete="username"/);
  assert.match(root.innerHTML, /autocomplete="current-password"/);
  assert.match(root.innerHTML, /autocomplete="one-time-code"/);
  assert.match(root.innerHTML, /type="checkbox"[^>]*data-login-remember/);
  assert.doesNotMatch(root.innerHTML, /data-login-remember[^>]*checked/);
  assert.doesNotMatch(root.innerHTML, /value="[^"]*password/i);
  assert.match(root.innerHTML, /owner@example\.com/);
});

test('blocked login view reveals only a safe owner-only explanation', () => {
  const root = { innerHTML: '', querySelectorAll: () => [] };
  renderLogin(root, { status: 'blocked', reason: 'authorization_forbidden' }, {});
  assert.match(root.innerHTML, /仅限朱帅本人账号/);
  assert.doesNotMatch(root.innerHTML, /user[_ -]?id|secret|authorization_forbidden/i);
});
