const DEFAULT_TITLES = Object.freeze({
  dashboard: 'CEO 指挥中心', decisions: '待我决策', today: '今日行动',
  'local-life': '万嘉网络', 'spark-media': '花火影像', enterprise: '企业项目',
  targets: '经营目标', health: '数据健康', 'zos-brain': 'ZOS 企业大脑',
  risk: '风险中心', inbox: '收集箱', tasks: '任务', privacy: '隐私与数据', settings: '设置',
});

export function createRouter({ document, onEnter = {}, titles = DEFAULT_TITLES } = {}) {
  if (!document?.querySelectorAll) throw new Error('document is required');
  let current = document.querySelector('.page.active')?.id?.replace('page-', '') || 'dashboard';

  function navigate(pageId, options = {}) {
    const target = document.getElementById(`page-${pageId}`);
    if (!target) return false;
    document.querySelectorAll('.page').forEach((page) => page.classList.toggle('active', page === target));
    document.querySelectorAll('[data-page]').forEach((item) => item.classList.toggle('active', item.dataset.page === pageId));
    const title = document.getElementById('pageTitle');
    if (title) title.textContent = titles[pageId] || pageId;
    current = pageId;
    onEnter[pageId]?.();
    if (options.focusPage) {
      const focusTarget = target.querySelector('h1, h2') || target;
      focusTarget.setAttribute('tabindex', '-1');
      focusTarget.focus({ preventScroll: true });
    }
    return true;
  }

  function bind() {
    document.querySelectorAll('[data-page]').forEach((item) => {
      if (item.dataset.v13RouterBound) return;
      item.dataset.v13RouterBound = 'true';
      item.addEventListener('click', () => navigate(item.dataset.page));
    });
  }

  return { navigate, bind, current: () => current };
}
