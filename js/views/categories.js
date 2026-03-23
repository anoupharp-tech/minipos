/**
 * MiniPOS - views/categories.js
 * Category management
 */
'use strict';

const CategoriesView = (() => {
  let _categories = [];
  const COLORS = ['#ef4444','#f97316','#eab308','#22c55e','#14b8a6','#3b82f6','#8b5cf6','#ec4899','#64748b','#0891b2'];
  const ICONS  = ['🍎','🥤','🧴','🍞','🧹','🔧','💊','🐟','🍫','🧃','📦','🏠','👕','💄','🐾'];

  async function render(container) {
    container.innerHTML = `<div class="loading-screen"><div class="spinner"></div></div>`;
    await _load();
    container.innerHTML = _html();
    _bindEvents(container);
    _renderList();
  }

  async function _load() {
    try {
      _categories = await API.categories.list();
      AppState.set('categories', _categories);
    } catch(e) {
      _categories = AppState.get('categories') || [];
    }
  }

  function _html() {
    return `
      <div class="section-header">
        <h2 class="section-title" data-i18n="categories">Categories</h2>
        <button class="btn btn-primary" id="btn-add-cat">+ ${I18n.t('add_category')}</button>
      </div>
      <div class="table-wrap">
        <table id="cat-table">
          <thead><tr>
            <th>${I18n.t('cat_icon')}</th>
            <th>${I18n.t('name')}</th>
            <th>${I18n.t('cat_color')}</th>
            <th>${I18n.t('cat_order')}</th>
            <th>${I18n.t('status')}</th>
            <th>${I18n.t('actions')}</th>
          </tr></thead>
          <tbody id="cat-tbody"></tbody>
        </table>
      </div>
    `;
  }

  function _bindEvents(container) {
    container.querySelector('#btn-add-cat')?.addEventListener('click', () => _openForm(null));
    container.querySelector('#cat-tbody')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const cat = _categories.find(c => c.category_id === btn.dataset.catId);
      if (btn.dataset.action === 'edit' && cat) _openForm(cat);
      if (btn.dataset.action === 'delete') _delete(btn.dataset.catId);
    });
  }

  function _renderList() {
    const tbody = document.getElementById('cat-tbody');
    if (!tbody) return;
    if (!_categories.length) {
      tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><div class="empty-state-icon">🏷️</div><div>${I18n.t('no_products')}</div></div></td></tr>`;
      return;
    }
    tbody.innerHTML = _categories.map(c => {
      const isActive = c.is_active !== false && c.is_active !== 'FALSE';
      return `
        <tr>
          <td style="font-size:24px">${c.icon || '📦'}</td>
          <td><strong>${Utils.escapeHtml(Utils.categoryName(c))}</strong></td>
          <td><span style="display:inline-block;width:24px;height:24px;border-radius:50%;background:${Utils.escapeHtml(c.color || '#64748b')}"></span></td>
          <td>${c.sort_order || 0}</td>
          <td><span class="badge ${isActive ? 'badge-success' : 'badge-gray'}">${isActive ? I18n.t('active') : I18n.t('inactive')}</span></td>
          <td class="td-actions">
            <button class="btn btn-ghost btn-sm" data-action="edit" data-cat-id="${c.category_id}">✏️ ${I18n.t('edit')}</button>
            <button class="btn btn-danger btn-sm" data-action="delete" data-cat-id="${c.category_id}">🗑 ${I18n.t('delete')}</button>
          </td>
        </tr>
      `;
    }).join('');
  }

  function _openForm(cat) {
    const isEdit = !!cat;
    const selectedColor = cat?.color || COLORS[0];
    const selectedIcon  = cat?.icon  || '';

    Utils.openModal(
      I18n.t(isEdit ? 'edit_category' : 'add_category'),
      `
        <div class="form-grid" style="gap:14px">
          <div class="form-grid form-grid-2">
            <div class="form-group">
              <label class="required">${I18n.t('cat_name_en')}</label>
              <input type="text" class="form-control" id="c-name-en" value="${Utils.escapeHtml(cat?.name_en || '')}">
            </div>
            <div class="form-group">
              <label>${I18n.t('cat_name_lo')}</label>
              <input type="text" class="form-control" id="c-name-lo" value="${Utils.escapeHtml(cat?.name_lo || '')}">
            </div>
            <div class="form-group">
              <label>${I18n.t('cat_name_th')}</label>
              <input type="text" class="form-control" id="c-name-th" value="${Utils.escapeHtml(cat?.name_th || '')}">
            </div>
            <div class="form-group">
              <label>${I18n.t('cat_name_zh')}</label>
              <input type="text" class="form-control" id="c-name-zh" value="${Utils.escapeHtml(cat?.name_zh || '')}">
            </div>
          </div>
          <div class="form-group">
            <label>${I18n.t('cat_icon')}</label>
            <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:4px" id="icon-picker">
              ${ICONS.map(ic => `<button type="button" class="icon-opt" data-icon="${ic}" style="font-size:22px;width:38px;height:38px;border-radius:8px;border:2px solid ${ic===selectedIcon?'var(--color-primary)':'var(--color-border)'};">${ic}</button>`).join('')}
            </div>
            <input type="text" class="form-control mt-2" id="c-icon" value="${Utils.escapeHtml(selectedIcon)}" placeholder="Or type emoji">
          </div>
          <div class="form-group">
            <label>${I18n.t('cat_color')}</label>
            <div class="color-swatches" id="color-swatches">
              ${COLORS.map(col => `<div class="color-swatch ${col===selectedColor?'selected':''}" data-color="${col}" style="background:${col}"></div>`).join('')}
            </div>
            <input type="text" class="form-control mt-2" id="c-color" value="${Utils.escapeHtml(selectedColor)}" placeholder="#hex">
          </div>
          <div class="form-grid form-grid-2">
            <div class="form-group">
              <label>${I18n.t('cat_order')}</label>
              <input type="number" class="form-control" id="c-order" value="${cat?.sort_order ?? 0}" min="0">
            </div>
            <div class="form-group" style="justify-content:flex-end;padding-top:20px">
              <label class="toggle-wrap">
                <label class="toggle"><input type="checkbox" id="c-active" ${(cat?.is_active !== false && cat?.is_active !== 'FALSE') ? 'checked' : ''}><span class="toggle-slider"></span></label>
                <span class="toggle-label">${I18n.t('active')}</span>
              </label>
            </div>
          </div>
        </div>
      `,
      `<button class="btn btn-ghost" onclick="Utils.closeModal()">${I18n.t('cancel')}</button>
       <button class="btn btn-primary" id="cat-save-btn">${I18n.t('save')}</button>`
    );

    // Icon picker
    document.getElementById('icon-picker')?.addEventListener('click', (e) => {
      const btn = e.target.closest('.icon-opt');
      if (!btn) return;
      document.querySelectorAll('.icon-opt').forEach(b => b.style.borderColor = 'var(--color-border)');
      btn.style.borderColor = 'var(--color-primary)';
      document.getElementById('c-icon').value = btn.dataset.icon;
    });

    // Color swatches
    document.getElementById('color-swatches')?.addEventListener('click', (e) => {
      const sw = e.target.closest('.color-swatch');
      if (!sw) return;
      document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
      sw.classList.add('selected');
      document.getElementById('c-color').value = sw.dataset.color;
    });

    document.getElementById('cat-save-btn')?.addEventListener('click', async () => {
      const nameEn = document.getElementById('c-name-en').value.trim();
      if (!nameEn) { Utils.toast('English name required', 'error'); return; }
      const btn = document.getElementById('cat-save-btn');
      btn.disabled = true;
      try {
        const payload = {
          ...(isEdit ? { category_id: cat.category_id } : {}),
          name_en: nameEn,
          name_lo: document.getElementById('c-name-lo').value.trim(),
          name_th: document.getElementById('c-name-th').value.trim(),
          name_zh: document.getElementById('c-name-zh').value.trim(),
          icon:    document.getElementById('c-icon').value,
          color:   document.getElementById('c-color').value || '#64748b',
          sort_order: parseInt(document.getElementById('c-order').value) || 0,
          is_active:  document.getElementById('c-active').checked,
        };
        if (isEdit) await API.categories.update(payload);
        else await API.categories.create(payload);
        Utils.toast(I18n.t('category_saved'), 'success');
        Utils.closeModal();
        await _load(); _renderList();
      } catch(e) {
        Utils.toast(e.message, 'error');
        btn.disabled = false;
      }
    });
  }

  async function _delete(catId) {
    const ok = await Utils.confirm(I18n.t('confirm_delete_category'), '', I18n.t('delete'));
    if (!ok) return;
    try {
      await API.categories.delete(catId);
      Utils.toast(I18n.t('category_deleted'), 'success');
      await _load(); _renderList();
    } catch(e) { Utils.toast(e.message, 'error'); }
  }

  function destroy() {}
  return { render, destroy };
})();
