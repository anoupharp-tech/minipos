/**
 * MiniPOS - views/reports.js
 * Reports: daily, monthly, profit, best selling, stock summary
 */
'use strict';

const ReportsView = (() => {
  let _activeReport = 'daily';
  let _chartInstances = [];

  async function render(container) {
    container.innerHTML = _html();
    _bindEvents(container);
    await _loadReport();
  }

  function _html() {
    const today = Utils.todayISO();
    const now   = new Date();
    return `
      <div class="section-header">
        <h2 class="section-title" data-i18n="reports">Reports</h2>
        <button class="btn btn-ghost" id="btn-export-csv">📥 ${I18n.t('export_csv')}</button>
      </div>

      <!-- Report Tabs -->
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:20px">
        ${['daily','monthly','profit','best_selling','stock_summary'].map(t => `
          <button class="btn btn-${t === _activeReport ? 'primary' : 'ghost'}" data-report="${t}">
            ${I18n.t(t === 'best_selling' ? 'best_selling' : t === 'stock_summary' ? 'stock_summary' : t + '_sales' in TRANSLATIONS.en ? t + '_sales' : t)}
          </button>
        `).join('')}
      </div>

      <!-- Date Filters -->
      <div class="filter-bar mb-4" id="report-filters">
        <div id="daily-filter" class="${_activeReport !== 'daily' ? 'hidden' : ''}">
          <label style="font-size:13px;font-weight:600">${I18n.t('date')}</label>
          <input type="date" class="form-control" id="filter-date" value="${today}" style="width:auto">
        </div>
        <div id="monthly-filter" class="${_activeReport !== 'monthly' ? 'hidden' : ''}">
          <input type="month" class="form-control" id="filter-month" value="${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}" style="width:auto">
        </div>
        <div id="range-filter" class="${!['profit','best_selling'].includes(_activeReport) ? 'hidden' : ''}">
          <input type="date" class="form-control" id="filter-from" value="${today.slice(0,8)}01" style="width:auto">
          <span style="padding:0 4px">—</span>
          <input type="date" class="form-control" id="filter-to" value="${today}" style="width:auto">
        </div>
        <button class="btn btn-primary" id="btn-load-report">🔍 ${I18n.t('filter')}</button>
      </div>

      <!-- Report Content -->
      <div id="report-content">
        <div class="loading-screen"><div class="spinner"></div></div>
      </div>
    `;

    // Fix tab labels
    setTimeout(() => {
      const tabs = document.querySelectorAll('[data-report]');
      const labels = {
        daily: I18n.t('daily_sales'),
        monthly: I18n.t('monthly_sales'),
        profit: I18n.t('profit_report'),
        best_selling: I18n.t('best_selling'),
        stock_summary: I18n.t('stock_summary'),
      };
      tabs.forEach(t => t.textContent = labels[t.dataset.report] || t.dataset.report);
    }, 0);
  }

  function _bindEvents(container) {
    // Tab switch
    container.querySelector('[data-report]')?.parentElement?.addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-report]');
      if (!btn) return;
      _activeReport = btn.dataset.report;

      // Update tab buttons
      document.querySelectorAll('[data-report]').forEach(b => {
        b.className = 'btn btn-' + (b.dataset.report === _activeReport ? 'primary' : 'ghost');
      });

      // Show/hide filters
      document.getElementById('daily-filter')?.classList.toggle('hidden', _activeReport !== 'daily');
      document.getElementById('monthly-filter')?.classList.toggle('hidden', _activeReport !== 'monthly');
      document.getElementById('range-filter')?.classList.toggle('hidden', !['profit','best_selling'].includes(_activeReport));

      await _loadReport();
    });

    container.querySelector('#btn-load-report')?.addEventListener('click', _loadReport);
    container.querySelector('#btn-export-csv')?.addEventListener('click', _exportCSV);
  }

  async function _loadReport() {
    const content = document.getElementById('report-content');
    if (!content) return;
    content.innerHTML = `<div class="loading-screen"><div class="spinner"></div></div>`;

    // Destroy previous chart instances
    _chartInstances.forEach(c => c.destroy());
    _chartInstances = [];

    try {
      if (_activeReport === 'daily')        await _renderDaily(content);
      if (_activeReport === 'monthly')      await _renderMonthly(content);
      if (_activeReport === 'profit')       await _renderProfit(content);
      if (_activeReport === 'best_selling') await _renderBestSelling(content);
      if (_activeReport === 'stock_summary') await _renderStockSummary(content);
    } catch(e) {
      content.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⚠️</div><div>${e.message}</div></div>`;
    }
  }

  async function _renderDaily(content) {
    const date = document.getElementById('filter-date')?.value || Utils.todayISO();
    const data = await API.reports.daily(date);

    const currency = AppState.get('settings')?.currency_symbol || '₭';
    const fmt = (n) => Utils.formatCurrency(n, currency);

    content.innerHTML = `
      <div class="stat-cards">
        <div class="stat-card"><div class="stat-icon">🧾</div><div class="stat-label">${I18n.t('transactions')}</div><div class="stat-value">${data.total_transactions || 0}</div></div>
        <div class="stat-card"><div class="stat-icon">📦</div><div class="stat-label">${I18n.t('items_sold')}</div><div class="stat-value">${data.total_items_sold || 0}</div></div>
        <div class="stat-card"><div class="stat-icon">💰</div><div class="stat-label">${I18n.t('total_revenue')}</div><div class="stat-value" style="color:var(--color-primary)">${fmt(data.total_revenue || 0)}</div></div>
        <div class="stat-card"><div class="stat-icon">📈</div><div class="stat-label">${I18n.t('total_profit')}</div><div class="stat-value" style="color:var(--color-success)">${fmt(data.total_profit || 0)}</div></div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:8px">
        <div class="card">
          <h4 class="font-bold mb-3">${I18n.t('by_payment')}</h4>
          <canvas id="chart-payment" height="200"></canvas>
        </div>
        <div class="card">
          <h4 class="font-bold mb-3">${I18n.t('by_category')}</h4>
          <canvas id="chart-category" height="200"></canvas>
        </div>
      </div>

      <div class="card mt-4">
        <h4 class="font-bold mb-3">${I18n.t('transactions')}</h4>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Time</th><th>${I18n.t('items_sold')}</th><th>${I18n.t('total')}</th><th>${I18n.t('payment')}</th><th>${I18n.t('cashier')}</th></tr></thead>
            <tbody>
              ${(data.transactions || []).map(t => `
                <tr>
                  <td>${Utils.formatDateTime(t.sale_date)}</td>
                  <td>${t.items_count || 0}</td>
                  <td>${fmt(t.total)}</td>
                  <td>${t.payment_type}</td>
                  <td>${Utils.escapeHtml(t.cashier_name || '')}</td>
                </tr>
              `).join('') || `<tr><td colspan="5"><div class="empty-state">${I18n.t('no_data')}</div></td></tr>`}
            </tbody>
          </table>
        </div>
      </div>
    `;

    // Charts
    if (typeof Chart !== 'undefined') {
      _renderPaymentChart(data.by_payment_type || {});
      _renderCategoryChart(data.by_category || []);
    }
  }

  async function _renderMonthly(content) {
    const [year, month] = (document.getElementById('filter-month')?.value || Utils.todayISO().slice(0,7)).split('-');
    const data = await API.reports.monthly(year, month);
    const currency = AppState.get('settings')?.currency_symbol || '₭';
    const fmt = (n) => Utils.formatCurrency(n, currency);

    content.innerHTML = `
      <div class="stat-cards">
        <div class="stat-card"><div class="stat-icon">🧾</div><div class="stat-label">${I18n.t('transactions')}</div><div class="stat-value">${data.total_transactions || 0}</div></div>
        <div class="stat-card"><div class="stat-icon">💰</div><div class="stat-label">${I18n.t('total_revenue')}</div><div class="stat-value" style="color:var(--color-primary)">${fmt(data.total_revenue || 0)}</div></div>
        <div class="stat-card"><div class="stat-icon">📅</div><div class="stat-label">Avg Daily</div><div class="stat-value">${fmt(data.avg_daily_revenue || 0)}</div></div>
      </div>
      <div class="card mt-4">
        <h4 class="font-bold mb-3">Daily Breakdown</h4>
        <canvas id="chart-monthly" height="120"></canvas>
      </div>
    `;

    if (typeof Chart !== 'undefined' && data.daily_breakdown) {
      const labels = data.daily_breakdown.map(d => d.date);
      const values = data.daily_breakdown.map(d => d.revenue);
      const ctx = document.getElementById('chart-monthly');
      if (ctx) {
        const c = new Chart(ctx, {
          type: 'bar',
          data: { labels, datasets: [{ label: I18n.t('revenue'), data: values, backgroundColor: '#4f46e5' }] },
          options: { responsive: true, plugins: { legend: { display: false } } }
        });
        _chartInstances.push(c);
      }
    }
  }

  async function _renderProfit(content) {
    const from = document.getElementById('filter-from')?.value;
    const to   = document.getElementById('filter-to')?.value;
    const data = await API.reports.profit(from, to);
    const currency = AppState.get('settings')?.currency_symbol || '₭';
    const fmt = (n) => Utils.formatCurrency(n, currency);
    const margin = data.total_revenue > 0 ? ((data.gross_profit / data.total_revenue) * 100).toFixed(1) : 0;

    content.innerHTML = `
      <div class="stat-cards">
        <div class="stat-card"><div class="stat-icon">💰</div><div class="stat-label">${I18n.t('revenue')}</div><div class="stat-value" style="color:var(--color-primary)">${fmt(data.total_revenue || 0)}</div></div>
        <div class="stat-card"><div class="stat-icon">📦</div><div class="stat-label">${I18n.t('cost')}</div><div class="stat-value">${fmt(data.total_cost || 0)}</div></div>
        <div class="stat-card"><div class="stat-icon">📈</div><div class="stat-label">${I18n.t('profit')}</div><div class="stat-value" style="color:var(--color-success)">${fmt(data.gross_profit || 0)}</div></div>
        <div class="stat-card"><div class="stat-icon">%</div><div class="stat-label">${I18n.t('profit_margin')}</div><div class="stat-value">${margin}%</div></div>
      </div>
    `;
  }

  async function _renderBestSelling(content) {
    const from = document.getElementById('filter-from')?.value;
    const to   = document.getElementById('filter-to')?.value;
    const data = await API.reports.bestSelling(from, to, 20);
    const currency = AppState.get('settings')?.currency_symbol || '₭';
    const fmt = (n) => Utils.formatCurrency(n, currency);

    content.innerHTML = `
      <div class="table-wrap">
        <table>
          <thead><tr><th>${I18n.t('rank')}</th><th>${I18n.t('product')}</th><th>${I18n.t('items_sold')}</th><th>${I18n.t('revenue')}</th></tr></thead>
          <tbody>
            ${(data || []).map((p, i) => `
              <tr>
                <td><strong>${i + 1}</strong></td>
                <td>${Utils.escapeHtml(p.product_name || '')}</td>
                <td>${p.qty_sold}</td>
                <td>${fmt(p.revenue)}</td>
              </tr>
            `).join('') || `<tr><td colspan="4"><div class="empty-state">${I18n.t('no_data')}</div></td></tr>`}
          </tbody>
        </table>
      </div>
    `;
  }

  async function _renderStockSummary(content) {
    const data = await API.reports.stockSummary();
    const currency = AppState.get('settings')?.currency_symbol || '₭';
    const fmt = (n) => Utils.formatCurrency(n, currency);

    content.innerHTML = `
      <div class="stat-cards">
        <div class="stat-card"><div class="stat-icon">📦</div><div class="stat-label">Total Products</div><div class="stat-value">${data.total_products || 0}</div></div>
        <div class="stat-card"><div class="stat-icon">⚠️</div><div class="stat-label">Low Stock</div><div class="stat-value" style="color:var(--color-warning)">${data.low_stock_count || 0}</div></div>
        <div class="stat-card"><div class="stat-icon">❌</div><div class="stat-label">Out of Stock</div><div class="stat-value" style="color:var(--color-danger)">${data.out_of_stock || 0}</div></div>
        <div class="stat-card"><div class="stat-icon">💰</div><div class="stat-label">Stock Value</div><div class="stat-value" style="color:var(--color-primary)">${fmt(data.total_stock_value || 0)}</div></div>
      </div>
    `;
  }

  function _renderPaymentChart(byPayment) {
    const ctx = document.getElementById('chart-payment');
    if (!ctx) return;
    const labels = Object.keys(byPayment);
    const values = Object.values(byPayment);
    const c = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{ data: values, backgroundColor: ['#22c55e','#3b82f6','#0891b2','#4f46e5'] }]
      },
      options: { responsive: true }
    });
    _chartInstances.push(c);
  }

  function _renderCategoryChart(byCategory) {
    const ctx = document.getElementById('chart-category');
    if (!ctx || !byCategory.length) return;
    const c = new Chart(ctx, {
      type: 'pie',
      data: {
        labels: byCategory.map(c => c.category_name),
        datasets: [{ data: byCategory.map(c => c.revenue), backgroundColor: ['#4f46e5','#0891b2','#22c55e','#f97316','#ec4899','#8b5cf6'] }]
      },
      options: { responsive: true }
    });
    _chartInstances.push(c);
  }

  function _exportCSV() {
    // Simple export of whatever is in the table
    const tables = document.querySelectorAll('#report-content table');
    if (!tables.length) return;
    const rows = [];
    tables[0].querySelectorAll('tr').forEach(tr => {
      const cells = [...tr.querySelectorAll('th,td')].map(td => '"' + td.textContent.trim().replace(/"/g,'""') + '"');
      rows.push(cells.join(','));
    });
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `report_${_activeReport}_${Utils.todayISO()}.csv`;
    a.click();
  }

  function destroy() {
    _chartInstances.forEach(c => c.destroy());
    _chartInstances = [];
  }

  return { render, destroy };
})();
