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

Open `index.html` in a browser, or serve the folder with any static server:

```powershell
python -m http.server 4173
```

Then visit `http://localhost:4173`.

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
