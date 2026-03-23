/**
 * MiniPOS - i18n.js
 * Internationalization engine
 * Usage: I18n.t('key') | I18n.setLanguage('lo') | I18n.apply()
 */
'use strict';

const I18n = (() => {
  let _lang = localStorage.getItem('pos_lang') || 'en';

  function t(key, vars = {}) {
    const strings = TRANSLATIONS[_lang] || TRANSLATIONS['en'];
    let str = strings[key] || TRANSLATIONS['en'][key] || key;
    // Variable substitution: {{name}}
    Object.entries(vars).forEach(([k, v]) => {
      str = str.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), v);
    });
    return str;
  }

  function setLanguage(lang) {
    if (!TRANSLATIONS[lang]) lang = 'en';
    _lang = lang;
    localStorage.setItem('pos_lang', lang);
    AppState.set('language', lang);
    apply();
    _updateLangButtons();
  }

  function getLanguage() {
    return _lang;
  }

  /** Apply translations to all elements with data-i18n attribute */
  function apply(root = document) {
    root.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      const translation = t(key);
      // For inputs, update placeholder; for others update textContent
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
        el.placeholder = translation;
      } else {
        el.textContent = translation;
      }
    });
    root.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      el.placeholder = t(el.getAttribute('data-i18n-placeholder'));
    });
    root.querySelectorAll('[data-i18n-title]').forEach(el => {
      el.title = t(el.getAttribute('data-i18n-title'));
    });
    // Update document lang
    document.documentElement.lang = _lang;
  }

  function _updateLangButtons() {
    // Update all language buttons
    document.querySelectorAll('[data-lang]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.lang === _lang);
    });
    // Update lang switcher display
    const labels = { en: 'EN', lo: 'ລາວ', th: 'ไทย', zh: '中文' };
    const currentBtn = document.getElementById('lang-current-btn');
    if (currentBtn) currentBtn.textContent = (labels[_lang] || _lang.toUpperCase()) + ' ▾';
    // Update dropdown options
    document.querySelectorAll('.lang-opt').forEach(opt => {
      opt.classList.toggle('active', opt.dataset.lang === _lang);
    });
  }

  function init() {
    _lang = localStorage.getItem('pos_lang') || 'en';
    AppState.set('language', _lang);
    apply();
    _updateLangButtons();

    // Language dropdown toggle
    const langBtn = document.getElementById('lang-current-btn');
    const langDrop = document.getElementById('lang-dropdown');
    langBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      langDrop?.classList.toggle('hidden');
    });
    document.addEventListener('click', () => langDrop?.classList.add('hidden'));

    // Language option click (topbar dropdown)
    document.getElementById('lang-dropdown')?.addEventListener('click', (e) => {
      const btn = e.target.closest('.lang-opt');
      if (btn?.dataset.lang) setLanguage(btn.dataset.lang);
    });

    // Language buttons on login screen
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.lang-btn');
      if (btn?.dataset.lang) setLanguage(btn.dataset.lang);
    });
  }

  return { t, setLanguage, getLanguage, apply, init };
})();
