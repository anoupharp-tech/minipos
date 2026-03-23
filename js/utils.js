/**
 * MiniPOS - utils.js
 * Shared utility functions
 */
'use strict';

const Utils = (() => {

  /** Format currency based on settings */
  function formatCurrency(amount, symbol) {
    if (isNaN(amount)) amount = 0;
    symbol = symbol || AppState.get('settings').currency_symbol || '₭';
    const num = Number(amount);
    // Format with thousands separator
    const formatted = num.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
    return symbol + ' ' + formatted;
  }

  /** Format date to locale string */
  function formatDate(dateStr) {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', {
        year: 'numeric', month: 'short', day: 'numeric'
      });
    } catch { return dateStr; }
  }

  /** Format datetime */
  function formatDateTime(dateStr) {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });
    } catch { return dateStr; }
  }

  /** Get today's date as YYYY-MM-DD */
  function todayISO() {
    return new Date().toISOString().slice(0, 10);
  }

  /** Debounce function */
  function debounce(fn, delay = 300) {
    let timer;
    return function(...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  /** Generate a UUID v4 */
  function uuid() {
    if (crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }

  /** Deep clone an object */
  function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  /** Simple hash (for non-security uses) */
  async function sha256(str) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /** Sanitize HTML to prevent XSS */
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
  }

  /** Show toast notification */
  function toast(message, type = 'default', duration = 3000) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const icons = { success: '✓', error: '✕', warning: '⚠', default: 'ℹ' };
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<span>${icons[type] || icons.default}</span><span>${escapeHtml(message)}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'toast-out 0.3s ease forwards';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  /** Show confirm dialog - returns Promise<boolean> */
  function confirm(message, title, dangerLabel) {
    return new Promise(resolve => {
      const overlay = document.getElementById('confirm-overlay');
      const msgEl = document.getElementById('confirm-message');
      const titleEl = document.getElementById('confirm-title');
      const okBtn = document.getElementById('confirm-ok-btn');
      const cancelBtn = document.getElementById('confirm-cancel-btn');

      if (titleEl) titleEl.textContent = title || I18n.t('confirm');
      if (msgEl) msgEl.textContent = message;
      if (okBtn && dangerLabel) okBtn.textContent = dangerLabel;
      overlay?.classList.remove('hidden');

      const cleanup = () => overlay?.classList.add('hidden');

      const onOk = () => { cleanup(); resolve(true); okBtn?.removeEventListener('click', onOk); cancelBtn?.removeEventListener('click', onCancel); };
      const onCancel = () => { cleanup(); resolve(false); okBtn?.removeEventListener('click', onOk); cancelBtn?.removeEventListener('click', onCancel); };

      okBtn?.addEventListener('click', onOk);
      cancelBtn?.addEventListener('click', onCancel);
    });
  }

  /** Open modal */
  function openModal(title, bodyHtml, footerHtml) {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = bodyHtml;
    if (footerHtml !== undefined) {
      document.getElementById('modal-footer').innerHTML = footerHtml;
    }
    document.getElementById('modal-overlay').classList.remove('hidden');
    return document.getElementById('modal-body');
  }

  /** Close modal */
  function closeModal() {
    document.getElementById('modal-overlay').classList.add('hidden');
    document.getElementById('modal-body').innerHTML = '';
    document.getElementById('modal-footer').innerHTML = '';
  }

  /** Convert base64 data URL to Blob */
  function dataURLtoBlob(dataURL) {
    const arr = dataURL.split(',');
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) u8arr[n] = bstr.charCodeAt(n);
    return new Blob([u8arr], { type: mime });
  }

  /** Resize image to max dimensions, returns dataURL */
  function resizeImage(file, maxWidth = 400, maxHeight = 400) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => {
        const img = new Image();
        img.onload = () => {
          let w = img.width, h = img.height;
          if (w > maxWidth) { h = h * maxWidth / w; w = maxWidth; }
          if (h > maxHeight) { w = w * maxHeight / h; h = maxHeight; }
          const canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          canvas.getContext('2d').drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', 0.85));
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /** Pad a number with leading zeros */
  function padNumber(n, width) {
    return String(n).padStart(width, '0');
  }

  /** Get current date/time formatted for display */
  function nowDisplay() {
    const d = new Date();
    return d.toLocaleString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
  }

  /** Get product display name based on current language */
  function productName(product) {
    const lang = AppState.get('language');
    return product['name_' + lang] || product.name_en || product.name_lo || Object.values(product).find(v => typeof v === 'string' && v) || '';
  }

  /** Get category display name */
  function categoryName(cat) {
    const lang = AppState.get('language');
    return cat['name_' + lang] || cat.name_en || '';
  }

  return {
    formatCurrency,
    formatDate,
    formatDateTime,
    todayISO,
    debounce,
    uuid,
    clone,
    sha256,
    escapeHtml,
    toast,
    confirm,
    openModal,
    closeModal,
    dataURLtoBlob,
    resizeImage,
    padNumber,
    nowDisplay,
    productName,
    categoryName,
  };
})();
