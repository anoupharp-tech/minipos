/**
 * MiniPOS - api.js
 * Google Apps Script API communication layer
 * IMPORTANT: GAS doPost requires Content-Type: text/plain
 */
'use strict';

const API = (() => {
  // Set your GAS Web App URL here after deployment
  let BASE_URL = localStorage.getItem('pos_api_url') || '';

  function setBaseUrl(url) {
    BASE_URL = url;
    localStorage.setItem('pos_api_url', url);
  }

  function getBaseUrl() { return BASE_URL; }

  function _getToken() {
    return AppState.get('token') || localStorage.getItem('pos_token') || '';
  }

  /** GET request to GAS */
  async function get(action, params = {}) {
    if (!BASE_URL) throw new Error('API URL not configured. Go to Settings.');

    const url = new URL(BASE_URL);
    url.searchParams.set('action', action);
    if (action !== 'login' && action !== 'validateToken') {
      url.searchParams.set('token', _getToken());
    }
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null) url.searchParams.set(k, v);
    });

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const json = await response.json();
    if (json.status === 'error') {
      const err = new Error(json.error || 'Unknown API error');
      err.code = json.code;
      throw err;
    }
    return json.data;
  }

  /** POST request to GAS - must use text/plain for GAS doPost to parse body */
  async function post(action, payload = {}) {
    if (!BASE_URL) throw new Error('API URL not configured. Go to Settings.');

    const body = {
      action,
      token: action !== 'login' ? _getToken() : undefined,
      payload,
    };

    const response = await fetch(BASE_URL, {
      method: 'POST',
      // GAS doPost requires text/plain — application/json causes body parse failure
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body),
      redirect: 'follow',
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const json = await response.json();
    if (json.status === 'error') {
      const err = new Error(json.error || 'Unknown API error');
      err.code = json.code;
      throw err;
    }
    return json.data;
  }

  // ─── Auth ─────────────────────────────────────────────
  const auth = {
    login: (username, password) => get('login', { username, password }),
    logout: () => post('logout', {}),
    validateToken: () => get('validateToken'),
  };

  // ─── Products ─────────────────────────────────────────
  const products = {
    list: (params = {}) => get('getProducts', params),
    get: (product_id) => get('getProduct', { product_id }),
    getByBarcode: (barcode) => get('getProductByBarcode', { barcode }),
    create: (data) => post('createProduct', data),
    update: (data) => post('updateProduct', data),
    delete: (product_id) => post('deleteProduct', { product_id }),
  };

  // ─── Categories ───────────────────────────────────────
  const categories = {
    list: () => get('getCategories'),
    create: (data) => post('createCategory', data),
    update: (data) => post('updateCategory', data),
    delete: (category_id) => post('deleteCategory', { category_id }),
  };

  // ─── Sales ────────────────────────────────────────────
  const sales = {
    create: (data) => post('createSale', data),
    list: (params = {}) => get('getSales', params),
    get: (sale_id) => get('getSale', { sale_id }),
    syncOffline: (salesArray) => post('syncOfflineSales', { sales: salesArray }),
  };

  // ─── Stock ────────────────────────────────────────────
  const stock = {
    history: (params = {}) => get('getStockHistory', params),
    lowStock: () => get('getLowStockProducts'),
    adjust: (data) => post('adjustStock', data),
  };

  // ─── Barcodes ─────────────────────────────────────────
  const barcodes = {
    getNext: (type = 'CODE128') => get('getNextBarcode', { type }),
    reserve: (count, type) => post('reserveBarcodes', { count, type }),
    checkExists: (barcode) => get('checkBarcodeExists', { barcode }),
  };

  // ─── Reports ──────────────────────────────────────────
  const reports = {
    daily: (date) => get('getDailySalesReport', { date }),
    monthly: (year, month) => get('getMonthlySalesReport', { year, month }),
    profit: (date_from, date_to) => get('getProfitReport', { date_from, date_to }),
    bestSelling: (date_from, date_to, limit = 10) => get('getBestSellingProducts', { date_from, date_to, limit }),
    stockSummary: () => get('getStockSummaryReport'),
  };

  // ─── Settings ─────────────────────────────────────────
  const settings = {
    getAll: () => get('getSettings'),
    update: (key, value) => post('updateSettings', { key, value }),
    updateMultiple: (pairs) => post('updateSettingsMultiple', { pairs }),
  };

  // ─── Users ────────────────────────────────────────────
  const users = {
    list: () => get('getUsers'),
    create: (data) => post('createUser', data),
    update: (data) => post('updateUser', data),
    delete: (user_id) => post('deleteUser', { user_id }),
  };

  return {
    setBaseUrl,
    getBaseUrl,
    get,
    post,
    auth,
    products,
    categories,
    sales,
    stock,
    barcodes,
    reports,
    settings,
    users,
  };
})();
