/**
 * MiniPOS - app.js
 * Application entry point and bootstrap sequence
 */
'use strict';

(async function initApp() {
  console.log('[App] MiniPOS initializing...');

  // ─── 1. Register Service Worker ─────────────────────────
  if ('serviceWorker' in navigator) {
    // Unregister any old SW first to ensure fresh start
    const regs = await navigator.serviceWorker.getRegistrations();
    for (const reg of regs) { await reg.unregister(); }
    // Clear all caches
    const keys = await caches.keys();
    await Promise.all(keys.map(k => caches.delete(k)));
    try {
      const reg = await navigator.serviceWorker.register('./sw.js');
      console.log('[App] Service Worker registered:', reg.scope);
    } catch(e) {
      console.warn('[App] SW registration failed:', e);
    }
  }

  // ─── 2. Initialize i18n ──────────────────────────────────
  I18n.init();
  I18n.apply();

  // ─── 3. Set online/offline indicator ────────────────────
  if (!navigator.onLine) {
    document.getElementById('offline-banner')?.classList.remove('hidden');
  }

  // ─── 4. Initialize scanner ──────────────────────────────
  Scanner.init();

  // ─── 5. Initialize sync ─────────────────────────────────
  Sync.init();

  // ─── 6. Open IndexedDB ──────────────────────────────────
  await DB.open().catch(e => console.warn('[App] DB open failed:', e));

  // ─── 7. Set up global UI handlers ───────────────────────
  _setupGlobalUI();

  // ─── 8. Attempt session restore ─────────────────────────
  const hasSession = Auth.restoreSession();

  // ─── 9. Load cached settings for branding ───────────────
  const cachedSettings = await DB.settings.getAll().catch(() => ({}));
  if (Object.keys(cachedSettings).length) {
    AppState.set('settings', cachedSettings);
    _applySettings(cachedSettings);
  }

  // ─── 10. Initialize router ──────────────────────────────
  // Router reads hash and decides which view to show
  if (hasSession) {
    // If no hash, default to /pos
    if (!window.location.hash || window.location.hash === '#' || window.location.hash === '#/') {
      window.location.hash = '#/pos';
    }
  } else {
    window.location.hash = '#/login';
  }

  Router.init();

  // ─── 11. If logged in, validate session + load fresh data
  if (hasSession) {
    // Validate token in background (non-blocking)
    Auth.validateSession().then(valid => {
      if (!valid) {
        Router.navigate('/login');
      } else {
        Auth.updateUI();
        _loadFreshData();
      }
    }).catch(() => {
      // If offline, keep using cached session
      Auth.updateUI();
    });
  }

  console.log('[App] MiniPOS ready');
})();

/** Apply settings from cache to UI */
function _applySettings(settings) {
  if (settings.store_name) {
    document.getElementById('sidebar-store-name').textContent = settings.store_name;
    document.getElementById('login-store-name').textContent = settings.store_name;
    document.title = settings.store_name + ' - POS';
  }
  if (settings.store_logo_url) {
    const sidebarLogo = document.getElementById('sidebar-logo');
    if (sidebarLogo) { sidebarLogo.src = settings.store_logo_url; sidebarLogo.style.display = ''; }
    const loginLogo = document.getElementById('login-logo-img');
    if (loginLogo) { loginLogo.src = settings.store_logo_url; loginLogo.style.display = ''; }
  }
  if (settings.default_language) {
    I18n.setLanguage(settings.default_language);
  }
}

/** Load fresh data from API after login */
async function _loadFreshData() {
  try {
    const [settings, products, categories] = await Promise.all([
      API.settings.getAll(),
      API.products.list({ active_only: 'true' }),
      API.categories.list(),
    ]);
    AppState.set('settings', settings);
    AppState.set('products', products);
    AppState.set('categories', categories);
    await Promise.all([
      DB.settings.saveAll(settings),
      DB.products.saveAll(products),
      DB.categories.saveAll(categories),
    ]);
    _applySettings(settings);
    Auth.updateUI();

    // Check low stock
    const lowThreshold = parseInt(settings.low_stock_default || 10);
    const lowCount = products.filter(p =>
      p.stock_qty <= (p.low_stock_threshold || lowThreshold) && p.stock_qty > 0
    ).length;
    AppState.set('lowStockCount', lowCount);

    const alertBtn = document.getElementById('low-stock-alert');
    const countEl  = document.getElementById('low-stock-count');
    if (alertBtn && countEl) {
      alertBtn.classList.toggle('hidden', lowCount === 0);
      countEl.textContent = lowCount;
    }
  } catch(e) {
    console.warn('[App] Fresh data load failed (using cache):', e.message);
  }
}

/** Set up global UI interactions */
function _setupGlobalUI() {
  // Logout button
  document.getElementById('logout-btn')?.addEventListener('click', () => {
    Auth.logout();
  });

  // Sidebar mobile toggle
  document.getElementById('menu-btn')?.addEventListener('click', () => {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    sidebar?.classList.add('open');
    overlay?.classList.remove('hidden');
  });
  document.getElementById('sidebar-close-btn')?.addEventListener('click', _closeSidebar);
  document.getElementById('sidebar-overlay')?.addEventListener('click', _closeSidebar);

  // Close sidebar on nav item click (mobile)
  document.getElementById('sidebar')?.addEventListener('click', (e) => {
    if (e.target.closest('.nav-item') && window.innerWidth <= 768) _closeSidebar();
  });

  // Global modal close button
  document.getElementById('modal-close-btn')?.addEventListener('click', Utils.closeModal);
  document.getElementById('modal-overlay')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) Utils.closeModal();
  });

  // Payment modal close
  document.getElementById('payment-modal-close')?.addEventListener('click', () => {
    document.getElementById('payment-modal')?.classList.add('hidden');
  });
  document.getElementById('payment-modal')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) document.getElementById('payment-modal')?.classList.add('hidden');
  });

  // Receipt modal close
  document.getElementById('receipt-modal-close')?.addEventListener('click', () => {
    document.getElementById('receipt-modal')?.classList.add('hidden');
  });

  // Low stock alert click
  document.getElementById('low-stock-alert')?.addEventListener('click', () => {
    Router.navigate('/stock');
  });

  // Handle app state changes
  AppState.on('currentUser', (user) => {
    if (!user) return;
    Auth.updateUI();
  });

  AppState.on('lowStockCount', (count) => {
    const btn = document.getElementById('low-stock-alert');
    const el  = document.getElementById('low-stock-count');
    if (!btn || !el) return;
    btn.classList.toggle('hidden', count === 0);
    el.textContent = count;
  });

  // Back button on Android
  window.addEventListener('popstate', () => {
    // Let router handle it
  });

  // Prevent zoom on double-tap for POS buttons (iOS)
  let lastTouchEnd = 0;
  document.addEventListener('touchend', (e) => {
    const now = Date.now();
    if (now - lastTouchEnd <= 300) e.preventDefault();
    lastTouchEnd = now;
  }, { passive: false });
}

function _closeSidebar() {
  document.getElementById('sidebar')?.classList.remove('open');
  document.getElementById('sidebar-overlay')?.classList.add('hidden');
}
