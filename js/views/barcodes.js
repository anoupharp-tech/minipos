/**
 * MiniPOS - views/barcodes.js
 * Barcode generation, preview, and label printing
 */
'use strict';

const BarcodesView = (() => {
  let _products = [];
  let _barcodeValue = '';
  let _barcodeType = 'CODE128';
  let _printSize = '40x60';
  let _copies = 1;
  let _selectedProduct = null;

  async function render(container) {
    _products = AppState.get('products') || await API.products.list().catch(() => []);
    container.innerHTML = _html();
    _bindEvents(container);
  }

  function _html() {
    const productOptions = _products.map(p =>
      `<option value="${p.product_id}">${Utils.escapeHtml(Utils.productName(p))} — ${p.barcode || 'no barcode'}</option>`
    ).join('');

    return `
      <div class="section-header">
        <h2 class="section-title" data-i18n="barcodes">Barcodes</h2>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;max-width:900px">
        <!-- Generator panel -->
        <div class="card">
          <h3 class="font-bold mb-4">${I18n.t('generate_new')}</h3>
          <div class="form-grid" style="gap:14px">
            <div class="form-group">
              <label>${I18n.t('product')}</label>
              <select class="form-control" id="bc-product-select">
                <option value="">— ${I18n.t('generate_new')} (standalone) —</option>
                ${productOptions}
              </select>
            </div>
            <div class="form-group">
              <label>${I18n.t('barcode_type')}</label>
              <div style="display:flex;gap:8px">
                <button class="size-opt active" data-type="CODE128" id="btn-type-128">CODE128</button>
                <button class="size-opt" data-type="EAN13" id="btn-type-ean">EAN-13</button>
              </div>
            </div>
            <div class="form-group">
              <label>${I18n.t('barcode_value')}</label>
              <div class="input-group">
                <input type="text" class="form-control" id="bc-value" placeholder="Enter or generate">
                <button class="btn btn-ghost btn-sm input-addon input-addon-right" id="btn-generate-bc">${I18n.t('generate_barcode')}</button>
              </div>
            </div>
            <div class="form-group">
              <label>Label Name (optional)</label>
              <input type="text" class="form-control" id="bc-label-name" placeholder="Product name on label">
            </div>
            <div class="form-group">
              <label>${I18n.t('sale_price')} (for label)</label>
              <input type="number" class="form-control" id="bc-price" placeholder="0" min="0">
            </div>
            <button class="btn btn-primary" id="btn-preview-bc">👁 ${I18n.t('barcode_preview')}</button>
          </div>
        </div>

        <!-- Preview + Print panel -->
        <div class="card">
          <h3 class="font-bold mb-4">${I18n.t('barcode_preview')}</h3>
          <div id="bc-preview-container" style="min-height:120px;display:flex;align-items:center;justify-content:center;color:var(--color-text-3)">
            Generate a barcode to preview
          </div>
          <div class="divider"></div>
          <h4 class="font-semibold mb-3">${I18n.t('print_barcode')}</h4>
          <div class="form-group mb-3">
            <label>Label Size</label>
            <div class="print-size-selector">
              <button class="size-opt" data-size="30x40" id="btn-size-30">30×40mm</button>
              <button class="size-opt active" data-size="40x60" id="btn-size-40">40×60mm</button>
            </div>
          </div>
          <div class="form-group mb-4">
            <label>${I18n.t('copies')}</label>
            <input type="number" class="form-control" id="bc-copies" value="1" min="1" max="100" style="width:100px">
          </div>
          <button class="btn btn-success btn-lg btn-full" id="btn-print-bc">🖨️ ${I18n.t('print_barcode')}</button>
        </div>
      </div>

      <!-- Existing product barcodes table -->
      <div class="mt-4">
        <h3 class="font-bold mb-3">${I18n.t('products')} with Barcodes</h3>
        <div class="table-wrap">
          <table>
            <thead><tr>
              <th>${I18n.t('name')}</th>
              <th>${I18n.t('barcode_type')}</th>
              <th>${I18n.t('barcode_value')}</th>
              <th>${I18n.t('actions')}</th>
            </tr></thead>
            <tbody>
              ${_products.filter(p => p.barcode).map(p => `
                <tr>
                  <td>${Utils.escapeHtml(Utils.productName(p))}</td>
                  <td>${p.barcode?.length === 13 ? 'EAN-13' : 'CODE128'}</td>
                  <td><code>${Utils.escapeHtml(p.barcode)}</code></td>
                  <td>
                    <button class="btn btn-ghost btn-sm" onclick="BarcodesView._quickPrint('${p.product_id}')">🖨️ ${I18n.t('print_barcode')}</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  function _bindEvents(container) {
    // Type toggle
    container.querySelector('#btn-type-128')?.addEventListener('click', () => { _barcodeType = 'CODE128'; _toggleType(); });
    container.querySelector('#btn-type-ean')?.addEventListener('click', () => { _barcodeType = 'EAN13'; _toggleType(); });

    // Print size toggle
    container.querySelector('#btn-size-30')?.addEventListener('click', () => { _printSize = '30x40'; _toggleSize(); });
    container.querySelector('#btn-size-40')?.addEventListener('click', () => { _printSize = '40x60'; _toggleSize(); });

    // Product select
    container.querySelector('#bc-product-select')?.addEventListener('change', (e) => {
      _selectedProduct = _products.find(p => p.product_id === e.target.value) || null;
      if (_selectedProduct) {
        document.getElementById('bc-value').value = _selectedProduct.barcode || '';
        document.getElementById('bc-label-name').value = Utils.productName(_selectedProduct);
        document.getElementById('bc-price').value = _selectedProduct.sale_price || '';
        _barcodeType = (_selectedProduct.barcode?.length === 13) ? 'EAN13' : 'CODE128';
        _toggleType();
      }
    });

    // Generate barcode
    container.querySelector('#btn-generate-bc')?.addEventListener('click', async () => {
      try {
        const result = await API.barcodes.getNext(_barcodeType);
        document.getElementById('bc-value').value = result.barcode_value;
        _barcodeValue = result.barcode_value;
        Utils.toast(I18n.t('barcode_generated'), 'success');
      } catch(e) {
        // Offline fallback
        if (_barcodeType === 'EAN13') {
          const seq = Date.now().toString().slice(-10);
          const base12 = '20' + seq.slice(0, 10);
          _barcodeValue = base12 + BarcodeGen.ean13CheckDigit(base12);
        } else {
          _barcodeValue = 'BC' + Date.now().toString().slice(-8).toUpperCase();
        }
        document.getElementById('bc-value').value = _barcodeValue;
        Utils.toast(I18n.t('barcode_generated') + ' (offline)', 'warning');
      }
    });

    // Preview
    container.querySelector('#btn-preview-bc')?.addEventListener('click', () => {
      _barcodeValue = document.getElementById('bc-value').value.trim();
      if (!_barcodeValue) { Utils.toast('Enter barcode value', 'warning'); return; }

      const labelName = document.getElementById('bc-label-name').value || _barcodeValue;
      const price = parseFloat(document.getElementById('bc-price').value) || 0;
      const pseudoProduct = {
        name_en: labelName, name_lo: labelName, name_th: labelName, name_zh: labelName,
        sale_price: price,
      };

      BarcodeGen.renderPreview('bc-preview-container', pseudoProduct, _barcodeValue, _barcodeType);
    });

    // Print
    container.querySelector('#btn-print-bc')?.addEventListener('click', () => {
      _barcodeValue = document.getElementById('bc-value').value.trim();
      if (!_barcodeValue) { Utils.toast('Enter barcode value first', 'warning'); return; }
      _copies = parseInt(document.getElementById('bc-copies').value) || 1;

      const labelName = document.getElementById('bc-label-name').value || _barcodeValue;
      const price = parseFloat(document.getElementById('bc-price').value) || 0;

      if (_selectedProduct) {
        BarcodeGen.printLabels(_selectedProduct, _barcodeValue, _barcodeType, _printSize, _copies);
      } else {
        BarcodeGen.printRawBarcode(_barcodeValue, _barcodeType, labelName, price, _printSize, _copies);
      }
    });
  }

  function _toggleType() {
    document.getElementById('btn-type-128')?.classList.toggle('active', _barcodeType === 'CODE128');
    document.getElementById('btn-type-ean')?.classList.toggle('active', _barcodeType === 'EAN13');
  }
  function _toggleSize() {
    document.getElementById('btn-size-30')?.classList.toggle('active', _printSize === '30x40');
    document.getElementById('btn-size-40')?.classList.toggle('active', _printSize === '40x60');
  }

  function _quickPrint(productId) {
    const product = _products.find(p => p.product_id === productId);
    if (!product || !product.barcode) return;
    const type = product.barcode.length === 13 ? 'EAN13' : 'CODE128';
    BarcodeGen.printLabels(product, product.barcode, type, '40x60', 1);
  }

  function destroy() {}
  return { render, destroy, _quickPrint };
})();
