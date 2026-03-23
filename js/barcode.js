/**
 * MiniPOS - barcode.js
 * Barcode generation using JsBarcode
 * Supports CODE128 and EAN13
 * Handles label preview and printing (30x40mm, 40x60mm)
 */
'use strict';

const BarcodeGen = (() => {

  /** Calculate EAN-13 check digit */
  function ean13CheckDigit(digits12) {
    const d = digits12.split('').map(Number);
    let sum = 0;
    for (let i = 0; i < 12; i++) {
      sum += d[i] * (i % 2 === 0 ? 1 : 3);
    }
    return ((10 - (sum % 10)) % 10).toString();
  }

  /** Generate EAN-13 barcode value from sequence */
  function generateEAN13(prefix, seq) {
    const p = String(prefix).padStart(2, '0');
    const s = String(seq).padStart(10, '0');
    const base12 = (p + s).slice(0, 12);
    return base12 + ean13CheckDigit(base12);
  }

  /** Validate EAN-13 */
  function validateEAN13(code) {
    if (!/^\d{13}$/.test(code)) return false;
    const check = ean13CheckDigit(code.slice(0, 12));
    return check === code[12];
  }

  /**
   * Render barcode to SVG element
   * @param {string} value - Barcode value
   * @param {string} format - 'CODE128' or 'EAN13'
   * @param {object} options - JsBarcode options
   * @returns {SVGElement}
   */
  function renderToSVG(value, format = 'CODE128', options = {}) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    try {
      JsBarcode(svg, value, {
        format,
        width: options.width || 2,
        height: options.height || 50,
        displayValue: options.displayValue !== false,
        fontSize: options.fontSize || 12,
        margin: options.margin || 5,
        lineColor: options.lineColor || '#000000',
        background: options.background || '#ffffff',
        ...options,
      });
    } catch(e) {
      console.error('[Barcode] Generation error:', e);
      return null;
    }
    return svg;
  }

  /**
   * Render barcode preview in a target element
   */
  function renderPreview(containerId, product, barcodeValue, barcodeType = 'CODE128') {
    const container = document.getElementById(containerId);
    if (!container) return;

    const settings = AppState.get('settings');
    const storeName = settings?.store_name || 'MiniPOS';
    const productName = Utils.productName(product);
    const price = Utils.formatCurrency(product.sale_price);

    const svg = renderToSVG(barcodeValue, barcodeType, {
      width: 1.8,
      height: 45,
      fontSize: 11,
    });

    container.innerHTML = `
      <div class="barcode-preview-wrap">
        <div class="barcode-preview-label-name">${Utils.escapeHtml(storeName)}</div>
        <div class="barcode-preview-label-name">${Utils.escapeHtml(productName)}</div>
        ${svg ? svg.outerHTML : '<p>Error generating barcode</p>'}
        <div class="barcode-preview-label-price">${Utils.escapeHtml(price)}</div>
      </div>
    `;
  }

  /**
   * Build print-ready label HTML
   */
  function buildLabelHTML(product, barcodeValue, barcodeType, size = '40x60', copies = 1) {
    const settings = AppState.get('settings');
    const storeName = settings?.store_name || 'MiniPOS';
    const productName = Utils.productName(product);
    const price = Utils.formatCurrency(product.sale_price);

    const svg = renderToSVG(barcodeValue, barcodeType, {
      width: size === '30x40' ? 1.5 : 2,
      height: size === '30x40' ? 35 : 45,
      fontSize: 10,
      margin: 3,
    });
    if (!svg) return '';

    const label = `
      <div class="barcode-label-print">
        <div class="barcode-label-store">${Utils.escapeHtml(storeName)}</div>
        <div class="barcode-label-name">${Utils.escapeHtml(productName)}</div>
        <div class="barcode-label-svg">${svg.outerHTML}</div>
        <div class="barcode-label-price">${Utils.escapeHtml(price)}</div>
      </div>
    `;
    return label.repeat(copies);
  }

  /**
   * Print labels for a product
   * @param {object} product
   * @param {string} barcodeValue
   * @param {string} barcodeType
   * @param {string} size - '30x40' or '40x60'
   * @param {number} copies
   */
  function printLabels(product, barcodeValue, barcodeType, size = '40x60', copies = 1) {
    const [w, h] = size.split('x');
    // Set CSS variables for label size
    document.documentElement.style.setProperty('--label-width', `${w}mm`);
    document.documentElement.style.setProperty('--label-height', `${h}mm`);

    const labelsHTML = buildLabelHTML(product, barcodeValue, barcodeType, size, copies);
    const container = document.getElementById('barcode-labels-content');
    if (!container) return;

    container.innerHTML = `<div class="barcode-labels-sheet">${labelsHTML}</div>`;
    document.getElementById('barcode-print-area').style.display = 'block';

    setTimeout(() => {
      window.print();
      document.getElementById('barcode-print-area').style.display = 'none';
    }, 200);
  }

  /** Print labels without product object (standalone barcode) */
  function printRawBarcode(barcodeValue, barcodeType, label, price, size = '40x60', copies = 1) {
    const pseudoProduct = {
      name_en: label || barcodeValue,
      name_lo: label || barcodeValue,
      name_th: label || barcodeValue,
      name_zh: label || barcodeValue,
      sale_price: price || 0,
    };
    printLabels(pseudoProduct, barcodeValue, barcodeType, size, copies);
  }

  /** Check if JsBarcode is loaded */
  function isReady() {
    return typeof JsBarcode !== 'undefined';
  }

  return {
    generateEAN13,
    validateEAN13,
    renderToSVG,
    renderPreview,
    buildLabelHTML,
    printLabels,
    printRawBarcode,
    isReady,
    ean13CheckDigit,
  };
})();
