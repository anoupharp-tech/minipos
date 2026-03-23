/**
 * MiniPOS GAS Backend - Barcodes.gs
 * Barcode generation, uniqueness tracking
 */

/**
 * Get next available barcode number (auto-increments sequence)
 */
function handleGetNextBarcode(params, user) {
  requireAdmin(user);
  var barcodeType = params.type || 'CODE128';

  var lock = LockService.getScriptLock();
  try { lock.waitLock(5000); } catch(e) { throw { message: 'Server busy', code: 503 }; }

  try {
    var settingsSheet = getSheet('Settings');
    var settings = sheetToObjects(settingsSheet);
    var seqRow = settings.find(function(s) { return s.setting_key === 'next_barcode_seq'; });
    var prefixRow = settings.find(function(s) { return s.setting_key === 'barcode_prefix'; });

    var seq    = parseInt(seqRow ? seqRow.setting_value : 1) || 1;
    var prefix = (prefixRow ? prefixRow.setting_value : '20') || '20';

    var barcodeValue;
    if (barcodeType === 'EAN13') {
      var base12 = (prefix + String(seq).padStart(10, '0')).slice(0, 12);
      barcodeValue = base12 + _ean13Check(base12);
    } else {
      // CODE128 - alphanumeric
      barcodeValue = 'BC' + String(seq).padStart(8, '0');
    }

    // Increment sequence in Settings
    var seqRowIdx = findRow(settingsSheet, 1, 'next_barcode_seq');
    if (seqRowIdx > 0) {
      settingsSheet.getRange(seqRowIdx, 2).setValue(seq + 1);
      settingsSheet.getRange(seqRowIdx, 3).setValue(nowISO());
    }

    // Record in Barcodes sheet
    var bcSheet = getSheet('Barcodes');
    bcSheet.appendRow([
      generateUUID(),
      barcodeValue,
      barcodeType,
      '',
      false,
      nowISO(),
      '',
    ]);

    clearCache('settings');

    return { barcode_value: barcodeValue, barcode_type: barcodeType };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Reserve multiple barcodes at once
 */
function handleReserveBarcodes(payload, user) {
  requireAdmin(user);
  var count = parseInt(payload.count) || 1;
  var barcodeType = payload.type || 'CODE128';
  count = Math.min(count, 100); // Max 100 at once

  var results = [];
  for (var i = 0; i < count; i++) {
    results.push(handleGetNextBarcode({ type: barcodeType }, user));
  }
  return results;
}

/**
 * Check if barcode already exists in Products sheet
 */
function handleCheckBarcodeExists(params, user) {
  requireAdmin(user);
  var barcode = params.barcode;
  if (!barcode) throw { message: 'barcode required', code: 400 };

  var sheet = getSheet('Products');
  var products = sheetToObjects(sheet);
  var match = products.find(function(p) { return p.barcode === barcode; });

  return { exists: !!match, product_id: match ? match.product_id : null };
}

/**
 * Calculate EAN-13 check digit
 */
function _ean13Check(digits12) {
  var sum = 0;
  for (var i = 0; i < 12; i++) {
    sum += parseInt(digits12[i]) * (i % 2 === 0 ? 1 : 3);
  }
  return String((10 - (sum % 10)) % 10);
}
