/**
 * MiniPOS - receipt.js
 * Receipt builder and printing (browser print + optional ESC/POS)
 */
'use strict';

const Receipt = (() => {

  /** Build receipt HTML */
  function build(saleData, settings) {
    const {
      sale_id, sale_date, cashier_name,
      items, subtotal, discount_type, discount_value, discount_amount,
      tax_rate, tax_amount, total,
      payment_type, received_amount, change_amount,
    } = saleData;

    const storeName    = settings?.store_name    || 'MiniPOS';
    const storeAddress = settings?.store_address || '';
    const storePhone   = settings?.store_phone   || '';
    const storeLogoUrl = settings?.store_logo_url || '';
    const taxLabel     = settings?.tax_label     || 'Tax';
    const currency     = settings?.currency_symbol || '₭';
    const thankYou     = I18n.t('receipt_thank_you');
    const footer       = I18n.t('receipt_footer');

    const paymentLabels = {
      cash: I18n.t('pay_cash'),
      bank_transfer: I18n.t('pay_bank'),
      qr: I18n.t('pay_qr'),
      card: I18n.t('pay_card'),
    };
    const payLabel = paymentLabels[payment_type] || payment_type;

    const fmt = (n) => Utils.formatCurrency(n, currency);
    const dateStr = sale_date ? Utils.formatDateTime(sale_date) : Utils.nowDisplay();
    const receiptNo = sale_id ? sale_id.slice(-8).toUpperCase() : Utils.uuid().slice(-8).toUpperCase();

    // Build items rows
    const itemsHtml = (items || []).map(item => `
      <div class="receipt-item">
        <div class="receipt-item-name">${Utils.escapeHtml(item.name || item.product_name || '')}</div>
        <div class="receipt-item-detail">
          <span>${item.qty} × ${fmt(item.unit_price)}</span>
          <span>${fmt(item.qty * item.unit_price)}</span>
        </div>
      </div>
    `).join('');

    const discountHtml = (discount_amount > 0) ? `
      <div class="receipt-total-row">
        <span>${I18n.t('discount')} ${discount_type === 'percent' ? `(${discount_value}%)` : ''}</span>
        <span>- ${fmt(discount_amount)}</span>
      </div>
    ` : '';

    const taxHtml = (tax_rate > 0) ? `
      <div class="receipt-total-row">
        <span>${taxLabel} (${tax_rate}%)</span>
        <span>${fmt(tax_amount)}</span>
      </div>
    ` : '';

    const changeHtml = (payment_type === 'cash' && change_amount >= 0) ? `
      <div class="receipt-total-row">
        <span>${I18n.t('received')}</span>
        <span>${fmt(received_amount)}</span>
      </div>
      <div class="receipt-total-row change">
        <span>${I18n.t('change')}</span>
        <span>${fmt(change_amount)}</span>
      </div>
    ` : '';

    return `
      <div class="receipt-preview">
        ${storeLogoUrl ? `<div class="receipt-store-header"><img src="${storeLogoUrl}" class="receipt-store-logo" alt="Logo"></div>` : ''}
        <div class="receipt-store-header">
          <div class="receipt-store-name">${Utils.escapeHtml(storeName)}</div>
          ${storeAddress ? `<div class="receipt-store-info">${Utils.escapeHtml(storeAddress)}</div>` : ''}
          ${storePhone ? `<div class="receipt-store-info">Tel: ${Utils.escapeHtml(storePhone)}</div>` : ''}
        </div>
        <hr class="receipt-divider-solid">
        <div class="receipt-meta">${I18n.t('receipt_no')}: ${receiptNo}</div>
        <div class="receipt-meta">${dateStr}</div>
        <div class="receipt-meta">${I18n.t('cashier')}: ${Utils.escapeHtml(cashier_name || '')}</div>
        <hr class="receipt-divider-solid">
        <div class="receipt-items-header">
          <span>${I18n.t('product')}</span>
          <span>${I18n.t('total')}</span>
        </div>
        ${itemsHtml}
        <div class="receipt-totals">
          <div class="receipt-total-row">
            <span>${I18n.t('subtotal')}</span>
            <span>${fmt(subtotal)}</span>
          </div>
          ${discountHtml}
          ${taxHtml}
          <div class="receipt-total-row grand">
            <span>${I18n.t('total')}</span>
            <span>${fmt(total)}</span>
          </div>
          ${changeHtml}
        </div>
        <div class="receipt-payment-type">${payLabel}</div>
        <div class="receipt-footer">
          <p>${Utils.escapeHtml(thankYou)}</p>
          <p>${Utils.escapeHtml(footer)}</p>
        </div>
      </div>
    `;
  }

  /** Show receipt in modal */
  function showModal(saleData, settings) {
    const modalBody = document.getElementById('receipt-modal-body');
    if (modalBody) {
      modalBody.innerHTML = build(saleData, settings);
    }
    document.getElementById('receipt-modal')?.classList.remove('hidden');
  }

  /** Print receipt using browser window.print() */
  function printBrowser(saleData, settings) {
    const receiptWidth = settings?.receipt_width || '58';
    // Set CSS variable for receipt width
    document.documentElement.style.setProperty('--receipt-width', receiptWidth + 'mm');

    const container = document.getElementById('receipt-content');
    if (container) {
      container.innerHTML = build(saleData, settings);
    }
    document.getElementById('receipt-print-area').style.display = 'block';

    setTimeout(() => {
      window.print();
      document.getElementById('receipt-print-area').style.display = 'none';
    }, 200);
  }

  /** Build ESC/POS byte array for direct thermal printing */
  function buildEscPos(saleData, settings) {
    const lines = [];
    const storeName = settings?.store_name || 'MiniPOS';
    const currency  = settings?.currency_symbol || '₭';
    const fmt = (n) => Utils.formatCurrency(n, currency);

    // ESC/POS commands
    const ESC = 0x1B;
    const GS  = 0x1D;
    const LF  = 0x0A;

    const cmd = (...bytes) => bytes;
    const text = (str) => Array.from(new TextEncoder().encode(str));
    const line = (str) => [...text(str), LF];
    const centerOn  = [ESC, 0x61, 0x01];
    const centerOff = [ESC, 0x61, 0x00];
    const boldOn    = [ESC, 0x45, 0x01];
    const boldOff   = [ESC, 0x45, 0x00];
    const bigOn     = [GS,  0x21, 0x11]; // 2x height+width
    const bigOff    = [GS,  0x21, 0x00];
    const feed      = (n) => [ESC, 0x64, n];
    const cut       = [GS,  0x56, 0x00]; // Full cut

    const divider = '-'.repeat(32);

    const bytes = [
      [ESC, 0x40],           // Init printer
      ...centerOn,
      ...boldOn,
      ...bigOn,
      ...line(storeName),
      ...bigOff,
      ...boldOff,
      ...(settings?.store_address ? line(settings.store_address) : []),
      ...(settings?.store_phone ? line('Tel: ' + settings.store_phone) : []),
      ...centerOff,
      ...line(divider),
      ...line(`#: ${saleData.sale_id?.slice(-8) || ''}`),
      ...line(Utils.nowDisplay()),
      ...line(`Cashier: ${saleData.cashier_name || ''}`),
      ...line(divider),
    ];

    // Items
    (saleData.items || []).forEach(item => {
      const name = item.name || '';
      const lineTotal = fmt(item.qty * item.unit_price);
      bytes.push(...line(`${name}`));
      bytes.push(...line(`  ${item.qty} x ${fmt(item.unit_price)}   ${lineTotal}`));
    });

    bytes.push(...line(divider));
    bytes.push(...line(`${I18n.t('subtotal')}: ${fmt(saleData.subtotal)}`));
    if (saleData.discount_amount > 0)
      bytes.push(...line(`${I18n.t('discount')}: -${fmt(saleData.discount_amount)}`));
    if (saleData.tax_amount > 0)
      bytes.push(...line(`Tax: ${fmt(saleData.tax_amount)}`));

    bytes.push(
      ...boldOn,
      ...bigOn,
      ...line(`TOTAL: ${fmt(saleData.total)}`),
      ...bigOff,
      ...boldOff,
    );

    if (saleData.payment_type === 'cash') {
      bytes.push(...line(`Received: ${fmt(saleData.received_amount)}`));
      bytes.push(...line(`Change: ${fmt(saleData.change_amount)}`));
    }

    bytes.push(
      ...centerOn,
      ...line(divider),
      ...line(I18n.t('receipt_thank_you')),
      ...centerOff,
      ...feed(4),
      ...cut,
    );

    return new Uint8Array(bytes.flat());
  }

  /** Direct print via Web Serial API (Chrome only) */
  async function printSerial(saleData, settings) {
    if (!('serial' in navigator)) {
      Utils.toast('Web Serial API not supported in this browser', 'warning');
      return false;
    }
    try {
      const port = await navigator.serial.requestPort();
      await port.open({ baudRate: 9600 });
      const writer = port.writable.getWriter();
      const data = buildEscPos(saleData, settings);
      await writer.write(data);
      writer.releaseLock();
      await port.close();
      Utils.toast('Printed directly to printer', 'success');
      return true;
    } catch(e) {
      console.error('[Receipt] Serial print error:', e);
      Utils.toast('Serial print failed: ' + e.message, 'error');
      return false;
    }
  }

  return { build, showModal, printBrowser, printSerial, buildEscPos };
})();
