# MiniPOS — Modern Minimart Point of Sale System

A complete, fully-functional PWA Point of Sale system for a minimart.
**Frontend**: HTML/CSS/JavaScript (no build tools needed)
**Backend**: Google Apps Script (GAS)
**Database**: Google Sheets

---

## Features

- ✅ Barcode scanning (USB scanner + mobile camera)
- ✅ Product management with multi-language names
- ✅ Cart with discount (% and amount) + tax calculation
- ✅ Payment: Cash, Bank Transfer, QR Code, Card
- ✅ Thermal receipt printing (58mm / 80mm)
- ✅ Barcode label printing (30×40mm / 40×60mm)
- ✅ Stock management with history and low-stock alerts
- ✅ Reports: Daily, Monthly, Profit, Best Selling, Stock Summary
- ✅ 4 languages: Lao, Thai, English, Chinese (instant switch)
- ✅ PWA installable on Android, iPhone, iPad
- ✅ Offline mode with automatic sync
- ✅ Admin and Staff roles

---

## Step-by-Step Setup Guide

### PART 1 — Create the Google Spreadsheet

1. Go to [sheets.google.com](https://sheets.google.com) and create a **new blank spreadsheet**.
2. Name it **"MiniPOS Database"** (or anything you prefer).
3. **Copy the Spreadsheet ID** from the URL:
   ```
   https://docs.google.com/spreadsheets/d/YOUR_SHEET_ID_HERE/edit
   ```
   The ID is the long string between `/d/` and `/edit`.

4. You do NOT need to create tabs manually — the setup script will do it automatically.

---

### PART 2 — Set Up Google Apps Script

1. In your Google Spreadsheet, go to **Extensions → Apps Script**.
2. Delete all default code in `Code.gs`.
3. Copy the content of each `.gs` file from the `gas/` folder into Apps Script:

   **Create these script files** (click `+` next to "Files"):
   - `Code.gs` → paste content of `gas/Code.gs`
   - `Auth.gs` → paste content of `gas/Auth.gs`
   - `Products.gs` → paste content of `gas/Products.gs`
   - `Sales.gs` → paste content of `gas/Sales.gs`
   - `Stock.gs` → paste content of `gas/Stock.gs`
   - `Reports.gs` → paste content of `gas/Reports.gs`
   - `Barcodes.gs` → paste content of `gas/Barcodes.gs`
   - `Settings.gs` → paste content of `gas/Settings.gs`
   - `Utils.gs` → paste content of `gas/Utils.gs`

4. In `appsscript.json`: Click the gear icon → Show `appsscript.json` → paste content of `gas/appsscript.json`.

---

### PART 3 — Configure Script Properties

1. In Apps Script, go to **Project Settings** (gear icon on left).
2. Scroll down to **Script Properties**.
3. Click **Add script property**:

   | Property | Value |
   |----------|-------|
   | `SHEET_ID` | Your Spreadsheet ID from Part 1 |
   | `IMAGES_FOLDER_ID` | (Optional) Google Drive folder ID for product images |

4. Click **Save script properties**.

---

### PART 4 — Run Initial Setup

1. In Apps Script editor, select the function `setupInitialData` from the dropdown menu.
2. Click **▶ Run**.
3. Grant permissions when prompted (Google will ask for access to Sheets and Drive).
4. Wait for it to complete. This creates all 7 sheets with headers + default data:
   - 3 sample products
   - 4 categories
   - Default settings
   - **2 default users:**
     - Admin: `admin` / `admin123`
     - Staff: `staff` / `staff123`

   > ⚠️ **Change these passwords** in the Users tab after first login!

---

### PART 5 — Deploy as Web App

1. In Apps Script, click **Deploy → New deployment**.
2. Click the gear ⚙ icon next to "Select type" → choose **Web app**.
3. Configure:
   - **Description**: MiniPOS API v1
   - **Execute as**: `Me` (your Google account)
   - **Who has access**: `Anyone` ← **This is critical!** (NOT "Anyone with Google account")
4. Click **Deploy**.
5. **Copy the Web App URL** — it looks like:
   ```
   https://script.google.com/macros/s/AKfycbx.../exec
   ```
6. Test it: Open the URL in a browser — you should see:
   ```json
   {"status":"success","data":{"message":"MiniPOS API v1.0 — use action parameter"}}
   ```

---

### PART 6 — Deploy the Frontend

#### Option A: Serve locally (for testing)

You need a local web server because PWA service workers require HTTP (not file://).

**Using Python:**
```bash
cd C:\Users\USER\OneDrive\Desktop\pos
python -m http.server 8080
```
Then open: `http://localhost:8080`

**Using Node.js (npx):**
```bash
npx serve C:\Users\USER\OneDrive\Desktop\pos -p 8080
```

**Using VS Code:** Install the "Live Server" extension, right-click `index.html` → "Open with Live Server".

#### Option B: Deploy to GitHub Pages (free hosting)

1. Create a GitHub repository (e.g., `my-minipos`).
2. Upload all files from the `pos/` folder (not the `gas/` subfolder — that stays in GAS).
3. Go to repository **Settings → Pages → Source: main branch / root**.
4. Your app will be at: `https://yourusername.github.io/my-minipos/`

#### Option C: Deploy to any web host

Upload all files except the `gas/` folder to your web host via FTP/SFTP.

---

### PART 7 — Connect Frontend to Backend

1. Open your deployed app in a browser.
2. The first time you open it (before login), go to the URL and add `#/login`.
3. Log in with `admin` / `admin123`.
4. Go to **Settings** (⚙️ in sidebar).
5. In the **API URL** field, paste your GAS Web App URL from Part 5.
6. Click **Test Connection** — you should see ✅ API reachable!
7. Click **Save Settings**.

---

### PART 8 — Install as PWA

#### Android (Chrome):
1. Open the app URL in Chrome.
2. Tap the **⋮ menu → Add to Home Screen**.
3. The app opens as a standalone app without browser chrome.

#### iPhone/iPad (Safari):
1. Open the app URL in Safari.
2. Tap the **Share button → Add to Home Screen**.
3. The app installs as a home screen icon.

---

## Default Login Credentials

| Username | Password | Role |
|----------|----------|------|
| `admin` | `admin123` | Administrator (full access) |
| `staff` | `staff123` | Staff (POS only) |

> **Change these immediately** via Settings → Users after first login.

---

## Staff vs Admin Permissions

| Feature | Admin | Staff |
|---------|-------|-------|
| Point of Sale | ✅ | ✅ |
| Scan Barcodes | ✅ | ✅ |
| Print Receipts | ✅ | ✅ |
| Manage Products | ✅ | ❌ |
| Manage Categories | ✅ | ❌ |
| Stock Management | ✅ | ❌ |
| Barcode Generation | ✅ | ❌ |
| Reports | ✅ | ❌ |
| Profit Report | ✅ | ❌ |
| Manage Users | ✅ | ❌ |
| System Settings | ✅ | ❌ |

---

## USB Barcode Scanner Setup

No driver installation needed. USB barcode scanners work as HID (keyboard) devices:

1. Plug the USB scanner into your computer/tablet.
2. Open the POS screen in the app.
3. Scan any barcode — the product will be automatically added to the cart.

**How it works:** The scanner fires keystrokes very rapidly (< 100ms between keys) ending with Enter. The app detects this pattern and distinguishes it from human typing.

---

## Thermal Printer Setup

### Browser Print (Universal — works everywhere):
1. Go to Settings → Printer Width: select `58mm` or `80mm`.
2. On the receipt modal, click **Print Receipt**.
3. In the print dialog, select your thermal printer.
4. Set the paper size to match your printer width.

### Direct Print (Chrome Desktop/Android — driverless):
Chrome supports the Web Serial API for direct ESC/POS printing:
1. Connect thermal printer via USB.
2. In Chrome settings, enable the Web Serial API.
3. Use the "Direct Print" option when available.

### Recommended thermal printers:
- Xprinter XP-58IIH (58mm) — budget friendly
- EPSON TM-T20III (80mm) — professional grade
- Any ESC/POS compatible printer

---

## Barcode Printing

1. Go to **Barcodes** in the sidebar.
2. Select a product OR generate a standalone barcode.
3. Choose CODE128 or EAN-13.
4. Click **Preview** to see the label.
5. Select label size: 30×40mm or 40×60mm.
6. Set number of copies.
7. Click **Print** — position your label paper in the printer.

**Recommended label printers:**
- Brother QL-800 (uses pre-cut labels)
- Dymo LabelWriter 450
- Any label printer that supports the label size

---

## Google Sheets Structure

After running `setupInitialData`, your spreadsheet will have these sheets:

| Sheet | Purpose |
|-------|---------|
| **Products** | Product catalog (name in 4 languages, price, stock, barcode) |
| **Sales** | All sales transactions with line items as JSON |
| **Stock** | Stock movement history (sales, manual adjustments) |
| **Users** | Login credentials (passwords are SHA-256 hashed) |
| **Categories** | Product categories with icons and colors |
| **Barcodes** | Generated barcode registry |
| **Settings** | All system configuration key-value pairs |

---

## Updating the GAS Backend

When you update `.gs` files, you must **create a new deployment**:
1. In Apps Script: **Deploy → Manage deployments**.
2. Click the edit ✏️ icon on your existing deployment.
3. Change version to **New version**.
4. Click **Deploy**.
5. The URL stays the same — no need to update the frontend.

---

## Security Notes

- Passwords are hashed with SHA-256 + a random salt (generated on first run).
- Authentication tokens are stateless (HMAC-like, valid for the current calendar day).
- Role enforcement happens on **both** frontend AND backend.
- The GAS API URL contains your deployment ID — keep it private.
- For production, consider adding IP filtering or rate limiting in GAS.

---

## Troubleshooting

### "API URL not configured"
→ Go to Settings, enter your GAS Web App URL, click Save.

### "Unauthorized" error on API calls
→ Your token may have expired (tokens expire daily). Log out and log in again.

### Products not showing in POS
→ Check that products are marked as "Active" in the Products sheet.
→ Click the refresh button in the POS search bar.

### Camera scanning not working on iPhone
→ Safari on iOS requires HTTPS for camera access. Use GitHub Pages or another HTTPS host.

### Receipt printing cuts off
→ Go to Settings → Printer Width and select the correct size (58mm or 80mm).
→ In the browser print dialog, disable "headers and footers" and set margins to None.

### GAS script exceeds time limit
→ GAS has a 6-second execution limit per request. For large datasets (1000+ products),
   use the cache layer. The `getProducts` endpoint caches results for 60 seconds.

### "SHEET_ID not configured"
→ Go to Apps Script → Project Settings → Script Properties → add `SHEET_ID`.

---

## File Structure

```
pos/
├── index.html          — App shell (single-page app)
├── manifest.json       — PWA manifest
├── sw.js               — Service worker (offline/caching)
│
├── css/
│   ├── main.css        — Variables, reset, typography, utilities
│   ├── layout.css      — Sidebar, topbar, login, buttons
│   ├── pos.css         — POS screen layout
│   ├── forms.css       — Modals, inputs, forms
│   ├── print.css       — Barcode label printing (@page)
│   └── receipt.css     — Receipt printing (@page)
│
├── js/
│   ├── app.js          — Entry point and bootstrap
│   ├── state.js        — Global state store
│   ├── router.js       — Hash-based SPA router
│   ├── api.js          — GAS API communication
│   ├── auth.js         — Authentication & sessions
│   ├── db.js           — IndexedDB for offline storage
│   ├── sync.js         — Offline sync queue
│   ├── i18n.js         — Translation engine
│   ├── translations.js — All strings (EN/LO/TH/ZH)
│   ├── scanner.js      — USB HID + camera barcode scanner
│   ├── barcode.js      — Barcode generation and printing
│   ├── receipt.js      — Receipt builder and printing
│   ├── utils.js        — Shared utilities
│   └── views/
│       ├── login.js    — Login screen
│       ├── pos.js      — Main POS view
│       ├── products.js — Product management
│       ├── categories.js
│       ├── stock.js    — Stock management
│       ├── barcodes.js — Barcode generation
│       ├── reports.js  — All reports + charts
│       ├── settings.js — System settings
│       └── users.js    — User management
│
├── assets/
│   ├── icons/          — PWA icons (192px, 512px)
│   └── images/         — Placeholder images
│
└── gas/                — Google Apps Script (deploy to GAS, not web host)
    ├── Code.gs         — Main router (doGet/doPost)
    ├── Auth.gs         — Authentication
    ├── Products.gs     — Products + Categories CRUD
    ├── Sales.gs        — Sale creation + sync
    ├── Stock.gs        — Stock management
    ├── Reports.gs      — Report aggregations
    ├── Barcodes.gs     — Barcode generation
    ├── Settings.gs     — Settings read/write
    ├── Utils.gs        — Shared utilities + setupInitialData()
    └── appsscript.json — GAS project manifest
```

---

## Support

For issues, check:
1. Browser console (F12 → Console) for JavaScript errors
2. Apps Script **Executions** log for GAS errors (Deploy → View executions)
3. Network tab (F12 → Network) for API request/response details

---

*Built with ❤️ — HTML, CSS, JavaScript + Google Apps Script*
