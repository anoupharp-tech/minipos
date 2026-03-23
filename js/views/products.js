/**
 * MiniPOS - views/products.js
 * Product management: list, add, edit, delete
 */
'use strict';

const ProductsView = (() => {
  let _products = [];
  let _categories = [];
  let _searchQuery = '';
  let _filterCategoryId = 'all';

  async function render(container) {
    container.innerHTML = `<div class="loading-screen"><div class="spinner"></div></div>`;
    await _loadData();
    container.innerHTML = _html();
    _bindEvents(container);
    _renderTable();
  }

  async function _loadData() {
    try {
      [_products, _categories] = await Promise.all([
        API.products.list(),
        API.categories.list(),
      ]);
      AppState.set('products', _products);
      AppState.set('categories', _categories);
    } catch(e) {
      _products = AppState.get('products') || [];
      _categories = AppState.get('categories') || [];
    }
  }

  function _html() {
    const catOptions = _categories.map(c =>
      `<option value="${c.category_id}">${Utils.escapeHtml(Utils.categoryName(c))}</option>`
    ).join('');
    return `
      <div class="section-header">
        <h2 class="section-title" data-i18n="products">Products</h2>
        <button class="btn btn-primary" id="btn-add-product">+ ${I18n.t('add_product')}</button>
      </div>
      <div class="filter-bar">
        <div class="search-box">
          <input type="text" id="product-search" placeholder="${I18n.t('search')}" value="${Utils.escapeHtml(_searchQuery)}">
        </div>
        <select class="filter-select" id="filter-category">
          <option value="all">${I18n.t('all')}</option>
          ${catOptions}
        </select>
        <button class="btn btn-ghost" id="btn-refresh-products">🔄 ${I18n.t('refresh')}</button>
      </div>
      <div class="table-wrap">
        <table id="products-table">
          <thead>
            <tr>
              <th></th>
              <th>${I18n.t('name')}</th>
              <th>${I18n.t('category')}</th>
              <th>${I18n.t('barcode')}</th>
              <th>${I18n.t('cost_price')}</th>
              <th>${I18n.t('sale_price')}</th>
              <th>${I18n.t('stock_qty')}</th>
              <th>${I18n.t('status')}</th>
              <th>${I18n.t('actions')}</th>
            </tr>
          </thead>
          <tbody id="products-tbody"></tbody>
        </table>
      </div>
    `;
  }

  function _bindEvents(container) {
    container.querySelector('#btn-add-product')?.addEventListener('click', () => _openForm(null));
    container.querySelector('#btn-refresh-products')?.addEventListener('click', async () => {
      await _loadData(); _renderTable();
    });
    container.querySelector('#product-search')?.addEventListener('input', (e) => {
      _searchQuery = e.target.value.toLowerCase();
      _renderTable();
    });
    container.querySelector('#filter-category')?.addEventListener('change', (e) => {
      _filterCategoryId = e.target.value;
      _renderTable();
    });
    container.querySelector('#products-tbody')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const { action, productId } = btn.dataset;
      if (action === 'edit') _openForm(_products.find(p => p.product_id === productId));
      if (action === 'delete') _deleteProduct(productId);
    });
  }

  function _renderTable() {
    const tbody = document.getElementById('products-tbody');
    if (!tbody) return;

    let filtered = _products;
    if (_searchQuery) filtered = filtered.filter(p =>
      (p.name_en + p.name_lo + p.name_th + p.name_zh + p.barcode).toLowerCase().includes(_searchQuery)
    );
    if (_filterCategoryId !== 'all') filtered = filtered.filter(p => p.category_id === _filterCategoryId);

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9"><div class="empty-state"><div class="empty-state-icon">📦</div><div>${I18n.t('no_products')}</div></div></td></tr>`;
      return;
    }

    const catMap = Object.fromEntries(_categories.map(c => [c.category_id, c]));

    tbody.innerHTML = filtered.map(p => {
      const cat = catMap[p.category_id];
      const isActive = p.is_active !== false && p.is_active !== 'FALSE';
      const lowStock = p.stock_qty <= (p.low_stock_threshold || 10) && p.stock_qty > 0;
      const noStock  = p.stock_qty <= 0;
      return `
        <tr>
          <td><img class="product-img" src="${p.image_url || 'assets/images/product-placeholder.png'}" alt="" loading="lazy" onerror="this.src='assets/images/product-placeholder.png'"></td>
          <td><strong>${Utils.escapeHtml(Utils.productName(p))}</strong></td>
          <td>${cat ? `<span class="badge badge-primary">${Utils.escapeHtml(Utils.categoryName(cat))}</span>` : '—'}</td>
          <td><code>${Utils.escapeHtml(p.barcode || '—')}</code></td>
          <td>${Utils.formatCurrency(p.cost_price)}</td>
          <td><strong>${Utils.formatCurrency(p.sale_price)}</strong></td>
          <td><span class="${noStock ? 'text-danger font-bold' : lowStock ? 'text-warning font-bold' : ''}">${p.stock_qty}</span></td>
          <td><span class="badge ${isActive ? 'badge-success' : 'badge-gray'}">${isActive ? I18n.t('active') : I18n.t('inactive')}</span></td>
          <td class="td-actions">
            <button class="btn btn-ghost btn-sm" data-action="edit" data-product-id="${p.product_id}">✏️ ${I18n.t('edit')}</button>
            ${Auth.isAdmin() ? `<button class="btn btn-danger btn-sm" data-action="delete" data-product-id="${p.product_id}">🗑 ${I18n.t('delete')}</button>` : ''}
          </td>
        </tr>
      `;
    }).join('');
  }

  function _openForm(product) {
    const isEdit = !!product;
    const catOptions = _categories.map(c =>
      `<option value="${c.category_id}" ${product?.category_id === c.category_id ? 'selected' : ''}>${Utils.escapeHtml(Utils.categoryName(c))}</option>`
    ).join('');

    const body = Utils.openModal(
      I18n.t(isEdit ? 'edit_product' : 'add_product'),
      `
        <div class="product-form form-grid" style="gap:12px">
          <div class="image-upload-wrap">
            <div class="image-preview" id="product-img-preview">
              ${product?.image_url ? `<img src="${product.image_url}" alt="">` : '📷'}
            </div>
            <div>
              <label class="btn btn-ghost btn-sm image-upload-btn" style="cursor:pointer">
                ${I18n.t('upload_image')} <input type="file" id="product-image-file" accept="image/*">
              </label>
              <div class="form-hint mt-2">Max 400x400px. Stored in Google Drive.</div>
            </div>
          </div>
          <div class="form-grid form-grid-2">
            <div class="form-group">
              <label class="required">${I18n.t('product_name_en')}</label>
              <input type="text" class="form-control" id="p-name-en" value="${Utils.escapeHtml(product?.name_en || '')}">
            </div>
            <div class="form-group">
              <label>${I18n.t('product_name_lo')}</label>
              <input type="text" class="form-control" id="p-name-lo" value="${Utils.escapeHtml(product?.name_lo || '')}">
            </div>
            <div class="form-group">
              <label>${I18n.t('product_name_th')}</label>
              <input type="text" class="form-control" id="p-name-th" value="${Utils.escapeHtml(product?.name_th || '')}">
            </div>
            <div class="form-group">
              <label>${I18n.t('product_name_zh')}</label>
              <input type="text" class="form-control" id="p-name-zh" value="${Utils.escapeHtml(product?.name_zh || '')}">
            </div>
          </div>
          <div class="form-grid form-grid-2">
            <div class="form-group">
              <label>${I18n.t('category')}</label>
              <select class="form-control" id="p-category"><option value="">${I18n.t('select_category')}</option>${catOptions}</select>
            </div>
            <div class="form-group">
              <label>${I18n.t('barcode')}</label>
              <div class="input-group">
                <input type="text" class="form-control" id="p-barcode" value="${Utils.escapeHtml(product?.barcode || '')}">
                <button class="btn btn-ghost btn-sm input-addon input-addon-right" id="btn-gen-barcode">${I18n.t('generate_barcode')}</button>
              </div>
            </div>
            <div class="form-group">
              <label class="required">${I18n.t('cost_price')}</label>
              <input type="number" class="form-control" id="p-cost" value="${product?.cost_price || ''}" min="0" step="0.01">
            </div>
            <div class="form-group">
              <label class="required">${I18n.t('sale_price')}</label>
              <input type="number" class="form-control" id="p-sale" value="${product?.sale_price || ''}" min="0" step="0.01">
            </div>
            <div class="form-group">
              <label>${I18n.t('stock_qty')}</label>
              <input type="number" class="form-control" id="p-stock" value="${product?.stock_qty ?? 0}" min="0">
            </div>
            <div class="form-group">
              <label>${I18n.t('low_stock_threshold')}</label>
              <input type="number" class="form-control" id="p-low-stock" value="${product?.low_stock_threshold || 10}" min="0">
            </div>
          </div>
          <div class="form-group">
            <label class="toggle-wrap">
              <label class="toggle"><input type="checkbox" id="p-active" ${(product?.is_active !== false && product?.is_active !== 'FALSE') ? 'checked' : ''}><span class="toggle-slider"></span></label>
              <span class="toggle-label">${I18n.t('active')}</span>
            </label>
          </div>
        </div>
      `,
      `
        <button class="btn btn-ghost" id="modal-cancel-btn">${I18n.t('cancel')}</button>
        <button class="btn btn-primary" id="modal-save-btn">${I18n.t('save')}</button>
      `
    );

    document.getElementById('modal-cancel-btn')?.addEventListener('click', Utils.closeModal);
    document.getElementById('modal-close-btn')?.addEventListener('click', Utils.closeModal);

    // Image preview
    document.getElementById('product-image-file')?.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const dataUrl = await Utils.resizeImage(file);
      const preview = document.getElementById('product-img-preview');
      preview.innerHTML = `<img src="${dataUrl}">`;
      preview.dataset.dataUrl = dataUrl;
    });

    // Generate barcode
    document.getElementById('btn-gen-barcode')?.addEventListener('click', async () => {
      try {
        const result = await API.barcodes.getNext('CODE128');
        document.getElementById('p-barcode').value = result.barcode_value;
      } catch(e) {
        // Fallback: generate locally
        document.getElementById('p-barcode').value = 'BC' + Date.now().toString().slice(-8);
      }
    });

    // Save
    document.getElementById('modal-save-btn')?.addEventListener('click', async () => {
      const nameEn = document.getElementById('p-name-en').value.trim();
      if (!nameEn) { Utils.toast('Product name (English) is required', 'error'); return; }

      const btn = document.getElementById('modal-save-btn');
      btn.disabled = true; btn.textContent = I18n.t('loading');

      const payload = {
        ...(isEdit ? { product_id: product.product_id } : {}),
        name_en: nameEn,
        name_lo: document.getElementById('p-name-lo').value.trim(),
        name_th: document.getElementById('p-name-th').value.trim(),
        name_zh: document.getElementById('p-name-zh').value.trim(),
        category_id: document.getElementById('p-category').value,
        barcode: document.getElementById('p-barcode').value.trim(),
        cost_price: parseFloat(document.getElementById('p-cost').value) || 0,
        sale_price: parseFloat(document.getElementById('p-sale').value) || 0,
        stock_qty: parseInt(document.getElementById('p-stock').value) || 0,
        low_stock_threshold: parseInt(document.getElementById('p-low-stock').value) || 10,
        is_active: document.getElementById('p-active').checked,
      };

      // Image upload
      const imgPreview = document.getElementById('product-img-preview');
      const dataUrl = imgPreview?.dataset.dataUrl;
      if (dataUrl) payload.image_base64 = dataUrl;

      try {
        if (isEdit) await API.products.update(payload);
        else await API.products.create(payload);
        Utils.toast(I18n.t('product_saved'), 'success');
        Utils.closeModal();
        await _loadData();
        _renderTable();
      } catch(e) {
        Utils.toast(e.message, 'error');
        btn.disabled = false; btn.textContent = I18n.t('save');
      }
    });
  }

  async function _deleteProduct(productId) {
    const product = _products.find(p => p.product_id === productId);
    const ok = await Utils.confirm(
      I18n.t('confirm_delete_product'),
      I18n.t('delete_product'),
      I18n.t('delete')
    );
    if (!ok) return;
    try {
      await API.products.delete(productId);
      Utils.toast(I18n.t('product_deleted'), 'success');
      await _loadData();
      _renderTable();
    } catch(e) {
      Utils.toast(e.message, 'error');
    }
  }

  function destroy() {}
  return { render, destroy };
})();
