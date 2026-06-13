# xPen

Minimal personal income and expense tracker. Built as a dependency-free responsive website, so it can run locally by opening `index.html` and can deploy for free as static files.

## Features

- Add income and expense transactions
- Monthly balance, income, expense, and saving rate summary
- Daily income/expense chart
- Expense category breakdown
- Search and filter ledger
- Local-only storage with JSON import/export and CSV export

## Run Locally

Serve the folder with any static server:

```powershell
python -m http.server 4173
```

Then visit `http://localhost:4173`.

Opening `index.html` directly can work in some browsers, but `localStorage` behavior on `file:` URLs is not consistent. Localhost is the recommended way to test.

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

xPen stores data in your browser with `localStorage`. No backend is used and no financial data leaves your device unless you export or deploy your own copy.

For private financial data, deploy xPen on a dedicated domain or subdomain. Browser `localStorage` is scoped by origin, so other pages running scripts on the same origin can access the same origin storage.

Exported files are plaintext financial data. The project `.gitignore` excludes `xpen-export-*.json` and `xpen-export-*.csv`; keep exports outside the repo if you rename them.
