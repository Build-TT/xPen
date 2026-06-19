"use strict";

const STORAGE_KEY = "xpen.transactions.v1";
const PAYMENT_METHODS_KEY = "xpen.paymentMethods.v1";
const CATEGORIES_KEY = "xpen.categories.v1";
const CURRENCY = "THB";
const MAX_IMPORT_BYTES = 1_000_000;
const MAX_IMPORT_RECORDS = 5_000;
const DEFAULT_PAYMENT_METHODS = [
  { id: "cash", name: "เงินสด" },
  { id: "bank-transfer", name: "โอนธนาคาร" },
  { id: "promptpay", name: "PromptPay" },
  { id: "credit-card", name: "บัตรเครดิต" },
  { id: "wallet", name: "e-Wallet" },
];

const DEFAULT_CATEGORIES = {
  income: ["เงินเดือน", "ฟรีแลนซ์", "ลงทุน", "ของขวัญ", "อื่นๆ"],
  expense: ["อาหาร", "เดินทาง", "บ้าน", "สุขภาพ", "ช้อปปิ้ง", "บิล", "อื่นๆ"],
};

const initialPaymentMethods = loadPaymentMethods();
const initialCategories = loadCategories();

const state = {
  categories: initialCategories,
  paymentMethods: initialPaymentMethods,
  transactions: loadTransactions(initialPaymentMethods, initialCategories),
  view: "dashboard",
  editingTransactionId: "",
  pendingDuplicateTransaction: null,
  activeCategoryType: "expense",
  filters: {
    month: getCurrentMonthKey(),
    type: "all",
    search: "",
  },
};

const els = {
  navLinks: Array.from(document.querySelectorAll("[data-view]")),
  viewPanels: Array.from(document.querySelectorAll("[data-view-panel]")),
  form: document.querySelector("#transactionForm"),
  typeInputs: Array.from(document.querySelectorAll("input[name='type']")),
  amount: document.querySelector("#amountInput"),
  date: document.querySelector("#dateInput"),
  category: document.querySelector("#categoryInput"),
  paymentMethod: document.querySelector("#paymentMethodInput"),
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
  heroStartButton: document.querySelector("#heroStartButton"),
  chartSummary: document.querySelector("#chartSummary"),
  viewAnnouncer: document.querySelector("#viewAnnouncer"),
  entryBalanceValue: document.querySelector("#entryBalanceValue"),
  entryMonthValue: document.querySelector("#entryMonthValue"),
  entryTotalValue: document.querySelector("#entryTotalValue"),
  entrySavingValue: document.querySelector("#entrySavingValue"),
  recentPreview: document.querySelector("#recentPreview"),
  paymentMethodForm: document.querySelector("#paymentMethodForm"),
  paymentMethodNameInput: document.querySelector("#paymentMethodNameInput"),
  paymentMethodList: document.querySelector("#paymentMethodList"),
  categoryForm: document.querySelector("#categoryForm"),
  categoryTypeInput: document.querySelector("#categoryTypeInput"),
  categoryNameInput: document.querySelector("#categoryNameInput"),
  incomeCategoryList: document.querySelector("#incomeCategoryList"),
  expenseCategoryList: document.querySelector("#expenseCategoryList"),
  categoryTabs: Array.from(document.querySelectorAll("[data-category-tab]")),
  categoryPanels: Array.from(document.querySelectorAll("[data-category-panel]")),
  editModal: document.querySelector("#transactionEditModal"),
  editForm: document.querySelector("#editTransactionForm"),
  editTypeInputs: Array.from(document.querySelectorAll("input[name='editType']")),
  editAmount: document.querySelector("#editAmountInput"),
  editDate: document.querySelector("#editDateInput"),
  editCategory: document.querySelector("#editCategoryInput"),
  editPaymentMethod: document.querySelector("#editPaymentMethodInput"),
  editNote: document.querySelector("#editNoteInput"),
  closeEditButton: document.querySelector("#closeEditTransactionButton"),
  cancelEditButton: document.querySelector("#cancelEditTransactionButton"),
  duplicateModal: document.querySelector("#duplicateTransactionModal"),
  duplicateSummary: document.querySelector("#duplicateTransactionSummary"),
  duplicateDetail: document.querySelector("#duplicateTransactionDetail"),
  closeDuplicateButton: document.querySelector("#closeDuplicateTransactionButton"),
  cancelDuplicateButton: document.querySelector("#cancelDuplicateTransactionButton"),
  confirmDuplicateButton: document.querySelector("#confirmDuplicateTransactionButton"),
};

const money = new Intl.NumberFormat("th-TH", {
  style: "currency",
  currency: CURRENCY,
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const compactMoney = new Intl.NumberFormat("th-TH", {
  notation: "compact",
  compactDisplay: "short",
  maximumFractionDigits: 1,
});

init();

function init() {
  els.date.value = toDateInputValue(new Date());
  state.filters.month = normalizeMonthKey(state.filters.month);
  els.monthFilter.value = state.filters.month;
  syncCategoryOptions(getSelectedType());
  syncPaymentMethodOptions();
  bindEvents();
  setCategoryTab(state.activeCategoryType);
  setActiveView(getInitialView(), false, false);
  render();
}

function bindEvents() {
  els.form.addEventListener("submit", handleSubmit);
  window.addEventListener("resize", debounce(renderChart, 120));
  window.addEventListener("hashchange", () => {
    setActiveView(getInitialView(), false);
  });

  els.navLinks.forEach((button) => {
    button.addEventListener("click", () => setActiveView(button.dataset.view));
  });

  els.heroStartButton.addEventListener("click", () => setActiveView("entry"));

  els.typeInputs.forEach((input) => {
    input.addEventListener("change", () => {
      if (input.checked) syncCategoryOptions(input.value);
    });
  });

  els.editTypeInputs.forEach((input) => {
    input.addEventListener("change", () => {
      if (input.checked) syncEditCategoryOptions(input.value);
    });
  });

  els.monthFilter.addEventListener("change", () => {
    state.filters.month = normalizeMonthKey(els.monthFilter.value);
    els.monthFilter.value = state.filters.month;
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
  els.paymentMethodForm.addEventListener("submit", handlePaymentMethodSubmit);
  els.categoryForm.addEventListener("submit", handleCategorySubmit);
  els.categoryTypeInput.addEventListener("change", () => {
    setCategoryTab(els.categoryTypeInput.value, false);
  });
  els.categoryTabs.forEach((button) => {
    button.addEventListener("click", () => setCategoryTab(button.dataset.categoryTab));
  });
  els.editForm.addEventListener("submit", handleEditTransactionSubmit);
  els.closeEditButton.addEventListener("click", closeEditTransactionModal);
  els.cancelEditButton.addEventListener("click", closeEditTransactionModal);
  els.editModal.addEventListener("click", (event) => {
    if (event.target.matches("[data-close-edit-modal]")) {
      closeEditTransactionModal();
    }
  });
  els.closeDuplicateButton.addEventListener("click", closeDuplicateTransactionModal);
  els.cancelDuplicateButton.addEventListener("click", closeDuplicateTransactionModal);
  els.confirmDuplicateButton.addEventListener("click", confirmDuplicateTransaction);
  els.duplicateModal.addEventListener("click", (event) => {
    if (event.target.matches("[data-close-duplicate-modal]")) {
      closeDuplicateTransactionModal();
    }
  });
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !els.duplicateModal.hidden) {
      closeDuplicateTransactionModal();
      return;
    }

    if (event.key === "Escape" && !els.editModal.hidden) {
      closeEditTransactionModal();
    }
  });
}

function handleSubmit(event) {
  event.preventDefault();

  const type = getSelectedType();
  const amount = Number.parseFloat(els.amount.value);
  const date = els.date.value;
  const category = els.category.value;
  const paymentMethodId = els.paymentMethod.value;
  const note = els.note.value.trim();

  if (!Number.isFinite(amount) || amount <= 0 || !date || !category || !paymentMethodId) {
    els.amount.focus();
    return;
  }

  const transaction = {
    id: createId(),
    type,
    amount: roundMoney(amount),
    date,
    category,
    paymentMethodId,
    note,
    createdAt: new Date().toISOString(),
  };

  const duplicate = findDuplicateTransaction(transaction);
  if (duplicate) {
    openDuplicateTransactionModal(transaction, duplicate);
    return;
  }

  saveNewTransaction(transaction);
}

function saveNewTransaction(transaction) {
  state.transactions.unshift(transaction);
  persistTransactions();
  resetTransactionForm();
  render();
}

function resetTransactionForm() {
  els.form.reset();
  document.querySelector("input[name='type'][value='expense']").checked = true;
  els.date.value = toDateInputValue(new Date());
  syncCategoryOptions("expense");
  syncPaymentMethodOptions();
  els.amount.focus();
}

function findDuplicateTransaction(transaction) {
  return state.transactions.find(
    (item) =>
      item.date === transaction.date &&
      item.amount === transaction.amount &&
      item.paymentMethodId === transaction.paymentMethodId,
  );
}

function openDuplicateTransactionModal(transaction, duplicate) {
  state.pendingDuplicateTransaction = transaction;
  els.duplicateSummary.textContent = `${formatDate(transaction.date)} · ${money.format(
    transaction.amount,
  )} · ${getPaymentMethodName(transaction.paymentMethodId)}`;
  els.duplicateDetail.textContent = `มีรายการเดิมอยู่แล้ว: ${
    duplicate.note || duplicate.category
  } (${duplicate.type === "income" ? "รายรับ" : "รายจ่าย"})`;
  els.duplicateModal.hidden = false;
  document.body.style.overflow = "hidden";
  window.requestAnimationFrame(() => els.confirmDuplicateButton.focus());
}

function closeDuplicateTransactionModal() {
  state.pendingDuplicateTransaction = null;
  els.duplicateModal.hidden = true;
  document.body.style.overflow = "";
  window.requestAnimationFrame(() => els.amount.focus());
}

function confirmDuplicateTransaction() {
  if (!state.pendingDuplicateTransaction) {
    closeDuplicateTransactionModal();
    return;
  }

  const transaction = state.pendingDuplicateTransaction;
  state.pendingDuplicateTransaction = null;
  els.duplicateModal.hidden = true;
  document.body.style.overflow = "";
  saveNewTransaction(transaction);
}

function getSelectedType() {
  return document.querySelector("input[name='type']:checked").value;
}

function syncCategoryOptions(type) {
  els.category.replaceChildren();
  state.categories[type].forEach((category) => {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    els.category.append(option);
  });
}

function syncEditCategoryOptions(type, selectedCategory = els.editCategory.value) {
  els.editCategory.replaceChildren();
  const categories = state.categories[type] || [];
  const nextSelected = categories.includes(selectedCategory)
    ? selectedCategory
    : categories[0] || "";

  categories.forEach((category) => {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    option.selected = category === nextSelected;
    els.editCategory.append(option);
  });
}

function syncPaymentMethodOptions(selectedId = els.paymentMethod.value) {
  const fallbackId = getFallbackPaymentMethodId();
  const nextSelectedId = state.paymentMethods.some((method) => method.id === selectedId)
    ? selectedId
    : fallbackId;

  els.paymentMethod.replaceChildren();
  state.paymentMethods.forEach((method) => {
    const option = document.createElement("option");
    option.value = method.id;
    option.textContent = method.name;
    option.selected = method.id === nextSelectedId;
    els.paymentMethod.append(option);
  });
}

function syncEditPaymentMethodOptions(selectedId = els.editPaymentMethod.value) {
  const fallbackId = getFallbackPaymentMethodId();
  const nextSelectedId = state.paymentMethods.some((method) => method.id === selectedId)
    ? selectedId
    : fallbackId;

  els.editPaymentMethod.replaceChildren();
  state.paymentMethods.forEach((method) => {
    const option = document.createElement("option");
    option.value = method.id;
    option.textContent = method.name;
    option.selected = method.id === nextSelectedId;
    els.editPaymentMethod.append(option);
  });
}

function render() {
  renderSummary();
  if (state.view === "dashboard") {
    renderChart();
  }
  renderBreakdown();
  renderTransactions();
  renderEntrySummary();
  renderRecentPreview();
  renderPaymentMethods();
  renderCategories();
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
  if (state.view !== "dashboard") return;

  const canvas = els.chart;
  const ctx = canvas.getContext("2d");
  const monthly = getMonthTransactions();
  const days = getDaysInMonth(state.filters.month);
  const incomeByDay = new Array(days).fill(0);
  const expenseByDay = new Array(days).fill(0);

  monthly.forEach((item) => {
    const day = Number(item.date.slice(8, 10)) - 1;
    if (day < 0 || day >= days) return;

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
  const theme = getComputedStyle(document.documentElement);
  const incomeColor = theme.getPropertyValue("--green").trim() || "#047857";
  const expenseColor = theme.getPropertyValue("--red").trim() || "#b91c1c";

  drawGrid(ctx, cssWidth, cssHeight, pad, maxValue);

  incomeByDay.forEach((value, index) => {
    const x = pad.left + index * groupWidth + groupWidth / 2 - barWidth - 1;
    const heightPx = (value / maxValue) * plotHeight;
    drawBar(ctx, x, pad.top + plotHeight - heightPx, barWidth, heightPx, incomeColor);
  });

  expenseByDay.forEach((value, index) => {
    const x = pad.left + index * groupWidth + groupWidth / 2 + 1;
    const heightPx = (value / maxValue) * plotHeight;
    drawBar(ctx, x, pad.top + plotHeight - heightPx, barWidth, heightPx, expenseColor);
  });

  drawChartLabels(ctx, days, cssHeight, pad, groupWidth);
  renderChartSummary(incomeByDay, expenseByDay);
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
    els.transactionList.append(createTransactionRow(item, { showDelete: true }));
  });
}

function renderEntrySummary() {
  const monthly = getCurrentMonthTransactions();
  const income = sumByType(monthly, "income");
  const expense = sumByType(monthly, "expense");
  const balance = income - expense;
  const savingRate = income > 0 ? Math.round((balance / income) * 100) : 0;

  els.entryBalanceValue.textContent = money.format(balance);
  els.entryMonthValue.textContent = formatMonth(getCurrentMonthKey());
  els.entryTotalValue.textContent = String(monthly.length);
  els.entrySavingValue.textContent = `${savingRate}%`;
}

function renderRecentPreview() {
  const recent = state.transactions.slice(0, 5);
  els.recentPreview.replaceChildren();

  if (recent.length === 0) {
    els.recentPreview.append(els.emptyTemplate.content.cloneNode(true));
    return;
  }

  recent.forEach((item) => {
    els.recentPreview.append(createTransactionRow(item, { showDelete: false }));
  });
}

function renderPaymentMethods() {
  els.paymentMethodList.replaceChildren();

  state.paymentMethods.forEach((method) => {
    const usageCount = countTransactionsByPaymentMethod(method.id);
    const row = document.createElement("article");
    row.className = "method-row";

    const input = document.createElement("input");
    input.className = "method-name-input";
    input.value = method.name;
    input.maxLength = 40;
    input.setAttribute("aria-label", `Rename ${method.name}`);

    const usage = document.createElement("span");
    usage.className = "method-usage";
    usage.textContent = `${usageCount} รายการ`;

    const actions = document.createElement("div");
    actions.className = "method-actions";

    const save = document.createElement("button");
    save.className = "text-button";
    save.type = "button";
    save.textContent = "Save";
    save.addEventListener("click", () => renamePaymentMethod(method.id, input.value));

    const remove = document.createElement("button");
    remove.className = "text-button danger";
    remove.type = "button";
    remove.textContent = "Delete";
    remove.disabled = usageCount > 0 || state.paymentMethods.length === 1;
    remove.title = remove.disabled
      ? "ลบได้เฉพาะวิธีที่ยังไม่ถูกใช้ และต้องเหลืออย่างน้อย 1 วิธี"
      : "";
    remove.addEventListener("click", () => removePaymentMethod(method.id));

    actions.append(save, remove);
    row.append(input, usage, actions);
    els.paymentMethodList.append(row);
  });
}

function renderCategories() {
  renderCategoryList("expense", els.expenseCategoryList);
  renderCategoryList("income", els.incomeCategoryList);
  updateCategoryTabUi();
}

function renderCategoryList(type, target) {
  target.replaceChildren();

  state.categories[type].forEach((category) => {
    const usageCount = countTransactionsByCategory(type, category);
    const row = document.createElement("article");
    row.className = "method-row";

    const input = document.createElement("input");
    input.className = "method-name-input";
    input.value = category;
    input.maxLength = 40;
    input.setAttribute("aria-label", `Rename ${category}`);

    const usage = document.createElement("span");
    usage.className = "method-usage";
    usage.textContent = `${usageCount} รายการ`;

    const actions = document.createElement("div");
    actions.className = "method-actions";

    const save = document.createElement("button");
    save.className = "text-button";
    save.type = "button";
    save.textContent = "Save";
    save.addEventListener("click", () => renameCategory(type, category, input.value));

    const remove = document.createElement("button");
    remove.className = "text-button danger";
    remove.type = "button";
    remove.textContent = "Delete";
    remove.disabled = usageCount > 0 || state.categories[type].length === 1;
    remove.title = remove.disabled
      ? "ลบได้เฉพาะหมวดหมู่ที่ยังไม่ถูกใช้ และต้องเหลืออย่างน้อย 1 หมวด"
      : "";
    remove.addEventListener("click", () => removeCategory(type, category));

    actions.append(save, remove);
    row.append(input, usage, actions);
    target.append(row);
  });
}

function setCategoryTab(type, syncForm = true) {
  if (!isValidTransactionType(type)) return;

  state.activeCategoryType = type;
  if (syncForm) {
    els.categoryTypeInput.value = type;
  }
  updateCategoryTabUi();
}

function updateCategoryTabUi() {
  els.categoryTabs.forEach((button) => {
    const isActive = button.dataset.categoryTab === state.activeCategoryType;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-selected", String(isActive));
  });

  els.categoryPanels.forEach((panel) => {
    panel.hidden = panel.dataset.categoryPanel !== state.activeCategoryType;
  });
}

function handleCategorySubmit(event) {
  event.preventDefault();
  addCategory(els.categoryTypeInput.value, els.categoryNameInput.value);
}

function addCategory(type, name) {
  const normalizedName = normalizeCategoryName(name);
  if (!isValidTransactionType(type) || !normalizedName || isDuplicateCategory(type, normalizedName)) {
    els.categoryNameInput.focus();
    return;
  }

  state.categories[type].push(normalizedName);
  persistCategories();
  syncCategoryOptions(getSelectedType());
  setCategoryTab(type);
  els.categoryNameInput.value = "";
  renderCategories();
}

function renameCategory(type, oldName, newName) {
  const normalizedName = normalizeCategoryName(newName);
  if (
    !isValidTransactionType(type) ||
    !normalizedName ||
    (normalizedName !== oldName && isDuplicateCategory(type, normalizedName))
  ) {
    renderCategories();
    return;
  }

  const index = state.categories[type].indexOf(oldName);
  if (index < 0) return;

  state.categories[type][index] = normalizedName;
  state.transactions.forEach((item) => {
    if (item.type === type && item.category === oldName) {
      item.category = normalizedName;
    }
  });
  persistCategories();
  persistTransactions();
  syncCategoryOptions(getSelectedType());
  render();
}

function removeCategory(type, category) {
  if (
    !isValidTransactionType(type) ||
    state.categories[type].length === 1 ||
    countTransactionsByCategory(type, category) > 0
  ) {
    renderCategories();
    return;
  }

  state.categories[type] = state.categories[type].filter((item) => item !== category);
  persistCategories();
  syncCategoryOptions(getSelectedType());
  renderCategories();
}

function handlePaymentMethodSubmit(event) {
  event.preventDefault();
  addPaymentMethod(els.paymentMethodNameInput.value);
}

function addPaymentMethod(name) {
  const normalizedName = normalizePaymentMethodName(name);
  if (!normalizedName || isDuplicatePaymentMethodName(normalizedName)) {
    els.paymentMethodNameInput.focus();
    return;
  }

  const method = {
    id: createId(),
    name: normalizedName,
  };

  state.paymentMethods.push(method);
  persistPaymentMethods();
  syncPaymentMethodOptions(method.id);
  els.paymentMethodForm.reset();
  renderPaymentMethods();
}

function renamePaymentMethod(id, name) {
  const normalizedName = normalizePaymentMethodName(name);
  const method = state.paymentMethods.find((item) => item.id === id);

  if (
    !method ||
    !normalizedName ||
    isDuplicatePaymentMethodName(normalizedName, id)
  ) {
    renderPaymentMethods();
    return;
  }

  method.name = normalizedName;
  persistPaymentMethods();
  syncPaymentMethodOptions(id);
  render();
}

function removePaymentMethod(id) {
  if (
    state.paymentMethods.length === 1 ||
    countTransactionsByPaymentMethod(id) > 0
  ) {
    renderPaymentMethods();
    return;
  }

  state.paymentMethods = state.paymentMethods.filter((method) => method.id !== id);
  persistPaymentMethods();
  syncPaymentMethodOptions();
  render();
}

function createTransactionRow(item, options = {}) {
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
  meta.className = "transaction-meta-line";
  const metaText = document.createElement("span");
  metaText.textContent = `${formatDate(item.date)} · ${item.category}`;
  const method = document.createElement("span");
  method.className = "payment-chip";
  method.textContent = getPaymentMethodName(item.paymentMethodId);
  meta.append(metaText, method);
  main.append(title, meta);

  const amount = document.createElement("div");
  amount.className = `transaction-amount ${item.type}`;
  amount.textContent = `${item.type === "income" ? "+" : "-"}${money.format(
    item.amount,
  )}`;

  row.append(icon, main, amount);

  if (options.showDelete) {
    const actions = document.createElement("div");
    actions.className = "row-actions";

    const editButton = document.createElement("button");
    editButton.className = "row-action edit";
    editButton.type = "button";
    editButton.setAttribute("aria-label", "Edit transaction");
    editButton.dataset.id = item.id;
    editButton.innerHTML =
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9"></path><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"></path></svg>';
    editButton.addEventListener("click", () => openEditTransaction(item.id));

    const deleteButton = document.createElement("button");
    deleteButton.className = "row-action delete";
    deleteButton.type = "button";
    deleteButton.setAttribute("aria-label", "Delete transaction");
    deleteButton.dataset.id = item.id;
    deleteButton.innerHTML =
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16"></path><path d="M10 11v6m4-6v6"></path><path d="M6 7l1 13h10l1-13"></path><path d="M9 7V4h6v3"></path></svg>';
    deleteButton.addEventListener("click", () => removeTransaction(item.id));

    actions.append(editButton, deleteButton);
    row.append(actions);
  }

  return row;
}

function openEditTransaction(id) {
  const item = state.transactions.find((transaction) => transaction.id === id);
  if (!item) return;

  state.editingTransactionId = id;
  const typeInput = document.querySelector(`input[name="editType"][value="${item.type}"]`);
  if (typeInput) typeInput.checked = true;
  els.editAmount.value = item.amount;
  els.editDate.value = item.date;
  syncEditCategoryOptions(item.type, item.category);
  syncEditPaymentMethodOptions(item.paymentMethodId);
  els.editNote.value = item.note || "";
  els.editModal.hidden = false;
  document.body.style.overflow = "hidden";
  window.requestAnimationFrame(() => els.editAmount.focus());
}

function closeEditTransactionModal() {
  state.editingTransactionId = "";
  els.editForm.reset();
  els.editModal.hidden = true;
  document.body.style.overflow = "";
}

function handleEditTransactionSubmit(event) {
  event.preventDefault();

  const item = state.transactions.find(
    (transaction) => transaction.id === state.editingTransactionId,
  );
  if (!item) {
    closeEditTransactionModal();
    return;
  }

  const type = getSelectedEditType();
  const amount = Number.parseFloat(els.editAmount.value);
  const date = els.editDate.value;
  const category = els.editCategory.value;
  const paymentMethodId = els.editPaymentMethod.value;
  const note = els.editNote.value.trim();

  if (!Number.isFinite(amount) || amount <= 0 || !date || !category || !paymentMethodId) {
    els.editAmount.focus();
    return;
  }

  item.type = type;
  item.amount = roundMoney(amount);
  item.date = date;
  item.category = category;
  item.paymentMethodId = paymentMethodId;
  item.note = note;
  item.updatedAt = new Date().toISOString();

  persistTransactions();
  closeEditTransactionModal();
  render();
}

function getSelectedEditType() {
  return document.querySelector("input[name='editType']:checked")?.value || "expense";
}

function setActiveView(viewName, updateHash = true, moveFocus = true) {
  const validViews = new Set(["dashboard", "entry", "categories", "payments"]);
  const nextView = validViews.has(viewName) ? viewName : "dashboard";
  state.view = nextView;
  let activePanel = null;

  els.navLinks.forEach((button) => {
    const isActive = button.dataset.view === nextView;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-current", isActive ? "page" : "false");
  });

  els.viewPanels.forEach((panel) => {
    const isActive = panel.dataset.viewPanel === nextView;
    panel.hidden = !isActive;
    panel.classList.toggle("is-active", isActive);
    if (isActive) activePanel = panel;
  });

  if (updateHash && window.location.hash !== `#${nextView}`) {
    window.history.replaceState(null, "", `#${nextView}`);
  }

  if (nextView === "dashboard") {
    window.requestAnimationFrame(renderChart);
  }

  els.viewAnnouncer.textContent = `${getViewLabel(nextView)} view opened`;

  if (moveFocus && activePanel) {
    window.requestAnimationFrame(() => activePanel.focus({ preventScroll: true }));
  }
}

function getInitialView() {
  const view = window.location.hash.replace("#", "");
  return ["dashboard", "entry", "categories", "payments"].includes(view)
    ? view
    : "dashboard";
}

function getMonthTransactions() {
  const month = normalizeMonthKey(state.filters.month);
  return state.transactions.filter((item) => item.date.startsWith(month));
}

function getCurrentMonthTransactions() {
  const month = getCurrentMonthKey();
  return state.transactions.filter((item) => item.date.startsWith(month));
}

function getFilteredTransactions() {
  return getMonthTransactions().filter((item) => {
    const matchesType =
      state.filters.type === "all" || item.type === state.filters.type;
    const haystack = `${item.category} ${item.note} ${item.amount} ${getPaymentMethodName(
      item.paymentMethodId,
    )}`.toLowerCase();
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
  persistTransactions();
  render();
}

function resetData() {
  const confirmed = window.confirm("ล้างข้อมูลทั้งหมดในเครื่องนี้?");
  if (!confirmed) return;

  state.transactions = [];
  state.categories = cloneDefaultCategories();
  state.paymentMethods = cloneDefaultPaymentMethods();
  persistTransactions();
  persistCategories();
  persistPaymentMethods();
  syncCategoryOptions(getSelectedType());
  syncPaymentMethodOptions();
  render();
}

function exportJson() {
  const payload = {
    app: "xPen",
    version: 2,
    exportedAt: new Date().toISOString(),
    categories: state.categories,
    paymentMethods: state.paymentMethods,
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
    ["date", "type", "category", "payment_method", "amount", "note"],
    ...state.transactions.map((item) => [
      item.date,
      item.type,
      item.category,
      getPaymentMethodName(item.paymentMethodId),
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

  if (file.size > MAX_IMPORT_BYTES) {
    window.alert("ไฟล์ใหญ่เกินไป จำกัดการนำเข้าไว้ที่ 1 MB");
    els.importFile.value = "";
    return;
  }

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

      if (transactions.length > MAX_IMPORT_RECORDS) {
        throw new Error("Too many records");
      }

      const importedMethods = Array.isArray(payload?.paymentMethods)
        ? ensureUniquePaymentMethods(
            payload.paymentMethods.map(normalizePaymentMethod).filter(Boolean),
          )
        : state.paymentMethods;
      const importedCategories =
        payload && typeof payload.categories === "object"
          ? normalizeCategories(payload.categories)
          : state.categories;

      const confirmed =
        state.transactions.length === 0 ||
        window.confirm(
          "การนำเข้าจะแทนที่รายการทั้งหมดในเครื่องนี้ ต้องการดำเนินการต่อ?",
        );

      if (!confirmed) return;

      state.paymentMethods =
        importedMethods.length > 0 ? importedMethods : cloneDefaultPaymentMethods();
      state.categories = importedCategories;
      state.transactions = ensureUniqueTransactionIds(
        transactions
        .map((item) => normalizeTransaction(item, state.paymentMethods, state.categories))
        .filter(Boolean)
          .sort((a, b) => b.date.localeCompare(a.date)),
      );
      mergeTransactionCategories(state.transactions);

      persistTransactions();
      persistCategories();
      persistPaymentMethods();
      syncCategoryOptions(getSelectedType());
      syncPaymentMethodOptions();
      render();
    } catch (error) {
      window.alert("ไฟล์นี้นำเข้าไม่ได้ กรุณาตรวจสอบว่าเป็น JSON ของ xPen");
    } finally {
      els.importFile.value = "";
    }
  });
  reader.readAsText(file);
}

function normalizeTransaction(
  item,
  methods = DEFAULT_PAYMENT_METHODS,
  categorySource = DEFAULT_CATEGORIES,
) {
  const type = item?.type;
  const amount = Number.parseFloat(item?.amount);
  const date = typeof item?.date === "string" ? item.date.slice(0, 10) : "";
  const methodIds = new Set(methods.map((method) => method.id));
  const paymentMethodId =
    typeof item?.paymentMethodId === "string" && methodIds.has(item.paymentMethodId)
      ? item.paymentMethodId
      : getFallbackPaymentMethodId(methods);

  if (
    (type !== "income" && type !== "expense") ||
    !Number.isFinite(amount) ||
    amount <= 0 ||
    !isValidDateValue(date)
  ) {
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
        : (categorySource[type] || DEFAULT_CATEGORIES[type])[0],
    note:
      typeof item.note === "string" ? item.note.trim().slice(0, 80) : "",
    paymentMethodId,
    createdAt:
      typeof item.createdAt === "string"
        ? item.createdAt
        : new Date().toISOString(),
  };
}

function loadTransactions(methods = DEFAULT_PAYMENT_METHODS, categorySource = DEFAULT_CATEGORIES) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return ensureUniqueTransactionIds(
      parsed.map((item) => normalizeTransaction(item, methods, categorySource)).filter(Boolean),
    );
  } catch {
    return [];
  }
}

function loadPaymentMethods() {
  try {
    const raw = localStorage.getItem(PAYMENT_METHODS_KEY);
    if (!raw) return cloneDefaultPaymentMethods();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return cloneDefaultPaymentMethods();
    const methods = ensureUniquePaymentMethods(
      parsed.map(normalizePaymentMethod).filter(Boolean),
    );
    return methods.length > 0 ? methods : cloneDefaultPaymentMethods();
  } catch {
    return cloneDefaultPaymentMethods();
  }
}

function loadCategories() {
  try {
    const raw = localStorage.getItem(CATEGORIES_KEY);
    if (!raw) return cloneDefaultCategories();
    const parsed = JSON.parse(raw);
    return normalizeCategories(parsed);
  } catch {
    return cloneDefaultCategories();
  }
}

function persistTransactions() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.transactions));
  } catch {
    window.alert("บันทึกข้อมูลไม่ได้ พื้นที่จัดเก็บของ browser อาจเต็ม");
  }
}

function persistPaymentMethods() {
  try {
    localStorage.setItem(PAYMENT_METHODS_KEY, JSON.stringify(state.paymentMethods));
  } catch {
    window.alert("บันทึกวิธีการจ่ายไม่ได้ พื้นที่จัดเก็บของ browser อาจเต็ม");
  }
}

function persistCategories() {
  try {
    localStorage.setItem(CATEGORIES_KEY, JSON.stringify(state.categories));
  } catch {
    window.alert("บันทึกหมวดหมู่ไม่ได้ พื้นที่จัดเก็บของ browser อาจเต็ม");
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
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function escapeCsv(value) {
  const text = sanitizeCsvCell(String(value ?? ""));
  if (/[",\n]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

function sanitizeCsvCell(text) {
  const trimmed = text.trimStart();
  if (/^[=+\-@\t\r]/.test(trimmed)) {
    return `'${text}`;
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

function normalizeMonthKey(monthKey) {
  return isValidMonthKey(monthKey) ? monthKey : getCurrentMonthKey();
}

function toDateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getDaysInMonth(monthKey) {
  const [year, month] = normalizeMonthKey(monthKey).split("-").map(Number);
  return new Date(year, month, 0).getDate();
}

function formatDate(dateValue) {
  if (!isValidDateValue(dateValue)) {
    return dateValue;
  }

  return new Intl.DateTimeFormat("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${dateValue}T00:00:00`));
}

function formatMonth(monthKey) {
  const [year, month] = normalizeMonthKey(monthKey).split("-").map(Number);
  return new Intl.DateTimeFormat("th-TH", {
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, 1));
}

function renderChartSummary(incomeByDay, expenseByDay) {
  const income = incomeByDay.reduce((sum, value) => sum + value, 0);
  const expense = expenseByDay.reduce((sum, value) => sum + value, 0);
  const peakExpense = Math.max(...expenseByDay, 0);
  const peakDay = expenseByDay.findIndex((value) => value === peakExpense) + 1;

  els.chartSummary.textContent =
    peakExpense > 0
      ? `เดือน ${formatMonth(state.filters.month)} มีรายรับรวม ${money.format(
          income,
        )} รายจ่ายรวม ${money.format(expense)} และรายจ่ายสูงสุดวันที่ ${peakDay}`
      : `เดือน ${formatMonth(state.filters.month)} มีรายรับรวม ${money.format(
          income,
        )} และยังไม่มีรายจ่าย`;
}

function ensureUniqueTransactionIds(transactions) {
  const seen = new Set();

  return transactions.map((item) => {
    let id = item.id;
    while (!id || seen.has(id)) {
      id = createId();
    }
    seen.add(id);
    return { ...item, id };
  });
}

function cloneDefaultCategories() {
  return {
    income: [...DEFAULT_CATEGORIES.income],
    expense: [...DEFAULT_CATEGORIES.expense],
  };
}

function normalizeCategories(value) {
  const defaults = cloneDefaultCategories();
  const next = { income: [], expense: [] };

  ["income", "expense"].forEach((type) => {
    const values = Array.isArray(value?.[type]) ? value[type] : defaults[type];
    values.forEach((item) => {
      const name = normalizeCategoryName(item);
      if (name && !next[type].some((existing) => existing.toLowerCase() === name.toLowerCase())) {
        next[type].push(name);
      }
    });

    if (next[type].length === 0) {
      next[type] = [...defaults[type]];
    }
  });

  return next;
}

function normalizeCategoryName(name) {
  return typeof name === "string" ? name.trim().replace(/\s+/g, " ").slice(0, 40) : "";
}

function isDuplicateCategory(type, name) {
  const nameKey = name.toLowerCase();
  return state.categories[type].some((category) => category.toLowerCase() === nameKey);
}

function countTransactionsByCategory(type, category) {
  return state.transactions.filter(
    (item) => item.type === type && item.category === category,
  ).length;
}

function mergeTransactionCategories(transactions) {
  transactions.forEach((item) => {
    if (!isValidTransactionType(item.type)) return;
    const category = normalizeCategoryName(item.category);
    if (category && !isDuplicateCategory(item.type, category)) {
      state.categories[item.type].push(category);
    }
  });
}

function isValidTransactionType(type) {
  return type === "income" || type === "expense";
}

function cloneDefaultPaymentMethods() {
  return DEFAULT_PAYMENT_METHODS.map((method) => ({ ...method }));
}

function normalizePaymentMethod(item) {
  const id = typeof item?.id === "string" && item.id.trim()
    ? item.id.trim().slice(0, 80)
    : createId();
  const name = normalizePaymentMethodName(item?.name);

  if (!name) {
    return null;
  }

  return { id, name };
}

function ensureUniquePaymentMethods(methods) {
  const seenIds = new Set();
  const seenNames = new Set();
  const unique = [];

  methods.forEach((method) => {
    let id = method.id;
    while (!id || seenIds.has(id)) {
      id = createId();
    }

    const nameKey = method.name.toLowerCase();
    if (seenNames.has(nameKey)) {
      return;
    }

    seenIds.add(id);
    seenNames.add(nameKey);
    unique.push({ id, name: method.name });
  });

  return unique;
}

function normalizePaymentMethodName(name) {
  return typeof name === "string" ? name.trim().replace(/\s+/g, " ").slice(0, 40) : "";
}

function isDuplicatePaymentMethodName(name, currentId = "") {
  const nameKey = name.toLowerCase();
  return state.paymentMethods.some(
    (method) => method.id !== currentId && method.name.toLowerCase() === nameKey,
  );
}

function getPaymentMethodName(id) {
  return (
    state.paymentMethods.find((method) => method.id === id)?.name ||
    state.paymentMethods[0]?.name ||
    DEFAULT_PAYMENT_METHODS[0].name
  );
}

function getFallbackPaymentMethodId(methods = null) {
  const source = methods || state.paymentMethods || DEFAULT_PAYMENT_METHODS;
  return source[0]?.id || DEFAULT_PAYMENT_METHODS[0].id;
}

function countTransactionsByPaymentMethod(id) {
  return state.transactions.filter((item) => item.paymentMethodId === id).length;
}

function getViewLabel(view) {
  return {
    dashboard: "Dashboard",
    entry: "Add entry",
    categories: "Categories",
    payments: "Payment methods",
  }[view] || "Dashboard";
}

function isValidMonthKey(monthKey) {
  if (!/^\d{4}-\d{2}$/.test(monthKey || "")) {
    return false;
  }

  const [year, month] = monthKey.split("-").map(Number);
  return month >= 1 && month <= 12 && year >= 1970 && year <= 9999;
}

function isValidDateValue(dateValue) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
    return false;
  }

  const date = new Date(`${dateValue}T00:00:00`);
  return !Number.isNaN(date.getTime()) && toDateInputValue(date) === dateValue;
}
