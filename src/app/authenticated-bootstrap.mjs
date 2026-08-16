function lockWorkspace(appRoot) {
  appRoot.hidden = true;
  appRoot.inert = true;
  appRoot.setAttribute?.('aria-hidden', 'true');
}

function unlockWorkspace(appRoot) {
  appRoot.hidden = false;
  appRoot.inert = false;
  appRoot.removeAttribute?.('aria-hidden');
}

export function createAuthenticatedBootstrap({
  gate,
  appRoot,
  loginRoot,
  renderLogin,
  createApplication,
} = {}) {
  if (!gate || !appRoot || !loginRoot || typeof renderLogin !== 'function' || typeof createApplication !== 'function') {
    throw new Error('authenticated_bootstrap_configuration_invalid');
  }
  let application = null;

  async function show(state) {
    if (state?.status === 'authorized') {
      loginRoot.hidden = true;
      loginRoot.setAttribute?.('aria-hidden', 'true');
      unlockWorkspace(appRoot);
      if (!application) {
        application = createApplication({ offlineReadOnly: Boolean(state.offlineReadOnly) });
        await application?.start?.();
      }
      return state;
    }

    lockWorkspace(appRoot);
    loginRoot.hidden = false;
    loginRoot.removeAttribute?.('aria-hidden');
    renderLogin(loginRoot, state || { status: 'signed_out' }, {
      onPassword: async ({ email, password, rememberEmail }) => show(
        await gate.signInWithPassword(email, password, rememberEmail),
      ),
      onRequestOtp: async ({ email }) => show(await gate.requestOtp(email)),
      onVerifyOtp: async ({ email, token, rememberEmail }) => show(
        await gate.verifyOtp(email, token, rememberEmail),
      ),
      onRemoveDevice: async () => show(await gate.removeDevice()),
    });
    return state;
  }

  return {
    async start() {
      lockWorkspace(appRoot);
      loginRoot.hidden = false;
      renderLogin(loginRoot, { status: 'checking', reason: 'startup' }, {});
      return show(await gate.bootstrap());
    },

    async signOut() {
      lockWorkspace(appRoot);
      application?.stop?.();
      application = null;
      return show(await gate.signOut());
    },

    async removeDevice() {
      lockWorkspace(appRoot);
      application?.stop?.();
      application = null;
      return show(await gate.removeDevice());
    },

    get application() { return application; },
  };
}
