/**
 * MiniPOS - db.js
 * IndexedDB wrapper for offline data storage
 */
'use strict';

const DB = (() => {
  const DB_NAME = 'minipos_db';
  const DB_VERSION = 1;
  let _db = null;

  const STORES = {
    products:      { keyPath: 'product_id' },
    categories:    { keyPath: 'category_id' },
    settings:      { keyPath: 'setting_key' },
    pending_sales: { keyPath: 'local_id', autoIncrement: true },
    stock_cache:   { keyPath: 'product_id' },
  };

  function open() {
    return new Promise((resolve, reject) => {
      if (_db) { resolve(_db); return; }
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        Object.entries(STORES).forEach(([name, opts]) => {
          if (!db.objectStoreNames.contains(name)) {
            db.createObjectStore(name, opts);
          }
        });
      };
      req.onsuccess = (e) => { _db = e.target.result; resolve(_db); };
      req.onerror = (e) => reject(e.target.error);
    });
  }

  async function getStore(storeName, mode = 'readonly') {
    const db = await open();
    return db.transaction(storeName, mode).objectStore(storeName);
  }

  function promisify(req) {
    return new Promise((resolve, reject) => {
      req.onsuccess = (e) => resolve(e.target.result);
      req.onerror = (e) => reject(e.target.error);
    });
  }

  async function getAll(storeName) {
    const store = await getStore(storeName);
    return promisify(store.getAll());
  }

  async function get(storeName, key) {
    const store = await getStore(storeName);
    return promisify(store.get(key));
  }

  async function put(storeName, record) {
    const store = await getStore(storeName, 'readwrite');
    return promisify(store.put(record));
  }

  async function putBulk(storeName, records) {
    const db = await open();
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    records.forEach(r => store.put(r));
    return new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = (e) => reject(e.target.error);
    });
  }

  async function del(storeName, key) {
    const store = await getStore(storeName, 'readwrite');
    return promisify(store.delete(key));
  }

  async function clear(storeName) {
    const store = await getStore(storeName, 'readwrite');
    return promisify(store.clear());
  }

  async function count(storeName) {
    const store = await getStore(storeName);
    return promisify(store.count());
  }

  // ─── Product cache ─────────────────────────────────────
  const products = {
    saveAll: (items) => putBulk('products', items),
    getAll: () => getAll('products'),
    get: (id) => get('products', id),
    save: (item) => put('products', item),
    clear: () => clear('products'),
    updateStock: async (product_id, new_qty) => {
      const p = await get('products', product_id);
      if (p) { p.stock_qty = new_qty; await put('products', p); }
    },
  };

  // ─── Category cache ────────────────────────────────────
  const categories = {
    saveAll: (items) => putBulk('categories', items),
    getAll: () => getAll('categories'),
    clear: () => clear('categories'),
  };

  // ─── Settings cache ────────────────────────────────────
  const settings = {
    save: (key, value) => put('settings', { setting_key: key, setting_value: value }),
    get: async (key) => { const r = await get('settings', key); return r ? r.setting_value : null; },
    saveAll: async (obj) => {
      const records = Object.entries(obj).map(([k, v]) => ({ setting_key: k, setting_value: v }));
      await putBulk('settings', records);
    },
    getAll: async () => {
      const records = await getAll('settings');
      const obj = {};
      records.forEach(r => { obj[r.setting_key] = r.setting_value; });
      return obj;
    },
  };

  // ─── Pending Sales (offline queue) ────────────────────
  const pendingSales = {
    add: (saleData) => put('pending_sales', { ...saleData, local_id: undefined }),
    getAll: () => getAll('pending_sales'),
    delete: (local_id) => del('pending_sales', local_id),
    count: () => count('pending_sales'),
    clear: () => clear('pending_sales'),
  };

  return { open, products, categories, settings, pendingSales };
})();
