/**
 * MiniPOS - auth.js
 * Authentication, session management, role checks
 */
'use strict';

const Auth = (() => {
  const TOKEN_KEY = 'pos_token';
  const USER_KEY  = 'pos_user';

  function getToken() {
    return localStorage.getItem(TOKEN_KEY) || '';
  }

  function getUser() {
    try {
      return JSON.parse(localStorage.getItem(USER_KEY)) || null;
    } catch { return null; }
  }

  function isLoggedIn() {
    return !!getToken() && !!getUser();
  }

  function isAdmin() {
    const user = getUser();
    return user && user.role === 'admin';
  }

  function isStaff() {
    const user = getUser();
    return user && (user.role === 'staff' || user.role === 'admin');
  }

  function can(action) {
    const user = getUser();
    if (!user) return false;
    if (user.role === 'admin') return true;
    // Staff restrictions
    const staffDenied = ['deleteProduct', 'viewProfit', 'manageUsers', 'manageSettings', 'adjustStock', 'deleteCategory'];
    return !staffDenied.includes(action);
  }

  async function login(username, password) {
    const data = await API.auth.login(username, password);
    // Store token and user in localStorage
    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    AppState.set('token', data.token);
    AppState.set('currentUser', data.user);
    return data;
  }

  async function logout() {
    try { await API.auth.logout(); } catch(e) {}
    _clearSession();
    AppState.set('token', null);
    AppState.set('currentUser', null);
    // Redirect to login
    window.location.hash = '#/login';
  }

  function _clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

  /** Restore session from localStorage on app init */
  function restoreSession() {
    const token = getToken();
    const user = getUser();
    if (token && user) {
      AppState.set('token', token);
      AppState.set('currentUser', user);
      return true;
    }
    return false;
  }

  /** Validate token with server (called on app init) */
  async function validateSession() {
    if (!getToken()) return false;
    try {
      const data = await API.auth.validateToken();
      if (data && data.user) {
        localStorage.setItem(USER_KEY, JSON.stringify(data.user));
        AppState.set('currentUser', data.user);
        return true;
      }
      return false;
    } catch(e) {
      if (e.code === 401) { _clearSession(); return false; }
      // Network error - use cached session
      return isLoggedIn();
    }
  }

  /** Update sidebar UI for current user */
  function updateUI() {
    const user = getUser();
    if (!user) return;

    // Update avatar
    const avatar = document.getElementById('user-avatar');
    if (avatar) avatar.textContent = (user.display_name || user.username || 'U')[0].toUpperCase();

    // Update name/role
    const nameEl = document.getElementById('sidebar-user-name');
    const roleEl = document.getElementById('sidebar-user-role');
    if (nameEl) nameEl.textContent = user.display_name || user.username;
    if (roleEl) roleEl.textContent = I18n.t('role_' + user.role) || user.role;

    // Show/hide admin-only elements
    const adminOnly = document.querySelectorAll('.admin-only');
    adminOnly.forEach(el => {
      el.style.display = isAdmin() ? '' : 'none';
    });
  }

  return { getToken, getUser, isLoggedIn, isAdmin, isStaff, can, login, logout, restoreSession, validateSession, updateUI };
})();
