function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[character]));
}

function safeMessage(state) {
  if (state.status === 'checking') return '正在核验这台设备…';
  if (state.status === 'authenticating') return '正在安全登录…';
  if (state.reason === 'otp_sent') return '验证码或登录链接已发送，请检查邮箱。';
  if (state.status === 'blocked') return '仅限朱帅本人账号。请使用已授权邮箱登录，或移除此设备后重试。';
  return '登录后才会启动工作台、业务读取、Agent 与跨端同步。';
}

function bind(root, selector, event, handler) {
  const element = root.querySelector?.(selector);
  if (element && typeof handler === 'function') element.addEventListener(event, handler);
}

export function renderLogin(root, state = {}, actions = {}) {
  if (!root) return;
  const email = escapeHtml(state.rememberedEmail || '');
  const busy = ['checking', 'authenticating'].includes(state.status);
  root.innerHTML = `
    <div class="zos-login-screen" data-login-state="${escapeHtml(state.status || 'signed_out')}">
      <div class="zos-login-ambient" aria-hidden="true"></div>
      <main class="zos-login-card" aria-labelledby="zosLoginTitle">
        <div class="zos-login-brand"><span>ZOS</span><small>CEO Operating System</small></div>
        <div class="zos-login-heading">
          <p class="zos-login-kicker">OWNER ACCESS · PRIVATE WORKSPACE</p>
          <h1 id="zosLoginTitle">欢迎回来，朱帅</h1>
          <p>${safeMessage(state)}</p>
        </div>
        <form data-login-password-form novalidate>
          <label>登录邮箱
            <input name="email" type="email" value="${email}" autocomplete="username" inputmode="email" required ${busy ? 'disabled' : ''}>
          </label>
          <label>登录密码
            <input name="password" type="password" autocomplete="current-password" required ${busy ? 'disabled' : ''}>
          </label>
          <label class="zos-login-check"><input type="checkbox" data-login-remember> <span>记住邮箱（密码由系统密码管理器保存）</span></label>
          <button class="zos-login-primary" type="submit" ${busy ? 'disabled' : ''}>进入工作台</button>
        </form>
        <details class="zos-login-otp">
          <summary>使用邮箱验证码</summary>
          <div class="zos-login-otp-grid">
            <label>邮箱<input data-login-otp-email type="email" value="${email}" autocomplete="username" inputmode="email"></label>
            <button type="button" data-login-request-otp>发送验证码</button>
            <label>验证码<input data-login-otp-token type="text" autocomplete="one-time-code" inputmode="numeric" maxlength="12"></label>
            <button type="button" data-login-verify-otp>验证并进入</button>
          </div>
        </details>
        ${state.status === 'blocked' ? '<button class="zos-login-device" type="button" data-login-remove-device>移除此设备的登录记录</button>' : ''}
        <p class="zos-login-security">密码不会写入工作台、本地存储、网址或日志。离线时不会解锁工作台，联网完成业主核验后方可进入。</p>
      </main>
    </div>`;

  bind(root, '[data-login-password-form]', 'submit', (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    actions.onPassword?.({
      email: form.elements.email.value.trim(),
      password: form.elements.password.value,
      rememberEmail: Boolean(root.querySelector?.('[data-login-remember]')?.checked),
    });
    form.elements.password.value = '';
  });
  bind(root, '[data-login-request-otp]', 'click', () => actions.onRequestOtp?.({
    email: root.querySelector?.('[data-login-otp-email]')?.value.trim() || '',
  }));
  bind(root, '[data-login-verify-otp]', 'click', () => actions.onVerifyOtp?.({
    email: root.querySelector?.('[data-login-otp-email]')?.value.trim() || '',
    token: root.querySelector?.('[data-login-otp-token]')?.value.trim() || '',
    rememberEmail: Boolean(root.querySelector?.('[data-login-remember]')?.checked),
  }));
  bind(root, '[data-login-remove-device]', 'click', () => actions.onRemoveDevice?.());
}
