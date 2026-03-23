/**
 * MiniPOS GAS Backend - Utils.gs
 * Shared utility functions
 */

// ─── Sheet Access ──────────────────────────────────────────
function getSheet(name) {
  var props = PropertiesService.getScriptProperties();
  var sheetId = props.getProperty('SHEET_ID');
  if (!sheetId) throw new Error('SHEET_ID not configured in Script Properties');
  var ss = SpreadsheetApp.openById(sheetId);
  var sheet = ss.getSheetByName(name);
  if (!sheet) throw new Error('Sheet not found: ' + name);
  return sheet;
}

function getSpreadsheet() {
  var props = PropertiesService.getScriptProperties();
  var sheetId = props.getProperty('SHEET_ID');
  if (!sheetId) throw new Error('SHEET_ID not configured');
  return SpreadsheetApp.openById(sheetId);
}

// ─── Response Helpers ──────────────────────────────────────
function respond(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function respondOk(data) {
  return respond({ status: 'success', data: data, timestamp: new Date().toISOString() });
}

function respondError(message, code) {
  return respond({ status: 'error', error: message, code: code || 500, timestamp: new Date().toISOString() });
}

// ─── Data Helpers ──────────────────────────────────────────
/**
 * Read all rows from a sheet and return as array of objects
 * using first row as headers
 */
function sheetToObjects(sheet) {
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  var headers = data[0];
  var rows = [];
  for (var i = 1; i < data.length; i++) {
    if (!data[i][0]) continue; // Skip empty rows
    var obj = {};
    headers.forEach(function(h, j) {
      var val = data[i][j];
      // Convert dates to ISO strings
      if (val instanceof Date) val = val.toISOString();
      obj[h] = val;
    });
    rows.push(obj);
  }
  return rows;
}

/**
 * Find first row where column matches value (1-indexed)
 * Returns row index (1-indexed) or -1
 */
function findRow(sheet, colIndex, value) {
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][colIndex - 1]) === String(value)) return i + 1; // 1-indexed
  }
  return -1;
}

/**
 * Append a row to a sheet from an ordered array of values
 */
function appendRow(sheet, values) {
  sheet.appendRow(values);
}

/**
 * Update specific cells in a row
 * @param {Sheet} sheet
 * @param {number} rowIndex - 1-indexed
 * @param {number} colStart - 1-indexed
 * @param {Array} values
 */
function updateRowCells(sheet, rowIndex, colStart, values) {
  var range = sheet.getRange(rowIndex, colStart, 1, values.length);
  range.setValues([values]);
}

// ─── UUID Generator ────────────────────────────────────────
function generateUUID() {
  return Utilities.getUuid();
}

// ─── Timestamp ─────────────────────────────────────────────
function nowISO() {
  return new Date().toISOString();
}

// ─── Password Hashing ──────────────────────────────────────
function hashPassword(password) {
  var bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    password + getSecretSalt()
  );
  return bytes.map(function(b) {
    return ('0' + (b & 0xFF).toString(16)).slice(-2);
  }).join('');
}

function getSecretSalt() {
  var props = PropertiesService.getScriptProperties();
  var salt = props.getProperty('SECRET_SALT');
  if (!salt) {
    salt = Utilities.getUuid();
    props.setProperty('SECRET_SALT', salt);
  }
  return salt;
}

// ─── Token Generation ──────────────────────────────────────
function generateToken(userId) {
  var today = Utilities.formatDate(new Date(), 'UTC', 'yyyy-MM-dd');
  var raw = userId + getSecretSalt() + today;
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, raw);
  return bytes.map(function(b) {
    return ('0' + (b & 0xFF).toString(16)).slice(-2);
  }).join('');
}

function validateToken(token) {
  if (!token) return null;
  var usersSheet = getSheet('Users');
  var users = sheetToObjects(usersSheet);
  for (var i = 0; i < users.length; i++) {
    var u = users[i];
    if (u.is_active === false || u.is_active === 'FALSE') continue;
    var expected = generateToken(u.user_id);
    if (expected === token) {
      return { user_id: u.user_id, username: u.username, display_name: u.display_name, role: u.role };
    }
  }
  return null;
}

// ─── Cache ─────────────────────────────────────────────────
function getCached(key) {
  try {
    var cache = CacheService.getScriptCache();
    var val = cache.get(key);
    return val ? JSON.parse(val) : null;
  } catch(e) { return null; }
}

function setCached(key, data, seconds) {
  try {
    var cache = CacheService.getScriptCache();
    cache.put(key, JSON.stringify(data), seconds || 60);
  } catch(e) {}
}

function clearCache(key) {
  try {
    CacheService.getScriptCache().remove(key);
  } catch(e) {}
}

// ─── Setup Helper (run once) ───────────────────────────────
function setupInitialData() {
  // Creates headers for all sheets + default admin user + default settings
  // Run this function ONCE manually after creating the spreadsheet

  var ss = getSpreadsheet();

  // Products sheet
  var productsSheet = ss.getSheetByName('Products') || ss.insertSheet('Products');
  if (productsSheet.getLastRow() === 0) {
    productsSheet.appendRow(['product_id','name_en','name_lo','name_th','name_zh','category_id','barcode','cost_price','sale_price','stock_qty','low_stock_threshold','image_url','is_active','created_at','updated_at']);
    // Sample products
    productsSheet.appendRow([generateUUID(),'Coca Cola','ໂຄກ','โคคาโคล่า','可口可乐','','6901028001053',5000,8000,100,10,'',true,nowISO(),nowISO()]);
    productsSheet.appendRow([generateUUID(),'Jasmine Rice 1kg','ເຂົ້າໄວ','ข้าวหอมมะลิ 1กก','茉莉香米1公斤','',generateUUID().slice(0,8),25000,35000,50,5,'',true,nowISO(),nowISO()]);
    productsSheet.appendRow([generateUUID(),'Instant Noodles','ໝີ່ສໍາເລັດຮູບ','มาม่า','方便面','','',3000,5000,200,20,'',true,nowISO(),nowISO()]);
  }

  // Sales sheet
  var salesSheet = ss.getSheetByName('Sales') || ss.insertSheet('Sales');
  if (salesSheet.getLastRow() === 0) {
    salesSheet.appendRow(['sale_id','sale_date','cashier_id','cashier_name','items_json','subtotal','discount_type','discount_value','discount_amount','tax_rate','tax_amount','total','payment_type','received_amount','change_amount','is_synced','created_offline']);
  }

  // Stock sheet
  var stockSheet = ss.getSheetByName('Stock') || ss.insertSheet('Stock');
  if (stockSheet.getLastRow() === 0) {
    stockSheet.appendRow(['stock_id','product_id','product_name','change_type','qty_before','qty_change','qty_after','reference_id','note','performed_by','created_at']);
  }

  // Users sheet
  var usersSheet = ss.getSheetByName('Users') || ss.insertSheet('Users');
  if (usersSheet.getLastRow() === 0) {
    usersSheet.appendRow(['user_id','username','password_hash','display_name','role','is_active','last_login','created_at']);
    // Default admin: username=admin, password=admin123
    usersSheet.appendRow([generateUUID(),'admin',hashPassword('admin123'),'Administrator','admin',true,'',nowISO()]);
    // Default staff: username=staff, password=staff123
    usersSheet.appendRow([generateUUID(),'staff',hashPassword('staff123'),'Staff User','staff',true,'',nowISO()]);
  }

  // Categories sheet
  var catSheet = ss.getSheetByName('Categories') || ss.insertSheet('Categories');
  if (catSheet.getLastRow() === 0) {
    catSheet.appendRow(['category_id','name_en','name_lo','name_th','name_zh','color','icon','sort_order','is_active','created_at']);
    catSheet.appendRow([generateUUID(),'Beverages','ເຄື່ອງດື່ມ','เครื่องดื่ม','饮料','#3b82f6','🥤',1,true,nowISO()]);
    catSheet.appendRow([generateUUID(),'Food','ອາຫານ','อาหาร','食品','#22c55e','🍎',2,true,nowISO()]);
    catSheet.appendRow([generateUUID(),'Household','ຂອງໃຊ້ໃນເຮືອນ','ของใช้ในบ้าน','家居','#f97316','🧹',3,true,nowISO()]);
    catSheet.appendRow([generateUUID(),'Personal Care','ສ່ວນຕົວ','ส่วนตัว','个人护理','#ec4899','💄',4,true,nowISO()]);
  }

  // Barcodes sheet
  var bcSheet = ss.getSheetByName('Barcodes') || ss.insertSheet('Barcodes');
  if (bcSheet.getLastRow() === 0) {
    bcSheet.appendRow(['barcode_id','barcode_value','barcode_type','product_id','is_assigned','generated_at','assigned_at']);
  }

  // Settings sheet
  var settingsSheet = ss.getSheetByName('Settings') || ss.insertSheet('Settings');
  if (settingsSheet.getLastRow() === 0) {
    settingsSheet.appendRow(['setting_key','setting_value','updated_at','updated_by']);
    var defaultSettings = [
      ['store_name', 'My Minimart'],
      ['store_address', '123 Main Street, City'],
      ['store_phone', '+856 20 XXXXX'],
      ['store_logo_url', ''],
      ['tax_rate', '0'],
      ['tax_label', 'VAT'],
      ['currency_symbol', '₭'],
      ['currency_code', 'LAK'],
      ['receipt_width', '58'],
      ['receipt_footer', 'Thank you! Please come again.'],
      ['low_stock_default', '10'],
      ['barcode_prefix', '20'],
      ['next_barcode_seq', '1'],
      ['default_language', 'lo'],
    ];
    defaultSettings.forEach(function(s) {
      settingsSheet.appendRow([s[0], s[1], nowISO(), 'system']);
    });
  }

  return 'Setup complete! Admin: admin/admin123, Staff: staff/staff123';
}
