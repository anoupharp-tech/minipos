/**
 * MiniPOS GAS Backend - Settings.gs
 * System settings read/write
 */

/**
 * Get all settings as key-value object
 */
function handleGetSettings(params, user) {
  var cached = getCached('settings');
  if (cached) return cached;

  var sheet = getSheet('Settings');
  var rows = sheetToObjects(sheet);
  var settings = {};
  rows.forEach(function(row) {
    settings[row.setting_key] = row.setting_value;
  });
  setCached('settings', settings, 120);
  return settings;
}

/**
 * Update a single setting
 */
function handleUpdateSettings(payload, user) {
  requireAdmin(user);
  if (!payload.key) throw { message: 'key required', code: 400 };

  var sheet = getSheet('Settings');
  var rowIdx = findRow(sheet, 1, payload.key);
  var now = nowISO();

  if (rowIdx > 0) {
    sheet.getRange(rowIdx, 2).setValue(payload.value);
    sheet.getRange(rowIdx, 3).setValue(now);
    sheet.getRange(rowIdx, 4).setValue(user.user_id);
  } else {
    sheet.appendRow([payload.key, payload.value, now, user.user_id]);
  }

  clearCache('settings');
  return { success: true, key: payload.key };
}

/**
 * Update multiple settings at once
 */
function handleUpdateSettingsMultiple(payload, user) {
  requireAdmin(user);
  var pairs = payload.pairs || {};
  var keys = Object.keys(pairs);
  var sheet = getSheet('Settings');
  var now = nowISO();

  keys.forEach(function(key) {
    var rowIdx = findRow(sheet, 1, key);
    if (rowIdx > 0) {
      sheet.getRange(rowIdx, 2).setValue(pairs[key]);
      sheet.getRange(rowIdx, 3).setValue(now);
      sheet.getRange(rowIdx, 4).setValue(user.user_id);
    } else {
      sheet.appendRow([key, pairs[key], now, user.user_id]);
    }
  });

  clearCache('settings');
  return { success: true, updated: keys.length };
}
