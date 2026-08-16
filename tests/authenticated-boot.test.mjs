import assert from 'node:assert/strict';
import test from 'node:test';
import { createAuthenticatedBootstrap } from '../src/app/authenticated-bootstrap.mjs';

function root() {
  const attrs = new Map();
  return {
    hidden: false, inert: false, innerHTML: '',
    setAttribute(name, value) { attrs.set(name, String(value)); },
    removeAttribute(name) { attrs.delete(name); },
    getAttribute(name) { return attrs.get(name) || null; },
  };
}

test('remote application is not constructed before owner authorization', async () => {
  let resolveAuth;
  const waiting = new Promise((resolve) => { resolveAuth = resolve; });
  let created = 0;
  const appRoot = root();
  const loginRoot = root();
  const controller = createAuthenticatedBootstrap({
    gate: { bootstrap: () => waiting }, appRoot, loginRoot,
    renderLogin: () => {},
    createApplication: () => { created += 1; return { start: async () => {}, stop() {} }; },
  });

  const start = controller.start();
  assert.equal(created, 0);
  assert.equal(appRoot.hidden, true);
  assert.equal(appRoot.inert, true);
  resolveAuth({ status: 'authorized', userId: 'owner-user', offlineReadOnly: false });
  await start;
  assert.equal(created, 1);
  assert.equal(appRoot.hidden, false);
  assert.equal(appRoot.inert, false);
  assert.equal(loginRoot.hidden, true);
});

test('signed-out and blocked states keep deep-linked workspace content inaccessible', async () => {
  for (const state of [
    { status: 'signed_out', reason: 'session_missing' },
    { status: 'blocked', reason: 'authorization_forbidden' },
  ]) {
    let created = 0;
    const appRoot = root();
    const loginRoot = root();
    const rendered = [];
    const controller = createAuthenticatedBootstrap({
      gate: { bootstrap: async () => state }, appRoot, loginRoot,
      renderLogin: (_root, value) => rendered.push(value.status),
      createApplication: () => { created += 1; return {}; },
    });
    await controller.start();
    assert.equal(created, 0);
    assert.equal(appRoot.hidden, true);
    assert.equal(appRoot.getAttribute('aria-hidden'), 'true');
    assert.equal(loginRoot.hidden, false);
    assert.equal(rendered.at(-1), state.status);
  }
});

test('logout hides the workspace before stopping runtimes and returning to login', async () => {
  const order = [];
  const appRoot = root();
  const loginRoot = root();
  const gate = {
    bootstrap: async () => ({ status: 'authorized', userId: 'owner-user' }),
    signOut: async () => { order.push(`gate:${appRoot.hidden}`); return { status: 'signed_out', reason: 'signed_out' }; },
  };
  const controller = createAuthenticatedBootstrap({
    gate, appRoot, loginRoot, renderLogin: () => order.push('login'),
    createApplication: () => ({ start: async () => order.push('start'), stop: () => order.push(`stop:${appRoot.hidden}`) }),
  });
  await controller.start();
  await controller.signOut();
  assert.deepEqual(order, ['login', 'start', 'stop:true', 'gate:true', 'login']);
});

test('valid offline owner lease opens only the local read-only application mode', async () => {
  let received;
  const controller = createAuthenticatedBootstrap({
    gate: { bootstrap: async () => ({ status: 'authorized', userId: 'owner-user', offlineReadOnly: true }) },
    appRoot: root(), loginRoot: root(), renderLogin: () => {},
    createApplication: (options) => { received = options; return { start: async () => {} }; },
  });
  await controller.start();
  assert.deepEqual(received, { offlineReadOnly: true });
});
