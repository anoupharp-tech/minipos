/**
 * MiniPOS GAS Backend - Stock.gs
 * Stock management: adjustments, history, low stock queries
 */

/**
 * Manually adjust stock for a product
 */
function handleAdjustStock(payload, user) {
  requireAdmin(user);
  if (!payload.product_id) throw { message: 'product_id required', code: 400 };
  if (payload.qty_change === undefined) throw { message: 'qty_change required', code: 400 };

  var lock = LockService.getScriptLock();
  try { lock.waitLock(10000); } catch(e) { throw { message: 'Server busy', code: 503 }; }

  try {
    var productsSheet = getSheet('Products');
    var stockSheet    = getSheet('Stock');

    var products = sheetToObjects(productsSheet);
    var product  = products.find(function(p) { return p.product_id === payload.product_id; });
    if (!product) throw { message: 'Product not found', code: 404 };

    var qtyBefore = parseInt(product.stock_qty) || 0;
    var qtyChange = parseInt(payload.qty_change);
    var qtyAfter  = qtyBefore + qtyChange;

    if (qtyAfter < 0) throw { message: 'Stock would go negative (' + qtyAfter + ')', code: 400 };

    // Update product stock
    var rowIdx = findRow(productsSheet, 1, payload.product_id);
    if (rowIdx > 0) {
      productsSheet.getRange(rowIdx, 10).setValue(qtyAfter);
      productsSheet.getRange(rowIdx, 15).setValue(nowISO());
    }

    // Record in Stock history
    var changeType = qtyChange > 0 ? 'manual_add' : 'manual_remove';
    if (payload.change_type) changeType = payload.change_type;

    stockSheet.appendRow([
      generateUUID(),
      payload.product_id,
      product.name_en || '',
      changeType,
      qtyBefore,
      qtyChange,
      qtyAfter,
      '',
      payload.note || '',
      user.user_id,
      nowISO(),
    ]);

    clearCache('products_all');
    clearCache('products_true');

    return { product_id: payload.product_id, qty_before: qtyBefore, qty_change: qtyChange, qty_after: qtyAfter };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Get stock history, optionally filtered
 */
function handleGetStockHistory(params, user) {
  requireAdmin(user);
  var sheet = getSheet('Stock');
  var history = sheetToObjects(sheet);

  if (params.product_id) {
    history = history.filter(function(h) { return h.product_id === params.product_id; });
  }
  if (params.date_from) {
    var from = new Date(params.date_from);
    history = history.filter(function(h) { return new Date(h.created_at) >= from; });
  }
  if (params.date_to) {
    var to = new Date(params.date_to + 'T23:59:59');
    history = history.filter(function(h) { return new Date(h.created_at) <= to; });
  }
  if (params.change_type) {
    history = history.filter(function(h) { return h.change_type === params.change_type; });
  }

  // Sort newest first
  history.sort(function(a, b) { return new Date(b.created_at) - new Date(a.created_at); });

  // Limit
  var limit = parseInt(params.limit) || 500;
  return history.slice(0, limit);
}

/**
 * Get products below their low stock threshold
 */
function handleGetLowStockProducts(params, user) {
  var sheet = getSheet('Products');
  var products = sheetToObjects(sheet);

  return products
    .filter(function(p) {
      if (p.is_active === false || p.is_active === 'FALSE') return false;
      var qty = parseInt(p.stock_qty) || 0;
      var threshold = parseInt(p.low_stock_threshold) || 10;
      return qty <= threshold; // Includes 0 (out of stock)
    })
    .map(function(p) {
      return {
        product_id: p.product_id,
        product_name: p.name_en,
        name_lo: p.name_lo,
        name_th: p.name_th,
        name_zh: p.name_zh,
        stock_qty: parseInt(p.stock_qty) || 0,
        low_stock_threshold: parseInt(p.low_stock_threshold) || 10,
      };
    })
    .sort(function(a, b) { return a.stock_qty - b.stock_qty });
}
