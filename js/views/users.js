/**
 * MiniPOS - views/users.js
 * User management (Admin only)
 */
'use strict';

const UsersView = (() => {
  let _users = [];

  async function render(container) {
    container.innerHTML = `<div class="loading-screen"><div class="spinner"></div></div>`;
    await _load();
    container.innerHTML = _html();
    _bindEvents(container);
  }

  async function _load() {
    try { _users = await API.users.list(); }
    catch(e) { _users = []; }
  }

  function _html() {
    return `
      <div class="section-header">
        <h2 class="section-title" data-i18n="users">Users</h2>
        <button class="btn btn-primary" id="btn-add-user">+ ${I18n.t('add_user')}</button>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr>
            <th>${I18n.t('display_name')}</th>
            <th>${I18n.t('username')}</th>
            <th>${I18n.t('role')}</th>
            <th>${I18n.t('status')}</th>
            <th>${I18n.t('last_login')}</th>
            <th>${I18n.t('actions')}</th>
          </tr></thead>
          <tbody id="users-tbody">
            ${_rows()}
          </tbody>
        </table>
      </div>
    `;
  }

  function _rows() {
    if (!_users.length) return `<tr><td colspan="6"><div class="empty-state"><div class="empty-state-icon">👥</div><div>No users found</div></div></td></tr>`;
    const me = Auth.getUser();
    return _users.map(u => {
      const isActive = u.is_active !== false && u.is_active !== 'FALSE';
      const isMe = u.user_id === me?.user_id;
      return `
        <tr>
          <td><strong>${Utils.escapeHtml(u.display_name || u.username)}</strong></td>
          <td>${Utils.escapeHtml(u.username)}</td>
          <td><span class="badge ${u.role === 'admin' ? 'badge-primary' : 'badge-gray'}">${I18n.t('role_' + u.role) || u.role}</span></td>
          <td><span class="badge ${isActive ? 'badge-success' : 'badge-danger'}">${isActive ? I18n.t('active') : I18n.t('inactive')}</span></td>
          <td>${u.last_login ? Utils.formatDateTime(u.last_login) : I18n.t('never')}</td>
          <td class="td-actions">
            <button class="btn btn-ghost btn-sm" data-action="edit" data-user-id="${u.user_id}">✏️ ${I18n.t('edit')}</button>
            ${!isMe ? `<button class="btn btn-danger btn-sm" data-action="delete" data-user-id="${u.user_id}">🗑 ${I18n.t('delete')}</button>` : `<span class="badge badge-gray">You</span>`}
          </td>
        </tr>
      `;
    }).join('');
  }

  function _bindEvents(container) {
    container.querySelector('#btn-add-user')?.addEventListener('click', () => _openForm(null));
    container.querySelector('#users-tbody')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const user = _users.find(u => u.user_id === btn.dataset.userId);
      if (btn.dataset.action === 'edit' && user) _openForm(user);
      if (btn.dataset.action === 'delete') _delete(btn.dataset.userId);
    });
  }

  function _openForm(user) {
    const isEdit = !!user;
    Utils.openModal(
      I18n.t(isEdit ? 'edit_user' : 'add_user'),
      `
        <div class="form-grid" style="gap:14px">
          <div class="form-grid form-grid-2">
            <div class="form-group">
              <label class="required">${I18n.t('display_name')}</label>
              <input type="text" class="form-control" id="u-display" value="${Utils.escapeHtml(user?.display_name || '')}">
            </div>
            <div class="form-group">
              <label class="required">${I18n.t('username')}</label>
              <input type="text" class="form-control" id="u-username" value="${Utils.escapeHtml(user?.username || '')}" autocomplete="off">
            </div>
          </div>
          <div class="form-group">
            <label ${!isEdit ? 'class="required"' : ''}>${I18n.t('new_password')}</label>
            <input type="password" class="form-control" id="u-password" autocomplete="new-password"
              placeholder="${isEdit ? I18n.t('leave_blank_password') : ''}">
          </div>
          <div class="form-group">
            <label class="required">${I18n.t('role')}</label>
            <select class="form-control" id="u-role">
              <option value="staff" ${user?.role === 'staff' ? 'selected' : ''}>${I18n.t('role_staff')}</option>
              <option value="admin" ${user?.role === 'admin' ? 'selected' : ''}>${I18n.t('role_admin')}</option>
            </select>
          </div>
          <div class="form-group">
            <label class="toggle-wrap">
              <label class="toggle"><input type="checkbox" id="u-active" ${(user?.is_active !== false && user?.is_active !== 'FALSE') ? 'checked' : ''}><span class="toggle-slider"></span></label>
              <span class="toggle-label">${I18n.t('active')}</span>
            </label>
          </div>
        </div>
      `,
      `<button class="btn btn-ghost" onclick="Utils.closeModal()">${I18n.t('cancel')}</button>
       <button class="btn btn-primary" id="user-save-btn">${I18n.t('save')}</button>`
    );

    document.getElementById('user-save-btn')?.addEventListener('click', async () => {
      const displayName = document.getElementById('u-display').value.trim();
      const username    = document.getElementById('u-username').value.trim();
      const password    = document.getElementById('u-password').value;

      if (!displayName || !username) { Utils.toast('Name and username required', 'error'); return; }
      if (!isEdit && !password) { Utils.toast('Password required for new user', 'error'); return; }

      const btn = document.getElementById('user-save-btn');
      btn.disabled = true;

      try {
        const payload = {
          ...(isEdit ? { user_id: user.user_id } : {}),
          display_name: displayName,
          username,
          role: document.getElementById('u-role').value,
          is_active: document.getElementById('u-active').checked,
          ...(password ? { password } : {}),
        };
        if (isEdit) await API.users.update(payload);
        else await API.users.create(payload);
        Utils.toast(I18n.t('user_saved'), 'success');
        Utils.closeModal();
        await _load();
        document.getElementById('users-tbody').innerHTML = _rows();
      } catch(e) {
        Utils.toast(e.message, 'error');
        btn.disabled = false;
      }
    });
  }

  async function _delete(userId) {
    const me = Auth.getUser();
    if (userId === me?.user_id) { Utils.toast('Cannot delete your own account', 'error'); return; }
    const ok = await Utils.confirm(I18n.t('confirm_delete_user'), '', I18n.t('delete'));
    if (!ok) return;
    try {
      await API.users.delete(userId);
      Utils.toast(I18n.t('user_deleted'), 'success');
      await _load();
      document.getElementById('users-tbody').innerHTML = _rows();
    } catch(e) { Utils.toast(e.message, 'error'); }
  }

  function destroy() {}
  return { render, destroy };
})();
