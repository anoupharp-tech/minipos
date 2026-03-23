/**
 * MiniPOS GAS Backend - Products.gs
 * Product CRUD operations
 */

function handleGetProducts(params, user) {
  // Try cache first
  var cacheKey = 'products_' + (params.active_only || 'all');
  var cached = getCached(cacheKey);
  if (cached) return cached;

  var sheet = getSheet('Products');
  var products = sheetToObjects(sheet);

  // Filter
  if (params.active_only === 'true') {
    products = products.filter(function(p) { return p.is_active !== false && p.is_active !== 'FALSE'; });
  }
  if (params.category_id) {
    products = products.filter(function(p) { return p.category_id === params.category_id; });
  }
  if (params.search) {
    var q = params.search.toLowerCase();
    products = products.filter(function(p) {
      return (p.name_en + p.name_lo + p.name_th + p.name_zh + p.barcode).toLowerCase().indexOf(q) >= 0;
    });
  }

  // Parse numbers
  products = products.map(_parseProductNumbers);

  setCached(cacheKey, products, 60);
  return products;
}

function handleGetProduct(params, user) {
  var sheet = getSheet('Products');
  var products = sheetToObjects(sheet);
  var product = products.find(function(p) { return p.product_id === params.product_id; });
  if (!product) throw { message: 'Product not found', code: 404 };
  return _parseProductNumbers(product);
}

function handleGetProductByBarcode(params, user) {
  var sheet = getSheet('Products');
  var products = sheetToObjects(sheet);
  var product = products.find(function(p) {
    return p.barcode === params.barcode && (p.is_active !== false && p.is_active !== 'FALSE');
  });
  if (!product) throw { message: 'Product not found for barcode: ' + params.barcode, code: 404 };
  return _parseProductNumbers(product);
}

function handleCreateProduct(payload, user) {
  requireAdmin(user);
  _validateProduct(payload);
  clearCache('products_all');
  clearCache('products_true');

  var sheet = getSheet('Products');
  var productId = generateUUID();
  var now = nowISO();

  var imageUrl = payload.image_base64 ? _saveImageToDrive(payload.image_base64, productId) : '';

  sheet.appendRow([
    productId,
    payload.name_en,
    payload.name_lo || '',
    payload.name_th || '',
    payload.name_zh || '',
    payload.category_id || '',
    payload.barcode || '',
    parseFloat(payload.cost_price) || 0,
    parseFloat(payload.sale_price) || 0,
    parseInt(payload.stock_qty) || 0,
    parseInt(payload.low_stock_threshold) || 10,
    imageUrl,
    payload.is_active !== false,
    now,
    now,
  ]);

  return { product_id: productId, message: 'Product created' };
}

function handleUpdateProduct(payload, user) {
  requireAdmin(user);
  var sheet = getSheet('Products');
  var rowIdx = findRow(sheet, 1, payload.product_id);
  if (rowIdx < 0) throw { message: 'Product not found', code: 404 };

  var products = sheetToObjects(sheet);
  var existing = products.find(function(p) { return p.product_id === payload.product_id; });
  var now = nowISO();
  var imageUrl = existing.image_url;

  if (payload.image_base64) {
    imageUrl = _saveImageToDrive(payload.image_base64, payload.product_id);
  }

  sheet.getRange(rowIdx, 1, 1, 15).setValues([[
    payload.product_id,
    payload.name_en || existing.name_en,
    payload.name_lo !== undefined ? payload.name_lo : existing.name_lo,
    payload.name_th !== undefined ? payload.name_th : existing.name_th,
    payload.name_zh !== undefined ? payload.name_zh : existing.name_zh,
    payload.category_id !== undefined ? payload.category_id : existing.category_id,
    payload.barcode !== undefined ? payload.barcode : existing.barcode,
    payload.cost_price !== undefined ? parseFloat(payload.cost_price) : parseFloat(existing.cost_price),
    payload.sale_price !== undefined ? parseFloat(payload.sale_price) : parseFloat(existing.sale_price),
    payload.stock_qty !== undefined ? parseInt(payload.stock_qty) : parseInt(existing.stock_qty),
    payload.low_stock_threshold !== undefined ? parseInt(payload.low_stock_threshold) : parseInt(existing.low_stock_threshold),
    imageUrl,
    payload.is_active !== undefined ? payload.is_active : existing.is_active,
    existing.created_at,
    now,
  ]]);

  clearCache('products_all');
  clearCache('products_true');
  return { success: true, message: 'Product updated' };
}

function handleDeleteProduct(payload, user) {
  requireAdmin(user);
  var sheet = getSheet('Products');
  var rowIdx = findRow(sheet, 1, payload.product_id);
  if (rowIdx < 0) throw { message: 'Product not found', code: 404 };
  // Soft delete
  sheet.getRange(rowIdx, 13).setValue(false); // is_active = false
  sheet.getRange(rowIdx, 15).setValue(nowISO()); // updated_at
  clearCache('products_all');
  clearCache('products_true');
  return { success: true };
}

function _parseProductNumbers(p) {
  p.cost_price = parseFloat(p.cost_price) || 0;
  p.sale_price = parseFloat(p.sale_price) || 0;
  p.stock_qty  = parseInt(p.stock_qty) || 0;
  p.low_stock_threshold = parseInt(p.low_stock_threshold) || 10;
  return p;
}

function _validateProduct(payload) {
  if (!payload.name_en) throw { message: 'Product name (English) is required', code: 400 };
  if (payload.sale_price === undefined || payload.sale_price === '') throw { message: 'Sale price is required', code: 400 };
}

function _saveImageToDrive(base64DataUrl, productId) {
  try {
    var props = PropertiesService.getScriptProperties();
    var folderId = props.getProperty('IMAGES_FOLDER_ID');

    // Parse data URL
    var match = base64DataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) return '';
    var mimeType = match[1];
    var base64 = match[2];
    var ext = mimeType.split('/')[1] || 'jpg';

    var blob = Utilities.newBlob(Utilities.base64Decode(base64), mimeType, 'product_' + productId + '.' + ext);

    var folder = folderId ? DriveApp.getFolderById(folderId) : DriveApp.getRootFolder();
    var file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    return 'https://drive.google.com/uc?export=view&id=' + file.getId();
  } catch(e) {
    Logger.log('Image save error: ' + e.message);
    return '';
  }
}

// Categories
function handleGetCategories(params, user) {
  var cached = getCached('categories');
  if (cached) return cached;
  var sheet = getSheet('Categories');
  var cats = sheetToObjects(sheet);
  cats.sort(function(a, b) { return (parseInt(a.sort_order) || 0) - (parseInt(b.sort_order) || 0); });
  setCached('categories', cats, 120);
  return cats;
}

function handleCreateCategory(payload, user) {
  requireAdmin(user);
  var sheet = getSheet('Categories');
  var id = generateUUID();
  sheet.appendRow([id, payload.name_en, payload.name_lo||'', payload.name_th||'', payload.name_zh||'', payload.color||'#64748b', payload.icon||'📦', parseInt(payload.sort_order)||0, payload.is_active!==false, nowISO()]);
  clearCache('categories');
  return { category_id: id };
}

function handleUpdateCategory(payload, user) {
  requireAdmin(user);
  var sheet = getSheet('Categories');
  var rowIdx = findRow(sheet, 1, payload.category_id);
  if (rowIdx < 0) throw { message: 'Category not found', code: 404 };
  var cats = sheetToObjects(sheet);
  var ex = cats.find(function(c) { return c.category_id === payload.category_id; });
  sheet.getRange(rowIdx, 1, 1, 10).setValues([[
    payload.category_id,
    payload.name_en || ex.name_en,
    payload.name_lo !== undefined ? payload.name_lo : ex.name_lo,
    payload.name_th !== undefined ? payload.name_th : ex.name_th,
    payload.name_zh !== undefined ? payload.name_zh : ex.name_zh,
    payload.color || ex.color,
    payload.icon !== undefined ? payload.icon : ex.icon,
    payload.sort_order !== undefined ? parseInt(payload.sort_order) : parseInt(ex.sort_order),
    payload.is_active !== undefined ? payload.is_active : ex.is_active,
    ex.created_at,
  ]]);
  clearCache('categories');
  return { success: true };
}

function handleDeleteCategory(payload, user) {
  requireAdmin(user);
  var sheet = getSheet('Categories');
  var rowIdx = findRow(sheet, 1, payload.category_id);
  if (rowIdx < 0) throw { message: 'Category not found', code: 404 };
  sheet.deleteRow(rowIdx);
  clearCache('categories');
  return { success: true };
}
