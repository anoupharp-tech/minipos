/**
 * MiniPOS - views/stock.js
 * Stock management: history, manual adjust, low-stock alerts
 */
'use strict';

const StockView = (() => {
  let _history = [];
  let _products = [];
  let _lowStock = [];
  let _tab = 'history'; // 'history' | 'adjust' | 'alerts'

  async function render(container) {
    container.innerHTML = `<div class="loading-screen"><div class="spinner"></div></div>`;
    await _loadData();
    container.innerHTML = _html();
    _bindEvents(container);
    _renderTab();
  }

  async function _loadData() {
    try {
      [_products, _lowStock, _history] = await Promise.all([
        API.products.list(),
        API.stock.lowStock(),
        API.stock.history({ limit: 100 }),
      ]);
      AppState.set('products', _products);
      AppState.set('lowStockCount', _lowStock.length);
      _updateLowStockBadge();
    } catch(e) {
      _products = AppState.get('products') || [];
      _history = [];
      _lowStock = [];
    }
  }

  function _updateLowStockBadge() {
    const count = _lowStock.length;
    const btn = document.getElementById('low-stock-alert');
    const el  = document.getElementById('low-stock-count');
    if (btn && el) {
      btn.classList.toggle('hidden', count === 0);
      el.textContent = count;
    }
  }

  function _html() {
    return `
      <div class="section-header">
        <h2 class="section-title" data-i18n="stock">Stock</h2>
        <div class="flex gap-2">
          <button class="btn btn-outline" id="btn-tab-history" data-tab="history">${I18n.t('stock_history')}</button>
          <button class="btn btn-primary" id="btn-tab-adjust" data-tab="adjust">${I18n.t('add_stock')} / ${I18n.t('remove_stock')}</button>
          <button class="btn btn-warning" id="btn-tab-alerts" data-tab="alerts">⚠️ ${I18n.t('low_stock_alert')} (${_lowStock.length})</button>
        </div>
      </div>
      <div id="stock-tab-content"></div>
    `;
  }

  function _bindEvents(container) {
    container.querySelector('[id^="btn-tab"]')?.parentElement?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-tab]');
      if (!btn) return;
      _tab = btn.dataset.tab;
      _renderTab();
    });
  }

  function _renderTab() {
    const content = document.getElementById('stock-tab-content');
    if (!content) return;

    // Update button active states
    document.querySelectorAll('[data-tab]').forEach(btn => {
      btn.classList.toggle('btn-primary', btn.dataset.tab === _tab);
      btn.classList.toggle('btn-outline', btn.dataset.tab !== _tab && btn.dataset.tab === 'history');
    });

    if (_tab === 'history') _renderHistory(content);
    if (_tab === 'adjust')  _renderAdjust(content);
    if (_tab === 'alerts')  _renderAlerts(content);
  }

  function _renderHistory(content) {
    const filterHtml = `
      <div class="filter-bar mb-4">
        <select class="filter-select" id="hist-product-filter">
          <option value="">${I18n.t('all')} ${I18n.t('products')}</option>
          ${_products.map(p => `<option value="${p.product_id}">${Utils.escapeHtml(Utils.productName(p))}</option>`).join('')}
        </select>
        <input type="date" class="form-control" id="hist-date-from" style="width:auto">
        <input type="date" class="form-control" id="hist-date-to" style="width:auto" value="${Utils.todayISO()}">
        <button class="btn btn-ghost" id="btn-load-history">🔍 ${I18n.t('filter')}</button>
      </div>
    `;
    const tableHtml = `
      <div class="table-wrap">
        <table>
          <thead><tr>
            <th>${I18n.t('date')}</th>
            <th>${I18n.t('name')}</th>
            <th>${I18n.t('change_type')}</th>
            <th>${I18n.t('qty_before')}</th>
            <th>${I18n.t('qty_change')}</th>
            <th>${I18n.t('qty_after')}</th>
            <th>${I18n.t('note')}</th>
            <th>${I18n.t('performed_by')}</th>
          </tr></thead>
          <tbody id="hist-tbody">
            ${_historyRows()}
          </tbody>
        </table>
      </div>
    `;
    content.innerHTML = filterHtml + tableHtml;

    document.getElementById('btn-load-history')?.addEventListener('click', async () => {
      const pid  = document.getElementById('hist-product-filter').value;
      const from = document.getElementById('hist-date-from').value;
      const to   = document.getElementById('hist-date-to').value;
      try {
        _history = await API.stock.history({ product_id: pid || undefined, date_from: from || undefined, date_to: to || undefined });
        document.getElementById('hist-tbody').innerHTML = _historyRows();
      } catch(e) { Utils.toast(e.message, 'error'); }
    });
  }

  function _historyRows() {
    if (!_history.length) return `<tr><td colspan="8"><div class="empty-state"><div class="empty-state-icon">📊</div><div>${I18n.t('no_data')}</div></div></td></tr>`;
    const typeLabels = { sale: I18n.t('sale'), manual_add: I18n.t('manual_add'), manual_remove: I18n.t('manual_remove'), adjustment: I18n.t('adjustment') };
    return _history.map(h => `
      <tr>
        <td>${Utils.formatDateTime(h.created_at)}</td>
        <td>${Utils.escapeHtml(h.product_name || '')}</td>
        <td><span class="badge ${h.change_type==='sale'?'badge-primary':h.qty_change>0?'badge-success':'badge-danger'}">${typeLabels[h.change_type] || h.change_type}</span></td>
        <td>${h.qty_before}</td>
        <td class="${h.qty_change > 0 ? 'text-success font-bold' : 'text-danger font-bold'}">${h.qty_change > 0 ? '+' : ''}${h.qty_change}</td>
        <td>${h.qty_after}</td>
        <td>${Utils.escapeHtml(h.note || '—')}</td>
        <td>${Utils.escapeHtml(h.performed_by || '—')}</td>
      </tr>
    `).join('');
  }

  function _renderAdjust(content) {
    const productOptions = _products.map(p =>
      `<option value="${p.product_id}">${Utils.escapeHtml(Utils.productName(p))} (${I18n.t('stock_qty')}: ${p.stock_qty})</option>`
    ).join('');

    content.innerHTML = `
      <div class="card" style="max-width:500px">
        <h3 class="font-bold mb-4">${I18n.t('add_stock')} / ${I18n.t('remove_stock')}</h3>
        <div class="form-grid" style="gap:14px">
          <div class="form-group">
            <label class="required">${I18n.t('product')}</label>
            <select class="form-control" id="adj-product">
              <option value="">${I18n.t('select_category')}</option>
              ${productOptions}
            </select>
          </div>
          <div class="form-group">
            <label class="required">${I18n.t('qty_change')}</label>
            <input type="number" class="form-control" id="adj-qty" min="1" value="1">
          </div>
          <div class="form-group">
            <label>${I18n.t('note')}</label>
            <textarea class="form-control" id="adj-note" rows="2"></textarea>
          </div>
          <div style="display:flex;gap:12px">
            <button class="btn btn-success btn-lg" id="btn-adj-add" style="flex:1">
              ➕ ${I18n.t('stock_add')}
            </button>
            <button class="btn btn-danger btn-lg" id="btn-adj-remove" style="flex:1">
              ➖ ${I18n.t('stock_remove')}
            </button>
          </div>
        </div>
      </div>
    `;

    const adjust = async (direction) => {
      const productId = document.getElementById('adj-product').value;
      const qty  = parseInt(document.getElementById('adj-qty').value);
      const note = document.getElementById('adj-note').value.trim();
      if (!productId) { Utils.toast('Select a product', 'error'); return; }
      if (!qty || qty < 1) { Utils.toast('Enter quantity', 'error'); return; }

      try {
        await API.stock.adjust({
          product_id: productId,
          qty_change: direction === 'add' ? qty : -qty,
          note,
        });
        Utils.toast(I18n.t('stock_adjusted'), 'success');
        await _loadData();
        _renderAdjust(content);
      } catch(e) { Utils.toast(e.message, 'error'); }
    };

    document.getElementById('btn-adj-add')?.addEventListener('click', () => adjust('add'));
    document.getElementById('btn-adj-remove')?.addEventListener('click', () => adjust('remove'));
  }

  function _renderAlerts(content) {
    if (!_lowStock.length) {
      content.innerHTML = `<div class="empty-state"><div class="empty-state-icon">✅</div><div>All stock levels are healthy</div></div>`;
      return;
    }
    content.innerHTML = `
      <div class="section-title mb-4">⚠️ ${I18n.t('low_stock_alert')} — ${_lowStock.length} ${I18n.t('low_stock_items')}</div>
      <div class="table-wrap">
        <table>
          <thead><tr>
            <th>${I18n.t('name')}</th>
            <th>${I18n.t('stock_qty')}</th>
            <th>${I18n.t('low_stock_threshold')}</th>
            <th>${I18n.t('actions')}</th>
          </tr></thead>
          <tbody>
            ${_lowStock.map(p => `
              <tr>
                <td>${Utils.escapeHtml(p.product_name || Utils.productName(p))}</td>
                <td class="${p.stock_qty <= 0 ? 'text-danger font-bold' : 'text-warning font-bold'}">${p.stock_qty}</td>
                <td>${p.low_stock_threshold || 10}</td>
                <td>
                  <button class="btn btn-primary btn-sm" onclick="StockView._quickAdd('${p.product_id}')">+ ${I18n.t('stock_add')}</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  async function _quickAdd(productId) {
    const qty = prompt('Quantity to add:', '10');
    if (!qty || isNaN(parseInt(qty))) return;
    try {
      await API.stock.adjust({ product_id: productId, qty_change: parseInt(qty), note: 'Quick add from alert' });
      Utils.toast(I18n.t('stock_adjusted'), 'success');
      await _loadData();
      _renderTab();
    } catch(e) { Utils.toast(e.message, 'error'); }
  }

  function destroy() {}
  return { render, destroy, _quickAdd };
})();
