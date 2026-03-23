/**
 * MiniPOS - views/pos.js
 * Main Point of Sale view
 * Features: product grid, cart, barcode scan, discount, payment, receipt
 */
'use strict';

const PosView = (() => {
  let _cart = [];
  let _products = [];
  let _categories = [];
  let _settings = {};
  let _activeCategoryId = 'all';
  let _searchQuery = '';
  let _discountType = 'percent'; // 'percent' | 'amount'
  let _discountValue = 0;
  let _barcodeListener = null;
  let _searchDebounce = null;

  async function render(container) {
    _settings = AppState.get('settings') || {};
    _products  = AppState.get('products') || [];
    _categories = AppState.get('categories') || [];
    _cart = [];

    container.innerHTML = _html();
    _bindEvents();
    _renderCategories();
    _renderProducts();
    _renderCart();

    // Start USB scanner
    Scanner.initUSB();

    // Listen for barcode events
    _barcodeListener = (e) => _handleBarcode(e.detail.barcode);
    document.addEventListener('barcode:detected', _barcodeListener);

    // Update state subscription
    AppState.on('products', (prods) => { _products = prods; _renderProducts(); });
    AppState.on('categories', (cats) => { _categories = cats; _renderCategories(); });
  }

  function _html() {
    return `
      <div class="pos-layout">
        <!-- Product Panel -->
        <div class="product-panel">
          <div class="product-search-bar">
            <div class="search-box">
              <input type="text" id="pos-search-input"
                data-i18n-placeholder="search_products"
                placeholder="Search products or scan barcode..."
                autocomplete="off" inputmode="search">
            </div>
            <button class="btn-camera-scan" id="btn-camera-scan" title="Scan with camera">📷</button>
          </div>
          <div class="category-tabs" id="pos-category-tabs"></div>
          <div class="product-grid" id="pos-product-grid">
            <div class="loading-screen"><div class="spinner"></div></div>
          </div>
        </div>

        <!-- Cart Panel -->
        <div class="cart-panel">
          <div class="cart-header">
            <div class="cart-title">
              🛒 ${I18n.t('cart')} <span class="cart-count" id="cart-count">0</span>
            </div>
            <button class="btn-clear-cart" id="btn-clear-cart">${I18n.t('clear_cart')}</button>
          </div>

          <div class="cart-items" id="cart-items">
            <div class="cart-empty">
              <div class="cart-empty-icon">🛒</div>
              <span>${I18n.t('add_to_cart')}</span>
            </div>
          </div>

          <div class="cart-summary">
            <div class="summary-row">
              <span>${I18n.t('subtotal')}</span>
              <span id="cart-subtotal">--</span>
            </div>

            <!-- Discount -->
            <div class="discount-row">
              <div class="discount-type-toggle">
                <button class="discount-type-btn active" data-type="percent">%</button>
                <button class="discount-type-btn" data-type="amount">${I18n.t('discount_amount')}</button>
              </div>
              <input type="number" class="discount-input" id="discount-input"
                placeholder="0" min="0" step="0.01" value="0">
            </div>

            <div class="summary-row discount" id="discount-row" style="display:none">
              <span>${I18n.t('discount')}</span>
              <span id="cart-discount">--</span>
            </div>
            <div class="summary-row" id="tax-row" style="display:none">
              <span id="tax-label-text">${_settings.tax_label || 'Tax'} (${_settings.tax_rate || 0}%)</span>
              <span id="cart-tax">--</span>
            </div>
            <div class="summary-row total">
              <span>${I18n.t('total')}</span>
              <span id="cart-total">--</span>
            </div>

            <!-- Payment buttons -->
            <div class="payment-buttons">
              <button class="pay-btn pay-btn-cash" data-payment="cash">
                <span class="pay-btn-icon">💵</span>
                <span>${I18n.t('pay_cash')}</span>
              </button>
              <button class="pay-btn pay-btn-bank" data-payment="bank_transfer">
                <span class="pay-btn-icon">🏦</span>
                <span>${I18n.t('pay_bank')}</span>
              </button>
              <button class="pay-btn pay-btn-qr" data-payment="qr">
                <span class="pay-btn-icon">📱</span>
                <span>${I18n.t('pay_qr')}</span>
              </button>
              <button class="pay-btn pay-btn-card" data-payment="card">
                <span class="pay-btn-icon">💳</span>
                <span>${I18n.t('pay_card')}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function _bindEvents() {
    // Search input
    const searchInput = document.getElementById('pos-search-input');
    searchInput?.addEventListener('input', (e) => {
      clearTimeout(_searchDebounce);
      _searchDebounce = setTimeout(() => {
        _searchQuery = e.target.value.trim().toLowerCase();
        _renderProducts();
      }, 200);
    });

    // Camera scan button
    document.getElementById('btn-camera-scan')?.addEventListener('click', () => {
      Scanner.openCameraModal();
    });

    // Clear cart
    document.getElementById('btn-clear-cart')?.addEventListener('click', async () => {
      if (_cart.length === 0) return;
      const ok = await Utils.confirm(I18n.t('clear_cart') + '?', '', I18n.t('clear_cart'));
      if (ok) { _cart = []; _renderCart(); _updateTotals(); }
    });

    // Category tabs (delegated)
    document.getElementById('pos-category-tabs')?.addEventListener('click', (e) => {
      const tab = e.target.closest('.cat-tab');
      if (!tab) return;
      _activeCategoryId = tab.dataset.categoryId;
      document.querySelectorAll('.cat-tab').forEach(t => t.classList.toggle('active', t === tab));
      _renderProducts();
    });

    // Product grid click (delegated)
    document.getElementById('pos-product-grid')?.addEventListener('click', (e) => {
      const card = e.target.closest('.product-card');
      if (!card) return;
      _addToCart(card.dataset.productId);
    });

    // Cart item actions (delegated)
    document.getElementById('cart-items')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const { action, productId } = btn.dataset;
      if (action === 'increase') _changeQty(productId, 1);
      if (action === 'decrease') _changeQty(productId, -1);
      if (action === 'remove')   _removeFromCart(productId);
    });

    // Discount type toggle
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.discount-type-btn');
      if (!btn) return;
      document.querySelectorAll('.discount-type-btn').forEach(b => b.classList.toggle('active', b === btn));
      _discountType = btn.dataset.type;
      _updateTotals();
    });

    // Discount input
    document.getElementById('discount-input')?.addEventListener('input', (e) => {
      _discountValue = parseFloat(e.target.value) || 0;
      _updateTotals();
    });

    // Payment buttons
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.pay-btn');
      if (!btn) return;
      if (_cart.length === 0) { Utils.toast(I18n.t('add_to_cart'), 'warning'); return; }
      _openPaymentModal(btn.dataset.payment);
    });
  }

  function _renderCategories() {
    const tabs = document.getElementById('pos-category-tabs');
    if (!tabs) return;

    const allBtn = `<button class="cat-tab ${_activeCategoryId === 'all' ? 'active' : ''}" data-category-id="all">${I18n.t('all_categories')}</button>`;
    const catBtns = (_categories || [])
      .filter(c => c.is_active !== false && c.is_active !== 'FALSE')
      .map(c => `
        <button class="cat-tab ${_activeCategoryId === c.category_id ? 'active' : ''}"
          data-category-id="${c.category_id}">
          ${c.icon || ''} ${Utils.escapeHtml(Utils.categoryName(c))}
        </button>
      `).join('');

    tabs.innerHTML = allBtn + catBtns;
  }

  function _renderProducts() {
    const grid = document.getElementById('pos-product-grid');
    if (!grid) return;

    let filtered = (_products || []).filter(p => p.is_active !== false && p.is_active !== 'FALSE');

    // Category filter
    if (_activeCategoryId !== 'all') {
      filtered = filtered.filter(p => p.category_id === _activeCategoryId);
    }

    // Search filter
    if (_searchQuery) {
      filtered = filtered.filter(p => {
        const name = (p.name_en + ' ' + p.name_lo + ' ' + p.name_th + ' ' + p.name_zh + ' ' + p.barcode).toLowerCase();
        return name.includes(_searchQuery);
      });
    }

    if (filtered.length === 0) {
      grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="empty-state-icon">📦</div><div>${I18n.t('no_products')}</div></div>`;
      return;
    }

    const settings = _settings;
    const lowThreshold = parseInt(settings.low_stock_default || 10);

    grid.innerHTML = filtered.map(p => {
      const outOfStock = p.stock_qty <= 0;
      const lowStock = !outOfStock && p.stock_qty <= (p.low_stock_threshold || lowThreshold);
      const img = p.image_url ? `<img class="product-card-img" src="${p.image_url}" alt="" loading="lazy" onerror="this.src='assets/images/product-placeholder.png'">` : `<div class="product-card-img" style="display:flex;align-items:center;justify-content:center;font-size:32px;">📦</div>`;
      const stockClass = outOfStock ? 'out' : (lowStock ? 'low' : '');
      const stockText = outOfStock ? I18n.t('out_of_stock') : (lowStock ? I18n.t('low_stock') + ': ' + p.stock_qty : p.stock_qty);

      return `
        <div class="product-card ${outOfStock ? 'out-of-stock' : ''}"
          data-product-id="${p.product_id}"
          title="${Utils.escapeHtml(Utils.productName(p))}">
          ${outOfStock ? '<div class="out-badge">OUT</div>' : ''}
          ${img}
          <div class="product-card-body">
            <div class="product-card-name">${Utils.escapeHtml(Utils.productName(p))}</div>
            <div class="product-card-price">${Utils.formatCurrency(p.sale_price)}</div>
            <div class="product-card-stock ${stockClass}">${stockText}</div>
          </div>
        </div>
      `;
    }).join('');
  }

  function _addToCart(productId) {
    const product = _products.find(p => p.product_id === productId);
    if (!product) return;
    if (product.stock_qty <= 0) { Utils.toast(I18n.t('out_of_stock'), 'warning'); return; }

    const existing = _cart.find(item => item.product_id === productId);
    if (existing) {
      if (existing.qty >= product.stock_qty) {
        Utils.toast(I18n.t('out_of_stock'), 'warning');
        return;
      }
      existing.qty++;
    } else {
      _cart.push({
        product_id: product.product_id,
        name: Utils.productName(product),
        unit_price: parseFloat(product.sale_price),
        cost_price: parseFloat(product.cost_price),
        qty: 1,
        max_qty: product.stock_qty,
      });
    }
    _renderCart();
    _updateTotals();
  }

  function _changeQty(productId, delta) {
    const item = _cart.find(i => i.product_id === productId);
    if (!item) return;
    item.qty = Math.max(0, item.qty + delta);
    if (item.qty === 0) {
      _removeFromCart(productId);
      return;
    }
    _renderCart();
    _updateTotals();
  }

  function _removeFromCart(productId) {
    _cart = _cart.filter(i => i.product_id !== productId);
    _renderCart();
    _updateTotals();
  }

  function _renderCart() {
    const container = document.getElementById('cart-items');
    const countEl   = document.getElementById('cart-count');
    if (!container) return;

    const totalItems = _cart.reduce((s, i) => s + i.qty, 0);
    if (countEl) countEl.textContent = totalItems;

    if (_cart.length === 0) {
      container.innerHTML = `
        <div class="cart-empty">
          <div class="cart-empty-icon">🛒</div>
          <span>${I18n.t('add_to_cart')}</span>
        </div>
      `;
      return;
    }

    container.innerHTML = _cart.map(item => `
      <div class="cart-item">
        <div class="cart-item-info">
          <div class="cart-item-name">${Utils.escapeHtml(item.name)}</div>
          <div class="cart-item-price">${Utils.formatCurrency(item.unit_price)}</div>
        </div>
        <div class="cart-item-controls">
          <button class="qty-btn qty-btn-minus" data-action="decrease" data-product-id="${item.product_id}">−</button>
          <span class="cart-item-qty">${item.qty}</span>
          <button class="qty-btn qty-btn-plus" data-action="increase" data-product-id="${item.product_id}">+</button>
        </div>
        <div class="cart-item-total">${Utils.formatCurrency(item.qty * item.unit_price)}</div>
        <button class="btn-remove-item" data-action="remove" data-product-id="${item.product_id}">✕</button>
      </div>
    `).join('');
  }

  function _calcTotals() {
    const subtotal = _cart.reduce((s, i) => s + i.qty * i.unit_price, 0);
    const taxRate  = parseFloat(_settings.tax_rate || 0);

    let discountAmount = 0;
    if (_discountValue > 0) {
      discountAmount = _discountType === 'percent'
        ? subtotal * (_discountValue / 100)
        : _discountValue;
      discountAmount = Math.min(discountAmount, subtotal); // Can't exceed subtotal
    }

    const afterDiscount = subtotal - discountAmount;
    const taxAmount = afterDiscount * (taxRate / 100);
    const total = afterDiscount + taxAmount;

    return { subtotal, discountAmount, taxRate, taxAmount, total };
  }

  function _updateTotals() {
    const { subtotal, discountAmount, taxRate, taxAmount, total } = _calcTotals();

    document.getElementById('cart-subtotal').textContent = Utils.formatCurrency(subtotal);

    const discountRow = document.getElementById('discount-row');
    if (discountAmount > 0) {
      discountRow.style.display = '';
      document.getElementById('cart-discount').textContent = '- ' + Utils.formatCurrency(discountAmount);
    } else {
      discountRow.style.display = 'none';
    }

    const taxRow = document.getElementById('tax-row');
    if (taxRate > 0) {
      taxRow.style.display = '';
      document.getElementById('cart-tax').textContent = Utils.formatCurrency(taxAmount);
    } else {
      taxRow.style.display = 'none';
    }

    document.getElementById('cart-total').textContent = Utils.formatCurrency(total);

    // Enable/disable payment buttons
    const hasItems = _cart.length > 0;
    document.querySelectorAll('.pay-btn').forEach(btn => btn.disabled = !hasItems);
  }

  function _handleBarcode(barcode) {
    // Find product by barcode
    const product = _products.find(p => p.barcode === barcode);
    if (product) {
      _addToCart(product.product_id);
      Utils.toast(Utils.productName(product), 'success', 1500);
    } else {
      // Optionally: try to look up from API
      Utils.toast('Barcode not found: ' + barcode, 'warning');
    }
    // Clear search
    const searchInput = document.getElementById('pos-search-input');
    if (searchInput) searchInput.value = '';
  }

  function _openPaymentModal(paymentType) {
    const { subtotal, discountAmount, taxAmount, total } = _calcTotals();
    const modal = document.getElementById('payment-modal');
    const body  = document.getElementById('payment-modal-body');
    if (!modal || !body) return;

    const payIcons = { cash: '💵', bank_transfer: '🏦', qr: '📱', card: '💳' };
    const payLabels = {
      cash: I18n.t('pay_cash'), bank_transfer: I18n.t('pay_bank'),
      qr: I18n.t('pay_qr'), card: I18n.t('pay_card')
    };

    body.innerHTML = `
      <div class="payment-summary">
        <div class="summary-row"><span>${I18n.t('subtotal')}</span><span>${Utils.formatCurrency(subtotal)}</span></div>
        ${discountAmount > 0 ? `<div class="summary-row discount"><span>${I18n.t('discount')}</span><span>-${Utils.formatCurrency(discountAmount)}</span></div>` : ''}
        ${taxAmount > 0 ? `<div class="summary-row"><span>${I18n.t('tax')}</span><span>${Utils.formatCurrency(taxAmount)}</span></div>` : ''}
        <div class="summary-row total"><span>${I18n.t('total')}</span><span>${Utils.formatCurrency(total)}</span></div>
      </div>

      <!-- Payment type selection -->
      <div class="payment-type-select" id="payment-type-select">
        ${['cash', 'bank_transfer', 'qr', 'card'].map(t => `
          <button class="ptype-btn ${t === paymentType ? 'active' : ''}" data-ptype="${t}">
            <span class="ptype-btn-icon">${payIcons[t]}</span>
            <span>${payLabels[t]}</span>
          </button>
        `).join('')}
      </div>

      <!-- Cash numpad (visible for cash only) -->
      <div id="cash-section" style="${paymentType !== 'cash' ? 'display:none' : ''}">
        <div class="numpad-received">
          <label>${I18n.t('received')}</label>
          <input type="number" id="received-amount" value="${Math.ceil(total)}" min="${total}" step="1">
        </div>
        <div class="numpad-grid" id="numpad-grid">
          ${[1,2,3,4,5,6,7,8,9,'00',0,'⌫'].map(k => `
            <button class="numpad-key ${k === '⌫' ? 'numpad-key-del' : ''}" data-key="${k}">${k}</button>
          `).join('')}
        </div>
        <div class="numpad-key numpad-key-exact" id="btn-exact" style="width:100%;display:block;margin-bottom:8px"
          onclick="document.getElementById('received-amount').value=${Math.ceil(total)};PosView._updateChange(${total})">
          ${I18n.t('exact')}: ${Utils.formatCurrency(Math.ceil(total))}
        </div>
        <div class="change-display" id="change-display">
          <span class="change-label">${I18n.t('change')}</span>
          <span class="change-amount" id="change-amount">${Utils.formatCurrency(Math.ceil(total) - total)}</span>
        </div>
      </div>

      <button class="btn btn-success btn-lg btn-full" id="btn-complete-sale">${I18n.t('complete_sale')}</button>
    `;

    modal.classList.remove('hidden');
    let currentPayment = paymentType;

    // Payment type switch
    body.querySelector('#payment-type-select')?.addEventListener('click', (e) => {
      const btn = e.target.closest('.ptype-btn');
      if (!btn) return;
      currentPayment = btn.dataset.ptype;
      body.querySelectorAll('.ptype-btn').forEach(b => b.classList.toggle('active', b === btn));
      body.querySelector('#cash-section').style.display = currentPayment === 'cash' ? '' : 'none';
    });

    // Numpad keys
    body.querySelector('#numpad-grid')?.addEventListener('click', (e) => {
      const key = e.target.dataset.key;
      if (key === undefined) return;
      const inp = document.getElementById('received-amount');
      if (key === '⌫') {
        inp.value = inp.value.slice(0, -1) || '0';
      } else {
        inp.value = inp.value === '0' ? key : inp.value + key;
      }
      _updateChange(total);
    });

    document.getElementById('received-amount')?.addEventListener('input', () => _updateChange(total));

    // Complete sale
    body.querySelector('#btn-complete-sale')?.addEventListener('click', () => {
      _completeSale(currentPayment, total, subtotal, discountAmount, taxAmount);
    });

    modal.classList.remove('hidden');
  }

  function _updateChange(total) {
    const received = parseFloat(document.getElementById('received-amount')?.value || 0);
    const change = Math.max(0, received - total);
    const el = document.getElementById('change-amount');
    if (el) el.textContent = Utils.formatCurrency(change);
  }

  async function _completeSale(paymentType, total, subtotal, discountAmount, taxAmount) {
    const receivedAmount = paymentType === 'cash'
      ? parseFloat(document.getElementById('received-amount')?.value || total)
      : total;

    if (paymentType === 'cash' && receivedAmount < total) {
      Utils.toast('Received amount is less than total', 'error');
      return;
    }

    const btn = document.getElementById('btn-complete-sale');
    if (btn) { btn.disabled = true; btn.textContent = I18n.t('loading'); }

    const saleData = {
      items: _cart.map(item => ({
        product_id: item.product_id,
        name: item.name,
        qty: item.qty,
        unit_price: item.unit_price,
        cost_price: item.cost_price,
      })),
      subtotal,
      discount_type: _discountType,
      discount_value: _discountValue,
      discount_amount: discountAmount,
      tax_rate: parseFloat(_settings.tax_rate || 0),
      tax_amount: taxAmount,
      total,
      payment_type: paymentType,
      received_amount: receivedAmount,
      change_amount: Math.max(0, receivedAmount - total),
      cashier_name: Auth.getUser()?.display_name || Auth.getUser()?.username || '',
    };

    let result;
    try {
      if (!navigator.onLine) throw new Error('OFFLINE');
      result = await API.sales.create(saleData);

      // Deduct stock locally
      _cart.forEach(item => {
        const prod = _products.find(p => p.product_id === item.product_id);
        if (prod) prod.stock_qty = Math.max(0, prod.stock_qty - item.qty);
      });

      Utils.toast('Sale completed!', 'success');
    } catch(e) {
      if (!navigator.onLine || e.message === 'OFFLINE' || e.message === 'Failed to fetch') {
        // Queue for sync
        saleData.sale_date = new Date().toISOString();
        await Sync.enqueueSale(saleData);
        result = { ...saleData, sale_id: Utils.uuid() };
        Utils.toast('Sale saved offline — will sync when connected', 'warning');
      } else {
        Utils.toast('Sale failed: ' + e.message, 'error');
        if (btn) { btn.disabled = false; btn.textContent = I18n.t('complete_sale'); }
        return;
      }
    }

    // Close payment modal
    document.getElementById('payment-modal')?.classList.add('hidden');

    // Show receipt
    const receiptData = {
      ...saleData,
      sale_id: result?.sale_id || Utils.uuid(),
      sale_date: result?.sale_date || new Date().toISOString(),
    };
    Receipt.showModal(receiptData, _settings);

    // Wire receipt modal buttons
    document.getElementById('receipt-print-btn').onclick = () => Receipt.printBrowser(receiptData, _settings);
    document.getElementById('receipt-new-sale-btn').onclick = () => {
      document.getElementById('receipt-modal')?.classList.add('hidden');
      _resetSale();
    };
    document.getElementById('receipt-modal-close').onclick = () => {
      document.getElementById('receipt-modal')?.classList.add('hidden');
      _resetSale();
    };
  }

  function _resetSale() {
    _cart = [];
    _discountValue = 0;
    _discountType = 'percent';
    const inp = document.getElementById('discount-input');
    if (inp) inp.value = 0;
    document.querySelectorAll('.discount-type-btn').forEach((b, i) => b.classList.toggle('active', i === 0));
    _renderCart();
    _updateTotals();
    _renderProducts(); // Refresh stock display
  }

  // Exposed for inline onclick
  function _updateChangePub(total) { _updateChange(total); }

  function destroy() {
    if (_barcodeListener) {
      document.removeEventListener('barcode:detected', _barcodeListener);
      _barcodeListener = null;
    }
    clearTimeout(_searchDebounce);
  }

  return { render, destroy, _updateChange: _updateChangePub };
})();
