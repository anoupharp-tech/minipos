/**
 * MiniPOS - router.js
 * Hash-based SPA router
 * Routes: /login /pos /products /categories /stock /barcodes /reports /settings /users
 */
'use strict';

const Router = (() => {
  const ROUTES = {
    '/login':      { view: () => LoginView,      auth: false,  roles: [] },
    '/pos':        { view: () => PosView,         auth: true,   roles: ['admin', 'staff'] },
    '/products':   { view: () => ProductsView,    auth: true,   roles: ['admin'] },
    '/categories': { view: () => CategoriesView,  auth: true,   roles: ['admin'] },
    '/stock':      { view: () => StockView,        auth: true,   roles: ['admin'] },
    '/barcodes':   { view: () => BarcodesView,     auth: true,   roles: ['admin'] },
    '/reports':    { view: () => ReportsView,      auth: true,   roles: ['admin'] },
    '/settings':   { view: () => SettingsView,     auth: true,   roles: ['admin'] },
    '/users':      { view: () => UsersView,        auth: true,   roles: ['admin'] },
  };

  let _currentRoute = null;
  let _currentView = null;

  function getCurrentRoute() {
    const hash = window.location.hash.slice(1) || '/pos';
    return hash.split('?')[0] || '/pos';
  }

  function navigate(path) {
    window.location.hash = '#' + path;
  }

  async function _handleRoute() {
    const path = getCurrentRoute();
    const routeDef = ROUTES[path];

    if (!routeDef) {
      navigate(Auth.isLoggedIn() ? '/pos' : '/login');
      return;
    }

    // Auth check
    if (routeDef.auth && !Auth.isLoggedIn()) {
      navigate('/login');
      return;
    }

    // Already logged in and trying to access /login
    if (path === '/login' && Auth.isLoggedIn()) {
      navigate('/pos');
      return;
    }

    // Role check
    if (routeDef.roles && routeDef.roles.length > 0) {
      const user = Auth.getUser();
      if (user && !routeDef.roles.includes(user.role)) {
        navigate('/pos');
        return;
      }
    }

    _currentRoute = path;
    AppState.set('currentRoute', path);

    // Show/hide app shell vs login screen
    const loginScreen = document.getElementById('login-screen');
    const appShell    = document.getElementById('app-shell');

    if (path === '/login') {
      loginScreen?.classList.remove('hidden');
      appShell?.classList.add('hidden');
    } else {
      loginScreen?.classList.add('hidden');
      appShell?.classList.remove('hidden');
    }

    // Update topbar title and active nav item
    _updateNav(path);

    // Destroy current view
    if (_currentView && typeof _currentView.destroy === 'function') {
      _currentView.destroy();
    }

    // Render new view
    const container = document.getElementById('view-container');
    if (!container) return;

    const ViewClass = routeDef.view();
    if (ViewClass) {
      _currentView = ViewClass;
      try {
        container.innerHTML = '';
        await ViewClass.render(container);
      } catch(e) {
        console.error('[Router] View render error:', e);
        container.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-icon">⚠️</div>
            <div class="empty-state-text">${I18n.t('error_loading')}</div>
            <button class="btn btn-primary mt-4" onclick="Router.navigate('${path}')">${I18n.t('retry')}</button>
          </div>
        `;
      }
    }

    // Apply translations to newly rendered view
    I18n.apply(container);
  }

  function _updateNav(path) {
    // Update active nav item
    document.querySelectorAll('.nav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.route === path);
    });

    // Update topbar title
    const routeTitleMap = {
      '/pos': 'nav_pos',
      '/products': 'nav_products',
      '/categories': 'nav_categories',
      '/stock': 'nav_stock',
      '/barcodes': 'nav_barcodes',
      '/reports': 'nav_reports',
      '/settings': 'nav_settings',
      '/users': 'nav_users',
    };
    const titleEl = document.getElementById('topbar-title');
    if (titleEl && routeTitleMap[path]) {
      titleEl.textContent = I18n.t(routeTitleMap[path]);
    }
  }

  function init() {
    window.addEventListener('hashchange', _handleRoute);
    // Initial load
    _handleRoute();
  }

  return { navigate, init, getCurrentRoute };
})();
