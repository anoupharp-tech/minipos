/**
 * MiniPOS - state.js
 * Global application state store with pub/sub event bus
 */
'use strict';

const AppState = (() => {
  const _state = {
    currentUser: null,       // { user_id, username, display_name, role }
    token: null,
    language: 'en',
    isOnline: navigator.onLine,
    settings: {},
    products: [],
    categories: [],
    cart: [],
    pendingSalesCount: 0,
    lowStockCount: 0,
    currentRoute: '/pos',
  };

  const _listeners = {};

  function get(key) {
    return _state[key];
  }

  function set(key, value) {
    _state[key] = value;
    _emit(key, value);
    _emit('*', { key, value });
  }

  function update(key, updater) {
    _state[key] = updater(_state[key]);
    _emit(key, _state[key]);
    _emit('*', { key, value: _state[key] });
  }

  function on(event, callback) {
    if (!_listeners[event]) _listeners[event] = [];
    _listeners[event].push(callback);
    // Return unsubscribe function
    return () => {
      _listeners[event] = _listeners[event].filter(cb => cb !== callback);
    };
  }

  function _emit(event, data) {
    if (_listeners[event]) {
      _listeners[event].forEach(cb => {
        try { cb(data); } catch(e) { console.error('[State]', e); }
      });
    }
  }

  function getAll() {
    return { ..._state };
  }

  return { get, set, update, on, getAll };
})();

// Track online/offline status
window.addEventListener('online',  () => {
  AppState.set('isOnline', true);
  document.getElementById('offline-banner')?.classList.add('hidden');
});
window.addEventListener('offline', () => {
  AppState.set('isOnline', false);
  document.getElementById('offline-banner')?.classList.remove('hidden');
});
