/**
 * MiniPOS GAS Backend - Code.gs
 * Main entry point: doGet + doPost router
 *
 * DEPLOYMENT SETTINGS:
 *   Execute as: Me (your Google account)
 *   Who has access: Anyone (not "Anyone with Google account")
 *
 * REQUIRED SCRIPT PROPERTIES (Project Settings > Script Properties):
 *   SHEET_ID = your Google Spreadsheet ID
 *   SECRET_SALT = (auto-generated on first run)
 *   IMAGES_FOLDER_ID = (optional) Google Drive folder ID for product images
 */

// ─── GET Handler ──────────────────────────────────────────
function doGet(e) {
  try {
    var params = e.parameter || {};
    var action = params.action;

    if (!action) {
      return respondOk({ message: 'MiniPOS API v1.0 — use action parameter' });
    }

    // Public endpoints (no auth required)
    if (action === 'ping') {
      return respondOk({ pong: true, time: nowISO() });
    }

    // Auth required for all other actions
    var user = null;
    if (action !== 'login') {
      var token = params.token;
      user = validateToken(token);
      if (!user) {
        return respondError('Unauthorized', 401);
      }
    }

    switch (action) {
      case 'validateToken':      return respondOk(handleValidateToken(params, user));
      case 'login':             return respondOk(handleLogin(params));
      case 'getProducts':        return respondOk(handleGetProducts(params, user));
      case 'getProduct':         return respondOk(handleGetProduct(params, user));
      case 'getProductByBarcode':return respondOk(handleGetProductByBarcode(params, user));
      case 'getCategories':      return respondOk(handleGetCategories(params, user));
      case 'getSales':           return respondOk(handleGetSales(params, user));
      case 'getSale':            return respondOk(handleGetSale(params, user));
      case 'getStockHistory':    return respondOk(handleGetStockHistory(params, user));
      case 'getLowStockProducts':return respondOk(handleGetLowStockProducts(params, user));
      case 'getNextBarcode':     return respondOk(handleGetNextBarcode(params, user));
      case 'checkBarcodeExists': return respondOk(handleCheckBarcodeExists(params, user));
      case 'getDailySalesReport':   return respondOk(handleGetDailySalesReport(params, user));
      case 'getMonthlySalesReport': return respondOk(handleGetMonthlySalesReport(params, user));
      case 'getProfitReport':       return respondOk(handleGetProfitReport(params, user));
      case 'getBestSellingProducts':return respondOk(handleGetBestSellingProducts(params, user));
      case 'getStockSummaryReport': return respondOk(handleGetStockSummaryReport(params, user));
      case 'getSettings':        return respondOk(handleGetSettings(params, user));
      case 'getUsers':           return respondOk(handleGetUsers(user));
      default:
        return respondError('Unknown action: ' + action, 404);
    }
  } catch(err) {
    Logger.log('[doGet] Error: ' + err.message + ' | Stack: ' + err.stack);
    return respondError(err.message || 'Internal server error', err.code || 500);
  }
}

// ─── POST Handler ─────────────────────────────────────────
function doPost(e) {
  try {
    var body;
    try {
      body = JSON.parse(e.postData.contents);
    } catch(parseErr) {
      return respondError('Invalid JSON body', 400);
    }

    var action  = body.action;
    var token   = body.token;
    var payload = body.payload || {};

    if (!action) return respondError('action is required', 400);

    // Login is public
    if (action === 'login') {
      return respondOk(handleLogin(payload));
    }

    // All other POST actions require auth
    var user = validateToken(token);
    if (!user) return respondError('Unauthorized', 401);

    switch (action) {
      case 'logout':                return respondOk({ success: true });
      case 'createProduct':         return respondOk(handleCreateProduct(payload, user));
      case 'updateProduct':         return respondOk(handleUpdateProduct(payload, user));
      case 'deleteProduct':         return respondOk(handleDeleteProduct(payload, user));
      case 'createCategory':        return respondOk(handleCreateCategory(payload, user));
      case 'updateCategory':        return respondOk(handleUpdateCategory(payload, user));
      case 'deleteCategory':        return respondOk(handleDeleteCategory(payload, user));
      case 'createSale':            return respondOk(handleCreateSale(payload, user));
      case 'syncOfflineSales':      return respondOk(handleSyncOfflineSales(payload, user));
      case 'adjustStock':           return respondOk(handleAdjustStock(payload, user));
      case 'reserveBarcodes':       return respondOk(handleReserveBarcodes(payload, user));
      case 'updateSettings':        return respondOk(handleUpdateSettings(payload, user));
      case 'updateSettingsMultiple':return respondOk(handleUpdateSettingsMultiple(payload, user));
      case 'createUser':            return respondOk(handleCreateUser(payload, user));
      case 'updateUser':            return respondOk(handleUpdateUser(payload, user));
      case 'deleteUser':            return respondOk(handleDeleteUser(payload, user));
      default:
        return respondError('Unknown action: ' + action, 404);
    }
  } catch(err) {
    Logger.log('[doPost] Error: ' + err.message + ' | Stack: ' + (err.stack || ''));
    return respondError(err.message || 'Internal server error', err.code || 500);
  }
}

// ─── CORS Preflight ───────────────────────────────────────
// GAS handles CORS automatically for "Anyone" access.
// If you have issues, add this OPTIONS handler:
function doOptions(e) {
  return ContentService.createTextOutput('')
    .setMimeType(ContentService.MimeType.TEXT);
}
