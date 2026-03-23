/**
 * MiniPOS - sync.js
 * Offline sync queue management
 * Queues sales when offline, drains queue on reconnect
 */
'use strict';

const Sync = (() => {
  let _syncing = false;

  /** Queue a sale for offline sync */
  async function enqueueSale(saleData) {
    const record = {
      ...saleData,
      queued_at: new Date().toISOString(),
      created_offline: true,
    };
    await DB.pendingSales.add(record);
    await _updateBadge();
    console.log('[Sync] Sale queued offline');
  }

  /** Drain the pending queue when online */
  async function syncPendingSales() {
    if (_syncing || !navigator.onLine) return;
    const pending = await DB.pendingSales.getAll();
    if (pending.length === 0) return;

    _syncing = true;
    console.log(`[Sync] Syncing ${pending.length} pending sales...`);

    try {
      // Send all pending sales to GAS
      const salesPayload = pending.map(s => ({ ...s, local_id: undefined }));
      const result = await API.sales.syncOffline(salesPayload);

      // Remove successfully synced sales from queue
      let syncedCount = 0;
      for (const sale of pending) {
        await DB.pendingSales.delete(sale.local_id);
        syncedCount++;
      }

      await _updateBadge();
      if (syncedCount > 0) {
        Utils.toast(I18n.t('sync_complete') || `${syncedCount} sales synced`, 'success');
      }
      console.log(`[Sync] Synced ${syncedCount} sales`);
    } catch(e) {
      console.error('[Sync] Failed to sync:', e);
    } finally {
      _syncing = false;
    }
  }

  async function _updateBadge() {
    const count = await DB.pendingSales.count();
    AppState.set('pendingSalesCount', count);
    // Register background sync if supported
    if (count > 0 && 'serviceWorker' in navigator) {
      try {
        const reg = await navigator.serviceWorker.ready;
        if (reg.sync) await reg.sync.register('sync-pending-sales');
      } catch(e) {}
    }
  }

  async function getPendingCount() {
    return DB.pendingSales.count();
  }

  /** Initialize sync listeners */
  function init() {
    // Sync when coming back online
    window.addEventListener('online', () => {
      console.log('[Sync] Back online, syncing...');
      setTimeout(syncPendingSales, 1000);
    });

    // Listen for SW message to trigger sync
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (e) => {
        if (e.data?.type === 'SYNC_PENDING_SALES') syncPendingSales();
      });
    }

    // Initial check
    _updateBadge();
  }

  return { enqueueSale, syncPendingSales, getPendingCount, init };
})();
