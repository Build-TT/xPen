"use strict";

const STORAGE_KEY = "xpen.transactions.v1";
const CURRENCY = "THB";

const categories = {
  income: ["เงินเดือน", "ฟรีแลนซ์", "ลงทุน", "ของขวัญ", "อื่นๆ"],
  expense: ["อาหาร", "เดินทาง", "บ้าน", "สุขภาพ", "ช้อปปิ้ง", "บิล", "อื่นๆ"],
};

const state = {
  transactions: loadTransactions(),
  filters: {
    month: getCurrentMonthKey(),
    type: "all",
    search: "",
  },
};

const els = {
  form: document.querySelector("#transactionForm"),
  typeInputs: Array.from(document.querySelectorAll("input[name='type']")),
  amount: document.querySelector("#amountInput"),
  date: document.querySelector("#dateInput"),
  category: document.querySelector("#categoryInput"),
  note: document.querySelector("#noteInput"),
  monthFilter: document.querySelector("#monthFilter"),
  typeFilter: document.querySelector("#typeFilter"),
  searchInput: document.querySelector("#searchInput"),
  balanceValue: document.querySelector("#balanceValue"),
  balanceHint: document.querySelector("#balanceHint"),
  incomeValue: document.querySelector("#incomeValue"),
  incomeCount: document.querySelector("#incomeCount"),
  expenseValue: document.querySelector("#expenseValue"),
  expenseCount: document.querySelector("#expenseCount"),
  savingRateValue: document.querySelector("#savingRateValue"),
  categoryBreakdown: document.querySelector("#categoryBreakdown"),
  transactionList: document.querySelector("#transactionList"),
  emptyTemplate: document.querySelector("#emptyStateTemplate"),
  chart: document.querySelector("#monthChart"),
  exportJsonButton: document.querySelector("#exportJsonButton"),
  exportCsvButton: document.querySelector("#exportCsvButton"),
  importButton: document.querySelector("#importButton"),
  importFile: document.querySelector("#importFile"),
  resetButton: document.querySelector("#resetButton"),
};

const money = new Intl.NumberFormat("th-TH", {
  style: "currency",
  currency: CURRENCY,
  maximumFractionDigits: 0,
});

const compactMoney = new Intl.NumberFormat("th-TH", {
  notation: "compact",
  compactDisplay: "short",
  maximumFractionDigits: 1,
});

init();

function init() {
  els.date.value = toDateInputValue(new Date());
  els.monthFilter.value = state.filters.month;
  syncCategoryOptions(getSelectedType());
  bindEvents();
  render();
}

function bindEvents() {
  els.form.addEventListener("submit", handleSubmit);
  window.addEventListener("resize", debounce(renderChart, 120));

  els.typeInputs.forEach((input) => {
    input.addEventListener("change", () => syncCategoryOptions(input.value));
  });

  els.monthFilter.addEventListener("change", () => {
    state.filters.month = els.monthFilter.value || getCurrentMonthKey();
    render();
  });

  els.typeFilter.addEventListener("change", () => {
    state.filters.type = els.typeFilter.value;
    renderTransactions();
  });

  els.searchInput.addEventListener("input", () => {
    state.filters.search = els.searchInput.value.trim().toLowerCase();
    renderTransactions();
  });

  els.exportJsonButton.addEventListener("click", exportJson);
  els.exportCsvButton.addEventListener("click", exportCsv);
  els.importButton.addEventListener("click", () => els.importFile.click());
  els.importFile.addEventListener("change", importJson);
  els.resetButton.addEventListener("click", resetData);
}

function handleSubmit(event) {
  event.preventDefault();

  const type = getSelectedType();
  const amount = Number.parseFloat(els.amount.value);
  const date = els.date.value;
  const category = els.category.value;
  const note = els.note.value.trim();

  if (!Number.isFinite(amount) || amount <= 0 || !date || !category) {
    els.amount.focus();
    return;
  }

  state.transactions.unshift({
    id: createId(),
    type,
    amount: roundMoney(amount),
    date,
    category,
    note,
    createdAt: new Date().toISOString(),
  });

  persist();
  els.form.reset();
  document.querySelector("input[name='type'][value='income']").checked = true;
  els.date.value = toDateInputValue(new Date());
  syncCategoryOptions("income");
  els.amount.focus();
  render();
}

function getSelectedType() {
  return document.querySelector("input[name='type']:checked").value;
}

function syncCategoryOptions(type) {
  els.category.replaceChildren();
  categories[type].forEach((category) => {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    els.category.append(option);
  });
}

function render() {
  renderSummary();
  renderChart();
  renderBreakdown();
  renderTransactions();
}

function renderSummary() {
  const monthly = getMonthTransactions();
  const income = sumByType(monthly, "income");
  const expense = sumByType(monthly, "expense");
  const balance = income - expense;
  const savingRate = income > 0 ? Math.round((balance / income) * 100) : 0;
  const incomeCount = monthly.filter((item) => item.type === "income").length;
  const expenseCount = monthly.filter((item) => item.type === "expense").length;

  els.balanceValue.textContent = money.format(balance);
  els.balanceHint.textContent =
    balance >= 0 ? "เดือนนี้ยังเป็นบวก" : "เดือนนี้ใช้เกินรายรับ";
  els.incomeValue.textContent = money.format(income);
  els.incomeCount.textContent = `${incomeCount} รายการ`;
  els.expenseValue.textContent = money.format(expense);
  els.expenseCount.textContent = `${expenseCount} รายการ`;
  els.savingRateValue.textContent = `${savingRate}%`;
}

function renderChart() {
  const canvas = els.chart;
  const ctx = canvas.getContext("2d");
  const monthly = getMonthTransactions();
  const days = getDaysInMonth(state.filters.month);
  const incomeByDay = new Array(days).fill(0);
  const expenseByDay = new Array(days).fill(0);

  monthly.forEach((item) => {
    const day = Number(item.date.slice(8, 10)) - 1;
    if (item.type === "income") {
      incomeByDay[day] += item.amount;
    } else {
      expenseByDay[day] += item.amount;
    }
  });

  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(320, Math.floor(rect.width * dpr));
  const height = Math.max(210, Math.floor(rect.height * dpr));
  canvas.width = width;
  canvas.height = height;
  ctx.scale(dpr, dpr);

  const cssWidth = width / dpr;
  const cssHeight = height / dpr;
  ctx.clearRect(0, 0, cssWidth, cssHeight);

  const pad = { top: 20, right: 16, bottom: 34, left: 42 };
  const plotWidth = cssWidth - pad.left - pad.right;
  const plotHeight = cssHeight - pad.top - pad.bottom;
  const maxValue = Math.max(...incomeByDay, ...expenseByDay, 1);
  const groupWidth = plotWidth / days;
  const barWidth = Math.max(3, Math.min(10, groupWidth * 0.3));

  drawGrid(ctx, cssWidth, cssHeight, pad, maxValue);

  incomeByDay.forEach((value, index) => {
    const x = pad.left + index * groupWidth + groupWidth / 2 - barWidth - 1;
    const heightPx = (value / maxValue) * plotHeight;
    drawBar(ctx, x, pad.top + plotHeight - heightPx, barWidth, heightPx, "#24b35b");
  });

  expenseByDay.forEach((value, index) => {
    const x = pad.left + index * groupWidth + groupWidth / 2 + 1;
    const heightPx = (value / maxValue) * plotHeight;
    drawBar(ctx, x, pad.top + plotHeight - heightPx, barWidth, heightPx, "#f04438");
  });

  drawChartLabels(ctx, days, cssHeight, pad, groupWidth);
}

function drawGrid(ctx, width, height, pad, maxValue) {
  ctx.save();
  ctx.strokeStyle = "#e6e8ed";
  ctx.fillStyle = "#737782";
  ctx.lineWidth = 1;
  ctx.font = "12px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";

  for (let i = 0; i <= 3; i += 1) {
    const y = pad.top + ((height - pad.top - pad.bottom) / 3) * i;
    const value = maxValue - (maxValue / 3) * i;
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(width - pad.right, y);
    ctx.stroke();
    ctx.fillText(compactMoney.format(value), pad.left - 8, y);
  }

  ctx.restore();
}

function drawBar(ctx, x, y, width, height, color) {
  if (height <= 0) return;
  ctx.save();
  ctx.fillStyle = color;
  const radius = Math.min(5, width / 2, height / 2);
  ctx.beginPath();
  roundedRect(ctx, x, y, width, height + radius, radius);
  ctx.fill();
  ctx.restore();
}

function drawChartLabels(ctx, days, height, pad, groupWidth) {
  ctx.save();
  ctx.fillStyle = "#737782";
  ctx.font = "12px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";

  const markers = [1, Math.ceil(days / 2), days];
  markers.forEach((day) => {
    const x = pad.left + (day - 1) * groupWidth + groupWidth / 2;
    ctx.fillText(String(day), x, height - pad.bottom + 12);
  });

  ctx.restore();
}

function renderBreakdown() {
  const monthlyExpenses = getMonthTransactions().filter(
    (item) => item.type === "expense",
  );
  const totals = new Map();

  monthlyExpenses.forEach((item) => {
    totals.set(item.category, (totals.get(item.category) || 0) + item.amount);
  });

  const sorted = Array.from(totals.entries()).sort((a, b) => b[1] - a[1]);
  const max = sorted[0]?.[1] || 0;

  els.categoryBreakdown.replaceChildren();

  if (sorted.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-line";
    empty.textContent = "ยังไม่มีรายจ่ายสำหรับเดือนนี้";
    els.categoryBreakdown.append(empty);
    return;
  }

  sorted.slice(0, 5).forEach(([category, total]) => {
    const item = document.createElement("div");
    item.className = "category-item";

    const headline = document.createElement("div");
    headline.className = "category-topline";

    const name = document.createElement("span");
    name.textContent = category;
    const amount = document.createElement("small");
    amount.textContent = money.format(total);

    const track = document.createElement("div");
    track.className = "bar-track";
    const fill = document.createElement("div");
    fill.className = "bar-fill";
    fill.style.width = `${Math.max(6, (total / max) * 100)}%`;

    headline.append(name, amount);
    track.append(fill);
    item.append(headline, track);
    els.categoryBreakdown.append(item);
  });
}

function renderTransactions() {
  const transactions = getFilteredTransactions();
  els.transactionList.replaceChildren();

  if (transactions.length === 0) {
    els.transactionList.append(els.emptyTemplate.content.cloneNode(true));
    return;
  }

  transactions.forEach((item) => {
    const row = document.createElement("article");
    row.className = "transaction-row";

    const icon = document.createElement("div");
    icon.className = `type-icon ${item.type}`;
    icon.textContent = item.type === "income" ? "+" : "-";

    const main = document.createElement("div");
    main.className = "transaction-main";
    const title = document.createElement("strong");
    title.textContent = item.note || item.category;
    const meta = document.createElement("span");
    meta.textContent = `${formatDate(item.date)} · ${item.category}`;
    main.append(title, meta);

    const amount = document.createElement("div");
    amount.className = `transaction-amount ${item.type}`;
    amount.textContent = `${item.type === "income" ? "+" : "-"}${money.format(
      item.amount,
    )}`;

    const button = document.createElement("button");
    button.className = "row-action";
    button.type = "button";
    button.setAttribute("aria-label", "Delete transaction");
    button.dataset.id = item.id;
    button.innerHTML =
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16"></path><path d="M10 11v6m4-6v6"></path><path d="M6 7l1 13h10l1-13"></path><path d="M9 7V4h6v3"></path></svg>';
    button.addEventListener("click", () => removeTransaction(item.id));

    row.append(icon, main, amount, button);
    els.transactionList.append(row);
  });
}

function getMonthTransactions() {
  return state.transactions.filter((item) => item.date.startsWith(state.filters.month));
}

function getFilteredTransactions() {
  return getMonthTransactions().filter((item) => {
    const matchesType =
      state.filters.type === "all" || item.type === state.filters.type;
    const haystack = `${item.category} ${item.note} ${item.amount}`.toLowerCase();
    const matchesSearch =
      state.filters.search.length === 0 ||
      haystack.includes(state.filters.search);
    return matchesType && matchesSearch;
  });
}

function sumByType(transactions, type) {
  return transactions
    .filter((item) => item.type === type)
    .reduce((sum, item) => sum + item.amount, 0);
}

function removeTransaction(id) {
  state.transactions = state.transactions.filter((item) => item.id !== id);
  persist();
  render();
}

function resetData() {
  const confirmed = window.confirm("ล้างข้อมูลทั้งหมดในเครื่องนี้?");
  if (!confirmed) return;

  state.transactions = [];
  persist();
  render();
}

function exportJson() {
  const payload = {
    app: "xPen",
    version: 1,
    exportedAt: new Date().toISOString(),
    transactions: state.transactions,
  };

  downloadFile(
    `xpen-export-${toDateInputValue(new Date())}.json`,
    JSON.stringify(payload, null, 2),
    "application/json",
  );
}

function exportCsv() {
  const rows = [
    ["date", "type", "category", "amount", "note"],
    ...state.transactions.map((item) => [
      item.date,
      item.type,
      item.category,
      item.amount,
      item.note,
    ]),
  ];

  const csv = rows.map((row) => row.map(escapeCsv).join(",")).join("\n");
  downloadFile(`xpen-export-${toDateInputValue(new Date())}.csv`, csv, "text/csv");
}

function importJson(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.addEventListener("load", () => {
    try {
      const payload = JSON.parse(String(reader.result));
      const transactions = Array.isArray(payload)
        ? payload
        : payload.transactions;

      if (!Array.isArray(transactions)) {
        throw new Error("Invalid xPen file");
      }

      state.transactions = transactions
        .map(normalizeTransaction)
        .filter(Boolean)
        .sort((a, b) => b.date.localeCompare(a.date));

      persist();
      render();
    } catch (error) {
      window.alert("ไฟล์นี้นำเข้าไม่ได้ กรุณาตรวจสอบว่าเป็น JSON ของ xPen");
    } finally {
      els.importFile.value = "";
    }
  });
  reader.readAsText(file);
}

function normalizeTransaction(item) {
  const type = item?.type === "expense" ? "expense" : "income";
  const amount = Number.parseFloat(item?.amount);
  const date = typeof item?.date === "string" ? item.date.slice(0, 10) : "";
  const isValidDate = /^\d{4}-\d{2}-\d{2}$/.test(date);

  if (!Number.isFinite(amount) || amount <= 0 || !isValidDate) {
    return null;
  }

  return {
    id: typeof item.id === "string" ? item.id : createId(),
    type,
    amount: roundMoney(amount),
    date,
    category:
      typeof item.category === "string" && item.category.trim()
        ? item.category.trim().slice(0, 40)
        : categories[type][0],
    note:
      typeof item.note === "string" ? item.note.trim().slice(0, 80) : "",
    createdAt:
      typeof item.createdAt === "string"
        ? item.createdAt
        : new Date().toISOString(),
  };
}

function loadTransactions() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeTransaction).filter(Boolean);
  } catch {
    return [];
  }
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.transactions));
  } catch {
    window.alert("บันทึกข้อมูลไม่ได้ พื้นที่จัดเก็บของ browser อาจเต็ม");
  }
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function escapeCsv(value) {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

function roundMoney(value) {
  return Math.round(value * 100) / 100;
}

function createId() {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }

  const random = Math.random().toString(36).slice(2);
  return `xpen-${Date.now()}-${random}`;
}

function roundedRect(ctx, x, y, width, height, radius) {
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(x, y, width, height, radius);
    return;
  }

  const safeRadius = Math.min(radius, width / 2, height / 2);
  ctx.moveTo(x + safeRadius, y);
  ctx.lineTo(x + width - safeRadius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
  ctx.lineTo(x + width, y + height - safeRadius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
  ctx.lineTo(x + safeRadius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
  ctx.lineTo(x, y + safeRadius);
  ctx.quadraticCurveTo(x, y, x + safeRadius, y);
}

function debounce(fn, delay) {
  let timer = 0;
  return (...args) => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => fn(...args), delay);
  };
}

function getCurrentMonthKey() {
  return toDateInputValue(new Date()).slice(0, 7);
}

function toDateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getDaysInMonth(monthKey) {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(year, month, 0).getDate();
}

function formatDate(dateValue) {
  return new Intl.DateTimeFormat("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${dateValue}T00:00:00`));
}
