/**
 * MiniPOS - scanner.js
 * Barcode scanner: USB HID keyboard + mobile camera
 */
'use strict';

const Scanner = (() => {
  let _buffer = '';
  let _lastKeyTime = 0;
  let _cameraScanner = null;
  let _usbEnabled = false;
  const GAP_MS = 100; // Max ms between scanner keystrokes (humans type slower)
  const MIN_LEN = 3;  // Minimum barcode length

  /** Dispatch barcode detected event */
  function _emit(barcode) {
    barcode = barcode.trim();
    if (barcode.length < MIN_LEN) return;
    console.log('[Scanner] Barcode detected:', barcode);
    document.dispatchEvent(new CustomEvent('barcode:detected', { detail: { barcode } }));
  }

  /** Initialize USB HID scanner listener (global keydown) */
  function initUSB() {
    if (_usbEnabled) return;
    _usbEnabled = true;

    document.addEventListener('keydown', (e) => {
      // Ignore if user is focused on an input (except scanner search input)
      const active = document.activeElement;
      const isInput = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA');
      const isScannerInput = active && active.id === 'pos-search-input';

      const now = Date.now();
      const gap = now - _lastKeyTime;

      // Reset buffer if gap is too large (human typing)
      if (gap > GAP_MS && _buffer.length > 0) {
        _buffer = '';
      }

      _lastKeyTime = now;

      if (e.key === 'Enter') {
        if (_buffer.length >= MIN_LEN) {
          _emit(_buffer);
          _buffer = '';
          if (!isScannerInput) e.preventDefault();
        }
        return;
      }

      // Only collect printable single chars from scanner
      if (e.key.length === 1) {
        // Scanner fires chars in rapid succession (< GAP_MS between each)
        if (gap < GAP_MS || _buffer.length > 0) {
          _buffer += e.key;
          if (!isInput && !isScannerInput) e.preventDefault();
        }
      }
    });

    console.log('[Scanner] USB HID listener initialized');
  }

  /** Initialize camera scanner using html5-qrcode */
  function initCamera(containerId, onDetected, onError) {
    if (_cameraScanner) {
      stopCamera();
    }

    if (typeof Html5Qrcode === 'undefined') {
      if (onError) onError(new Error('html5-qrcode library not loaded'));
      return null;
    }

    const scanner = new Html5Qrcode(containerId, {
      verbose: false,
    });

    const config = {
      fps: 10,
      qrbox: { width: 250, height: 150 },
      aspectRatio: 1.5,
      supportedScanTypes: [
        Html5QrcodeScanType.SCAN_TYPE_CAMERA,
      ],
    };

    scanner.start(
      { facingMode: 'environment' }, // Rear camera
      config,
      (decodedText) => {
        onDetected(decodedText);
      },
      (error) => {
        // Scanning in progress - not an error, just no barcode yet
      }
    ).catch(err => {
      console.error('[Scanner] Camera error:', err);
      if (onError) onError(err);
    });

    _cameraScanner = scanner;
    return scanner;
  }

  /** Stop camera scanner */
  function stopCamera() {
    if (_cameraScanner) {
      _cameraScanner.stop().catch(() => {});
      _cameraScanner = null;
    }
  }

  /** Open camera scanner modal */
  function openCameraModal() {
    const modal = document.getElementById('scanner-modal');
    if (!modal) return;
    modal.classList.remove('hidden');

    // Give modal time to render
    setTimeout(() => {
      initCamera('camera-scanner-container',
        (barcode) => {
          _emit(barcode);
          closeCameraModal();
        },
        (err) => {
          Utils.toast(err.message || 'Camera not available', 'error');
          closeCameraModal();
        }
      );
    }, 200);
  }

  function closeCameraModal() {
    stopCamera();
    const modal = document.getElementById('scanner-modal');
    modal?.classList.add('hidden');
    document.getElementById('camera-scanner-container').innerHTML = '';
  }

  function init() {
    initUSB();

    // Camera modal close button
    document.getElementById('scanner-modal-close')?.addEventListener('click', closeCameraModal);
    document.getElementById('scanner-modal')?.addEventListener('click', (e) => {
      if (e.target === e.currentTarget) closeCameraModal();
    });
  }

  return { initUSB, initCamera, stopCamera, openCameraModal, closeCameraModal, init };
})();
