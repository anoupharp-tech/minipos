/**
 * MiniPOS GAS Backend - Reports.gs
 * Report aggregations: daily, monthly, profit, best selling, stock summary
 */

/**
 * Daily sales report for a given date
 */
function handleGetDailySalesReport(params, user) {
  requireAdmin(user);
  var date = params.date || Utilities.formatDate(new Date(), 'UTC', 'yyyy-MM-dd');
  var dateStart = new Date(date + 'T00:00:00.000Z');
  var dateEnd   = new Date(date + 'T23:59:59.999Z');

  var salesSheet = getSheet('Sales');
  var sales = sheetToObjects(salesSheet);

  var daySales = sales.filter(function(s) {
    var d = new Date(s.sale_date);
    return d >= dateStart && d <= dateEnd;
  });

  var totalRevenue = 0, totalCost = 0, totalItemsSold = 0;
  var byPaymentType = {};
  var byCategoryMap = {};
  var transactions = [];

  daySales.forEach(function(s) {
    var total = parseFloat(s.total) || 0;
    totalRevenue += total;

    var items = [];
    try { items = JSON.parse(s.items_json || '[]'); } catch(e) {}

    var itemsCount = 0;
    items.forEach(function(item) {
      var qty = parseInt(item.qty) || 0;
      totalItemsSold += qty;
      itemsCount += qty;
      totalCost += (parseFloat(item.cost_price) || 0) * qty;
    });

    // Group by payment type
    var pt = s.payment_type || 'cash';
    byPaymentType[pt] = (byPaymentType[pt] || 0) + total;

    transactions.push({
      sale_id: s.sale_id,
      sale_date: s.sale_date,
      cashier_name: s.cashier_name,
      total: total,
      payment_type: pt,
      items_count: itemsCount,
    });
  });

  return {
    date: date,
    total_transactions: daySales.length,
    total_items_sold: totalItemsSold,
    total_revenue: totalRevenue,
    total_cost: totalCost,
    total_profit: totalRevenue - totalCost,
    by_payment_type: byPaymentType,
    by_category: [],
    transactions: transactions,
  };
}

/**
 * Monthly sales report
 */
function handleGetMonthlySalesReport(params, user) {
  requireAdmin(user);
  var year  = parseInt(params.year)  || new Date().getFullYear();
  var month = parseInt(params.month) || (new Date().getMonth() + 1);

  var monthStart = new Date(year, month - 1, 1);
  var monthEnd   = new Date(year, month, 0, 23, 59, 59);

  var salesSheet = getSheet('Sales');
  var sales = sheetToObjects(salesSheet);

  var monthSales = sales.filter(function(s) {
    var d = new Date(s.sale_date);
    return d >= monthStart && d <= monthEnd;
  });

  // Group by day
  var byDay = {};
  var totalRevenue = 0;

  monthSales.forEach(function(s) {
    var d = new Date(s.sale_date);
    var dayKey = Utilities.formatDate(d, 'UTC', 'yyyy-MM-dd');
    var total = parseFloat(s.total) || 0;
    if (!byDay[dayKey]) byDay[dayKey] = { date: dayKey, revenue: 0, transactions: 0 };
    byDay[dayKey].revenue += total;
    byDay[dayKey].transactions++;
    totalRevenue += total;
  });

  var dailyBreakdown = Object.values(byDay).sort(function(a, b) { return a.date.localeCompare(b.date); });
  var daysInMonth = Object.keys(byDay).length || 1;

  return {
    year: year,
    month: month,
    total_transactions: monthSales.length,
    total_revenue: totalRevenue,
    avg_daily_revenue: totalRevenue / daysInMonth,
    daily_breakdown: dailyBreakdown,
  };
}

/**
 * Profit report for a date range
 */
function handleGetProfitReport(params, user) {
  requireAdmin(user); // Strict: admin only

  var salesSheet = getSheet('Sales');
  var sales = sheetToObjects(salesSheet);

  if (params.date_from) {
    var from = new Date(params.date_from);
    sales = sales.filter(function(s) { return new Date(s.sale_date) >= from; });
  }
  if (params.date_to) {
    var to = new Date(params.date_to + 'T23:59:59');
    sales = sales.filter(function(s) { return new Date(s.sale_date) <= to; });
  }

  var totalRevenue = 0, totalCost = 0;

  sales.forEach(function(s) {
    totalRevenue += parseFloat(s.total) || 0;
    var items = [];
    try { items = JSON.parse(s.items_json || '[]'); } catch(e) {}
    items.forEach(function(item) {
      totalCost += (parseFloat(item.cost_price) || 0) * (parseInt(item.qty) || 0);
    });
  });

  var grossProfit = totalRevenue - totalCost;
  var margin = totalRevenue > 0 ? (grossProfit / totalRevenue * 100) : 0;

  return {
    total_transactions: sales.length,
    total_revenue: totalRevenue,
    total_cost: totalCost,
    gross_profit: grossProfit,
    profit_margin: margin,
  };
}

/**
 * Best selling products
 */
function handleGetBestSellingProducts(params, user) {
  requireAdmin(user);
  var salesSheet = getSheet('Sales');
  var sales = sheetToObjects(salesSheet);

  if (params.date_from) {
    var from = new Date(params.date_from);
    sales = sales.filter(function(s) { return new Date(s.sale_date) >= from; });
  }
  if (params.date_to) {
    var to = new Date(params.date_to + 'T23:59:59');
    sales = sales.filter(function(s) { return new Date(s.sale_date) <= to; });
  }

  var productStats = {};

  sales.forEach(function(s) {
    var items = [];
    try { items = JSON.parse(s.items_json || '[]'); } catch(e) {}
    items.forEach(function(item) {
      var pid = item.product_id;
      if (!productStats[pid]) {
        productStats[pid] = { product_id: pid, product_name: item.name || '', qty_sold: 0, revenue: 0 };
      }
      productStats[pid].qty_sold += parseInt(item.qty) || 0;
      productStats[pid].revenue  += (parseFloat(item.unit_price) || 0) * (parseInt(item.qty) || 0);
    });
  });

  var limit = parseInt(params.limit) || 10;
  return Object.values(productStats)
    .sort(function(a, b) { return b.qty_sold - a.qty_sold; })
    .slice(0, limit);
}

/**
 * Stock summary report
 */
function handleGetStockSummaryReport(params, user) {
  requireAdmin(user);
  var sheet = getSheet('Products');
  var products = sheetToObjects(sheet);

  var active = products.filter(function(p) { return p.is_active !== false && p.is_active !== 'FALSE'; });
  var lowStock  = 0, outOfStock = 0, totalValue = 0;

  active.forEach(function(p) {
    var qty = parseInt(p.stock_qty) || 0;
    var threshold = parseInt(p.low_stock_threshold) || 10;
    var costPrice = parseFloat(p.cost_price) || 0;
    if (qty === 0) outOfStock++;
    else if (qty <= threshold) lowStock++;
    totalValue += qty * costPrice;
  });

  return {
    total_products: active.length,
    low_stock_count: lowStock,
    out_of_stock: outOfStock,
    in_stock: active.length - outOfStock,
    total_stock_value: totalValue,
  };
}
