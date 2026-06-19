# xPen

Minimal personal income and expense tracker. Built as a dependency-free responsive website, so it can run locally by opening `index.html` and can deploy for free as static files.

## Features

- Add income and expense transactions
- Monthly balance, income, expense, and saving rate summary
- Daily income/expense chart
- Expense category breakdown
- Search and filter ledger
- Browser storage with JSON import/export and CSV export
- Optional Google Sheet backup/restore when deployed on Vercel

## Run Locally

Serve the folder with any static server:

```powershell
python -m http.server 4173
```

Then visit `http://localhost:4173`.

Opening `index.html` directly can work in some browsers, but `localStorage` behavior on `file:` URLs is not consistent. Localhost is the recommended way to test.

Local data stays in the browser until you import, reset, or restore from Google Sheet.

## Deploy Free With Vercel CLI

This path does not require connecting GitHub to Vercel.

1. Install or run the Vercel CLI:

```powershell
npm i -g vercel
```

Or use it without a global install:

```powershell
npx vercel
```

2. Log in and link this folder to a Vercel project:

```powershell
cd "C:\Claude\Expenses(xPen)"
vercel login
vercel link
```

3. Add the Google Sheet sync environment variables after creating the Apps Script web app:

```powershell
vercel env add XPEN_SHEETS_WEB_APP_URL production --sensitive
vercel env add XPEN_SYNC_TOKEN production --sensitive
```

Use the same random token for `XPEN_SYNC_TOKEN` in Vercel and Apps Script.

4. Deploy production:

```powershell
vercel --prod
```

The frontend calls `/api/sheets`; Vercel runs `api/sheets.mjs` server-side so the sync token is not exposed in the browser.

## Google Sheet Storage

1. Create a new Google Sheet for xPen.
2. Open **Extensions > Apps Script**.
3. Paste the contents of `gas/Code.gs`.
4. Open **Project Settings > Script Properties** and add:

```text
XPEN_SYNC_TOKEN = a-long-random-secret-value
```

5. Deploy the Apps Script project as a web app:
   - Execute as: **Me**
   - Who has access: **Anyone with the link** or **Anyone**
6. Copy the Web App URL and save it to Vercel as `XPEN_SHEETS_WEB_APP_URL`.

The script creates and rewrites only these tabs:

- `xPen_Transactions`
- `xPen_Categories`
- `xPen_PaymentMethods`

Existing browser data is not uploaded automatically. Use **บันทึกลง Sheet** in xPen when you want to back it up, and use **โหลดจาก Sheet** only when you want the Sheet copy to replace the current browser copy.

## Deploy Free With GitHub Pages

Create a new GitHub repository named `xPen`, then push this folder:

```powershell
git init
git add .
git commit -m "Initial xPen expense tracker"
git branch -M main
git remote add origin https://github.com/<your-user>/xPen.git
git push -u origin main
```

In GitHub, open **Settings > Pages**, choose **GitHub Actions**, and the included workflow will publish the site.

## Privacy

xPen stores data in your browser with `localStorage` by default. Financial data leaves your device only when you export a file or press the Google Sheet backup button.

For private financial data, deploy xPen on a dedicated domain or subdomain. Browser `localStorage` is scoped by origin, so other pages running scripts on the same origin can access the same origin storage.

Exported files are plaintext financial data. The project `.gitignore` excludes `xpen-export-*.json` and `xpen-export-*.csv`; keep exports outside the repo if you rename them.
