/**
 * MiniPOS GAS Backend - Sales.gs
 * Sale creation (atomic with stock deduction) and retrieval
 */

/**
 * Create a sale — atomic: writes sale row, deducts stock, records stock history
 * Uses LockService to prevent race conditions
 */
function handleCreateSale(payload, user) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000); // Wait up to 10 seconds
  } catch(e) {
    throw { message: 'Server busy, please retry', code: 503 };
  }

  try {
    return _doCreateSale(payload, user);
  } finally {
    lock.releaseLock();
  }
}

function _doCreateSale(payload, user) {
  var items = payload.items || [];
  if (items.length === 0) throw { message: 'Cart is empty', code: 400 };

  var productsSheet = getSheet('Products');
  var salesSheet    = getSheet('Sales');
  var stockSheet    = getSheet('Stock');

  var allProducts  = sheetToObjects(productsSheet);
  var productMap   = {};
  var productRows  = {}; // product_id => row index

  allProducts.forEach(function(p, i) { productMap[p.product_id] = p; });

  // Find row indices for each product
  var productData = productsSheet.getDataRange().getValues();
  productData.forEach(function(row, idx) {
    if (idx > 0) productRows[row[0]] = idx + 1; // 1-indexed
  });

  // Validate stock availability
  items.forEach(function(item) {
    var p = productMap[item.product_id];
    if (!p) throw { message: 'Product not found: ' + item.product_id, code: 404 };
    if (p.stock_qty < item.qty) {
      throw { message: 'Insufficient stock for: ' + (p.name_en || p.product_id), code: 400 };
    }
  });

  var saleId = generateUUID();
  var now = nowISO();

  // Deduct stock + record history
  items.forEach(function(item) {
    var p = productMap[item.product_id];
    var qtyBefore = parseInt(p.stock_qty) || 0;
    var qtyAfter  = qtyBefore - item.qty;
    var rowIdx    = productRows[item.product_id];

    // Update stock_qty in Products sheet (column J = 10)
    if (rowIdx) {
      productsSheet.getRange(rowIdx, 10).setValue(qtyAfter);
      // Update updated_at (column O = 15)
      productsSheet.getRange(rowIdx, 15).setValue(now);
    }

    // Append to Stock history
    stockSheet.appendRow([
      generateUUID(),
      item.product_id,
      p.name_en || '',
      'sale',
      qtyBefore,
      -item.qty,
      qtyAfter,
      saleId,
      'Sale',
      user.user_id,
      now,
    ]);
  });

  // Calculate totals
  var subtotal       = parseFloat(payload.subtotal) || items.reduce(function(s, i) { return s + i.qty * i.unit_price; }, 0);
  var discountAmount = parseFloat(payload.discount_amount) || 0;
  var taxAmount      = parseFloat(payload.tax_amount) || 0;
  var total          = parseFloat(payload.total) || (subtotal - discountAmount + taxAmount);

  // Append sale row
  salesSheet.appendRow([
    saleId,
    payload.sale_date || now,
    user.user_id,
    payload.cashier_name || user.display_name,
    JSON.stringify(items),
    subtotal,
    payload.discount_type || 'percent',
    parseFloat(payload.discount_value) || 0,
    discountAmount,
    parseFloat(payload.tax_rate) || 0,
    taxAmount,
    total,
    payload.payment_type || 'cash',
    parseFloat(payload.received_amount) || total,
    parseFloat(payload.change_amount) || 0,
    true,
    false,
  ]);

  // Clear product cache
  clearCache('products_all');
  clearCache('products_true');

  return {
    sale_id: saleId,
    sale_date: now,
    total: total,
    change_amount: parseFloat(payload.change_amount) || 0,
    items: items,
    cashier_name: payload.cashier_name || user.display_name,
    subtotal: subtotal,
    discount_type: payload.discount_type,
    discount_value: payload.discount_value,
    discount_amount: discountAmount,
    tax_rate: payload.tax_rate,
    tax_amount: taxAmount,
    payment_type: payload.payment_type,
    received_amount: payload.received_amount,
  };
}

/**
 * Sync offline sales — processes an array of sales in sequence
 */
function handleSyncOfflineSales(payload, user) {
  var sales = payload.sales || [];
  var synced = 0;
  var errors = [];

  sales.forEach(function(saleData) {
    try {
      _doCreateSale(saleData, user);
      synced++;
    } catch(e) {
      errors.push({ error: e.message, sale: saleData });
    }
  });

  return { synced: synced, total: sales.length, errors: errors };
}

/**
 * Get list of sales (admin only)
 */
function handleGetSales(params, user) {
  requireAdmin(user);
  var sheet = getSheet('Sales');
  var sales = sheetToObjects(sheet);

  // Filter by date
  if (params.date_from) {
    var from = new Date(params.date_from);
    sales = sales.filter(function(s) { return new Date(s.sale_date) >= from; });
  }
  if (params.date_to) {
    var to = new Date(params.date_to + 'T23:59:59');
    sales = sales.filter(function(s) { return new Date(s.sale_date) <= to; });
  }
  if (params.cashier_id) {
    sales = sales.filter(function(s) { return s.cashier_id === params.cashier_id; });
  }

  // Parse items
  sales = sales.map(function(s) {
    try { s.items = JSON.parse(s.items_json || '[]'); } catch(e) { s.items = []; }
    s.items_count = s.items.length;
    return s;
  });

  return sales;
}

/**
 * Get single sale
 */
function handleGetSale(params, user) {
  requireAdmin(user);
  var sheet = getSheet('Sales');
  var sales = sheetToObjects(sheet);
  var sale = sales.find(function(s) { return s.sale_id === params.sale_id; });
  if (!sale) throw { message: 'Sale not found', code: 404 };
  try { sale.items = JSON.parse(sale.items_json || '[]'); } catch(e) { sale.items = []; }
  return sale;
}
