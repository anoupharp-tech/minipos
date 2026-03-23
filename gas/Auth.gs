/**
 * MiniPOS GAS Backend - Auth.gs
 * Authentication and authorization
 */

/**
 * Login endpoint - validates credentials, returns token
 */
function handleLogin(payload) {
  var username = payload.username;
  var password = payload.password;
  if (!username || !password) throw { message: 'Username and password required', code: 400 };

  var usersSheet = getSheet('Users');
  var users = sheetToObjects(usersSheet);
  var user = users.find(function(u) { return u.username === username; });

  if (!user) throw { message: 'Invalid credentials', code: 401 };
  if (user.is_active === false || user.is_active === 'FALSE') throw { message: 'Account disabled', code: 403 };

  var hash = hashPassword(password);
  if (hash !== user.password_hash) throw { message: 'Invalid credentials', code: 401 };

  // Update last login
  var rowIdx = findRow(usersSheet, 1, user.user_id);
  if (rowIdx > 0) {
    // Column G (7) = last_login
    usersSheet.getRange(rowIdx, 7).setValue(nowISO());
  }

  var token = generateToken(user.user_id);
  return {
    token: token,
    user: {
      user_id: user.user_id,
      username: user.username,
      display_name: user.display_name,
      role: user.role,
    }
  };
}

/**
 * Validate token endpoint
 */
function handleValidateToken(params, user) {
  return { valid: true, user: user };
}

/**
 * Require token to be valid - throws if not
 */
function requireAuth(token) {
  var user = validateToken(token);
  if (!user) throw { message: 'Unauthorized', code: 401 };
  return user;
}

/**
 * Require admin role
 */
function requireAdmin(user) {
  if (user.role !== 'admin') throw { message: 'Forbidden - admin required', code: 403 };
}

/**
 * Get user list (admin only)
 */
function handleGetUsers(user) {
  requireAdmin(user);
  var sheet = getSheet('Users');
  var users = sheetToObjects(sheet);
  return users.map(function(u) {
    return {
      user_id: u.user_id,
      username: u.username,
      display_name: u.display_name,
      role: u.role,
      is_active: u.is_active,
      last_login: u.last_login,
      created_at: u.created_at,
    };
  });
}

/**
 * Create user (admin only)
 */
function handleCreateUser(payload, user) {
  requireAdmin(user);
  var sheet = getSheet('Users');
  var users = sheetToObjects(sheet);

  // Check username uniqueness
  if (users.find(function(u) { return u.username === payload.username; })) {
    throw { message: 'Username already exists', code: 409 };
  }

  var userId = generateUUID();
  var hash = hashPassword(payload.password);
  sheet.appendRow([
    userId,
    payload.username,
    hash,
    payload.display_name || payload.username,
    payload.role || 'staff',
    payload.is_active !== false,
    '',
    nowISO(),
  ]);

  return { user_id: userId, username: payload.username, role: payload.role || 'staff' };
}

/**
 * Update user (admin only)
 */
function handleUpdateUser(payload, user) {
  requireAdmin(user);
  var sheet = getSheet('Users');
  var rowIdx = findRow(sheet, 1, payload.user_id);
  if (rowIdx < 0) throw { message: 'User not found', code: 404 };

  var users = sheetToObjects(sheet);
  var existing = users.find(function(u) { return u.user_id === payload.user_id; });

  sheet.getRange(rowIdx, 1, 1, 8).setValues([[
    payload.user_id,
    payload.username || existing.username,
    payload.password ? hashPassword(payload.password) : existing.password_hash,
    payload.display_name || existing.display_name,
    payload.role || existing.role,
    payload.is_active !== undefined ? payload.is_active : existing.is_active,
    existing.last_login,
    existing.created_at,
  ]]);

  return { success: true };
}

/**
 * Delete user (admin only)
 */
function handleDeleteUser(payload, user) {
  requireAdmin(user);
  if (payload.user_id === user.user_id) throw { message: 'Cannot delete your own account', code: 400 };
  var sheet = getSheet('Users');
  var rowIdx = findRow(sheet, 1, payload.user_id);
  if (rowIdx < 0) throw { message: 'User not found', code: 404 };
  sheet.deleteRow(rowIdx);
  return { success: true };
}
