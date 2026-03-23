/**
 * MiniPOS - views/settings.js
 * System settings: store info, tax, currency, receipt, printer, language
 */
'use strict';

const SettingsView = (() => {
  let _settings = {};

  async function render(container) {
    container.innerHTML = `<div class="loading-screen"><div class="spinner"></div></div>`;
    try {
      _settings = await API.settings.getAll();
      AppState.set('settings', _settings);
      await DB.settings.saveAll(_settings);
    } catch(e) {
      _settings = await DB.settings.getAll().catch(() => ({})) || AppState.get('settings') || {};
    }
    container.innerHTML = _html();
    _bindEvents(container);
  }

  function _html() {
    const s = _settings;
    const langOptions = [
      ['en', 'English'], ['lo', 'ລາວ'], ['th', 'ภาษาไทย'], ['zh', '中文']
    ].map(([v, l]) => `<option value="${v}" ${s.default_language === v ? 'selected' : ''}>${l}</option>`).join('');

    const receiptOptions = ['58','80'].map(w =>
      `<option value="${w}" ${s.receipt_width === w ? 'selected' : ''}>${w}mm</option>`
    ).join('');

    return `
      <div class="section-header">
        <h2 class="section-title" data-i18n="settings">Settings</h2>
        <button class="btn btn-primary" id="btn-save-settings">💾 ${I18n.t('save_settings')}</button>
      </div>

      <!-- API URL Configuration -->
      <div class="card mb-4">
        <h3 class="font-bold mb-3">🔗 Google Apps Script API URL</h3>
        <p class="text-muted text-sm mb-3">Enter your deployed GAS Web App URL below. Get this from Google Apps Script → Deploy → Manage deployments.</p>
        <div class="form-group">
          <label class="required">API URL</label>
          <input type="url" class="form-control" id="s-api-url" value="${Utils.escapeHtml(API.getBaseUrl() || '')}"
            placeholder="https://script.google.com/macros/s/your-deployment-id/exec">
        </div>
        <button class="btn btn-ghost btn-sm mt-2" id="btn-test-api">Test Connection</button>
        <span id="api-test-result" style="margin-left:8px;font-size:13px"></span>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;max-width:900px">
        <!-- Store Info -->
        <div class="card">
          <h3 class="font-bold mb-4" data-i18n="store_info">Store Information</h3>
          <div class="form-grid" style="gap:12px">
            <div class="form-group"><label data-i18n="store_name">Store Name</label>
              <input type="text" class="form-control" id="s-store-name" value="${Utils.escapeHtml(s.store_name || '')}"></div>
            <div class="form-group"><label data-i18n="store_address">Address</label>
              <input type="text" class="form-control" id="s-address" value="${Utils.escapeHtml(s.store_address || '')}"></div>
            <div class="form-group"><label data-i18n="store_phone">Phone</label>
              <input type="text" class="form-control" id="s-phone" value="${Utils.escapeHtml(s.store_phone || '')}"></div>
            <div class="form-group"><label data-i18n="store_logo">Logo URL (Google Drive link)</label>
              <input type="url" class="form-control" id="s-logo" value="${Utils.escapeHtml(s.store_logo_url || '')}" placeholder="https://drive.google.com/uc?export=view&id=..."></div>
          </div>
        </div>

        <!-- Tax & Currency -->
        <div class="card">
          <h3 class="font-bold mb-4" data-i18n="tax_settings">Tax & Currency</h3>
          <div class="form-grid" style="gap:12px">
            <div class="form-group"><label data-i18n="tax_rate">Tax Rate (%)</label>
              <input type="number" class="form-control" id="s-tax-rate" value="${s.tax_rate || 0}" min="0" max="100" step="0.1"></div>
            <div class="form-group"><label data-i18n="tax_label">Tax Label (e.g. VAT, GST)</label>
              <input type="text" class="form-control" id="s-tax-label" value="${Utils.escapeHtml(s.tax_label || 'Tax')}"></div>
            <div class="form-group"><label data-i18n="currency_symbol">Currency Symbol</label>
              <input type="text" class="form-control" id="s-currency" value="${Utils.escapeHtml(s.currency_symbol || '₭')}" maxlength="5"></div>
            <div class="form-group"><label>Currency Code</label>
              <input type="text" class="form-control" id="s-currency-code" value="${Utils.escapeHtml(s.currency_code || 'LAK')}" maxlength="5"></div>
          </div>
        </div>

        <!-- Receipt & Printer -->
        <div class="card">
          <h3 class="font-bold mb-4" data-i18n="receipt_settings">Receipt & Printer</h3>
          <div class="form-grid" style="gap:12px">
            <div class="form-group"><label data-i18n="receipt_width">Thermal Printer Width</label>
              <select class="form-control" id="s-receipt-width">${receiptOptions}</select></div>
            <div class="form-group"><label>Receipt Footer Message</label>
              <input type="text" class="form-control" id="s-receipt-footer" value="${Utils.escapeHtml(s.receipt_footer || '')}"></div>
            <div class="form-group"><label>Low Stock Alert Threshold</label>
              <input type="number" class="form-control" id="s-low-stock" value="${s.low_stock_default || 10}" min="0"></div>
          </div>
        </div>

        <!-- Language & General -->
        <div class="card">
          <h3 class="font-bold mb-4">Language & General</h3>
          <div class="form-grid" style="gap:12px">
            <div class="form-group"><label data-i18n="default_language">Default Language</label>
              <select class="form-control" id="s-lang">${langOptions}</select></div>
            <div class="form-group"><label>Barcode Prefix (for EAN-13)</label>
              <input type="text" class="form-control" id="s-barcode-prefix" value="${Utils.escapeHtml(s.barcode_prefix || '20')}" maxlength="2"></div>
          </div>
        </div>
      </div>

      <!-- Data Management -->
      <div class="card mt-4" style="max-width:900px">
        <h3 class="font-bold mb-3">🗄️ Data & Cache</h3>
        <div style="display:flex;gap:12px;flex-wrap:wrap">
          <button class="btn btn-ghost" id="btn-clear-cache">Clear Local Cache</button>
          <button class="btn btn-ghost" id="btn-sync-now">🔄 Sync Offline Sales</button>
          <span id="pending-count" class="text-muted text-sm" style="display:flex;align-items:center"></span>
        </div>
      </div>
    `;
  }

  function _bindEvents(container) {
    // Save
    container.querySelector('#btn-save-settings')?.addEventListener('click', _save);

    // Test API
    container.querySelector('#btn-test-api')?.addEventListener('click', async () => {
      const url = document.getElementById('s-api-url').value.trim();
      if (!url) { Utils.toast('Enter API URL first', 'warning'); return; }
      API.setBaseUrl(url);
      const resultEl = document.getElementById('api-test-result');
      resultEl.textContent = 'Testing...';
      try {
        // Try a simple request that should return 401 (not 404)
        const testUrl = new URL(url);
        testUrl.searchParams.set('action', 'validateToken');
        testUrl.searchParams.set('token', 'test');
        const resp = await fetch(testUrl.toString());
        const json = await resp.json();
        // Even an error response means the API is reachable
        resultEl.textContent = '✅ API reachable!';
        resultEl.style.color = 'var(--color-success)';
      } catch(e) {
        resultEl.textContent = '❌ Cannot reach API: ' + e.message;
        resultEl.style.color = 'var(--color-danger)';
      }
    });

    // Cache management
    container.querySelector('#btn-clear-cache')?.addEventListener('click', async () => {
      await DB.products.clear();
      await DB.categories.clear();
      Utils.toast('Cache cleared', 'success');
    });

    container.querySelector('#btn-sync-now')?.addEventListener('click', async () => {
      await Sync.syncPendingSales();
      const count = await Sync.getPendingCount();
      document.getElementById('pending-count').textContent = count + ' pending';
    });

    // Load pending count
    Sync.getPendingCount().then(count => {
      const el = document.getElementById('pending-count');
      if (el) el.textContent = count ? `${count} sales pending sync` : 'No pending sales';
    });
  }

  async function _save() {
    const apiUrl = document.getElementById('s-api-url').value.trim();
    if (apiUrl) API.setBaseUrl(apiUrl);

    const btn = document.querySelector('#btn-save-settings');
    if (btn) { btn.disabled = true; btn.textContent = I18n.t('loading'); }

    const updates = {
      store_name:      document.getElementById('s-store-name').value.trim(),
      store_address:   document.getElementById('s-address').value.trim(),
      store_phone:     document.getElementById('s-phone').value.trim(),
      store_logo_url:  document.getElementById('s-logo').value.trim(),
      tax_rate:        document.getElementById('s-tax-rate').value,
      tax_label:       document.getElementById('s-tax-label').value.trim(),
      currency_symbol: document.getElementById('s-currency').value.trim(),
      currency_code:   document.getElementById('s-currency-code').value.trim(),
      receipt_width:   document.getElementById('s-receipt-width').value,
      receipt_footer:  document.getElementById('s-receipt-footer').value.trim(),
      low_stock_default: document.getElementById('s-low-stock').value,
      default_language: document.getElementById('s-lang').value,
      barcode_prefix:  document.getElementById('s-barcode-prefix').value.trim(),
    };

    try {
      // Save each setting
      for (const [key, value] of Object.entries(updates)) {
        await API.settings.update(key, value);
      }
      // Update local cache
      AppState.set('settings', { ...AppState.get('settings'), ...updates });
      await DB.settings.saveAll(updates);

      // Apply language if changed
      if (updates.default_language) I18n.setLanguage(updates.default_language);

      // Update store name in UI
      if (updates.store_name) {
        document.getElementById('sidebar-store-name').textContent = updates.store_name;
        document.title = updates.store_name + ' - POS';
      }

      Utils.toast(I18n.t('settings_saved'), 'success');
    } catch(e) {
      Utils.toast(e.message, 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = '💾 ' + I18n.t('save_settings'); }
    }
  }

  function destroy() {}
  return { render, destroy };
})();
