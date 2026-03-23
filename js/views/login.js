/**
 * MiniPOS - views/login.js
 * Login view
 */
'use strict';

const LoginView = (() => {

  async function render(container) {
    // Load store name from cached settings
    const settings = await DB.settings.getAll().catch(() => ({}));
    const storeName = settings.store_name || 'MiniPOS';
    const logoUrl   = settings.store_logo_url || '';

    document.getElementById('login-store-name').textContent = storeName;
    document.getElementById('sidebar-store-name').textContent = storeName;
    if (logoUrl) {
      const logoImg = document.getElementById('login-logo-img');
      if (logoImg) { logoImg.src = logoUrl; logoImg.style.display = ''; }
    }

    // The login form is in index.html, just show login-screen
    const loginScreen = document.getElementById('login-screen');
    loginScreen?.classList.remove('hidden');

    // Focus username field
    setTimeout(() => document.getElementById('login-username')?.focus(), 100);

    I18n.apply(loginScreen);
  }

  function init() {
    const form = document.getElementById('login-form');
    const errorEl = document.getElementById('login-error');

    form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = document.getElementById('login-username').value.trim();
      const password = document.getElementById('login-password').value;

      if (!username || !password) return;

      const btn = document.getElementById('login-btn');
      btn.disabled = true;
      btn.textContent = I18n.t('loading');
      errorEl?.classList.add('hidden');

      try {
        await Auth.login(username, password);

        // Load settings and data
        await _postLoginSetup();

        // Navigate to POS
        Router.navigate('/pos');
      } catch(e) {
        errorEl.textContent = e.message === 'Invalid credentials' ? I18n.t('login_error') : (e.message || I18n.t('login_error'));
        errorEl?.classList.remove('hidden');
        document.getElementById('login-password').value = '';
      } finally {
        btn.disabled = false;
        btn.textContent = I18n.t('login');
      }
    });
  }

  async function _postLoginSetup() {
    try {
      // Load settings
      const settings = await API.settings.getAll();
      AppState.set('settings', settings);
      await DB.settings.saveAll(settings);

      // Apply store name
      const storeName = settings.store_name || 'MiniPOS';
      document.getElementById('sidebar-store-name').textContent = storeName;
      document.title = storeName + ' - POS';

      // Load categories into state + cache
      const cats = await API.categories.list();
      AppState.set('categories', cats);
      await DB.categories.saveAll(cats);

      // Load products into state + cache
      const prods = await API.products.list({ active_only: 'true' });
      AppState.set('products', prods);
      await DB.products.saveAll(prods);

      // Check low stock
      _checkLowStock(prods, settings);

    } catch(e) {
      console.warn('[Login] Post-login setup error (may be offline):', e);
      // Try to load from cache
      try {
        const settings = await DB.settings.getAll();
        const cats = await DB.categories.getAll();
        const prods = await DB.products.getAll();
        AppState.set('settings', settings);
        AppState.set('categories', cats);
        AppState.set('products', prods);
      } catch {}
    }
  }

  function _checkLowStock(products, settings) {
    const threshold = parseInt(settings?.low_stock_default || 10);
    const lowCount = products.filter(p => p.stock_qty <= (p.low_stock_threshold || threshold) && p.stock_qty > 0).length;
    AppState.set('lowStockCount', lowCount);

    const alertBtn = document.getElementById('low-stock-alert');
    const countEl = document.getElementById('low-stock-count');
    if (alertBtn && countEl) {
      if (lowCount > 0) {
        alertBtn.classList.remove('hidden');
        countEl.textContent = lowCount;
        alertBtn.onclick = () => Router.navigate('/stock');
      } else {
        alertBtn.classList.add('hidden');
      }
    }
  }

  function destroy() {}

  // Initialize immediately (form is always in DOM)
  init();

  return { render, destroy };
})();
