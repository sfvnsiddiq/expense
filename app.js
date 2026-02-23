// Core state
const STORAGE_PREFIX_TRANSACTIONS = "expenseTracker:transactions";
const STORAGE_PREFIX_INCOME = "expenseTracker:incomePerMonth";
const USERS_STORAGE_KEY = "expenseTracker:users";
const CURRENT_USER_KEY = "expenseTracker:currentUser";
const DEFAULT_USERNAME = "safuvan";
const DEFAULT_PASSWORD = "123456";
const categories = ["Food", "Fuel", "Travel", "Personal", "Rent", "Personal Care"];

let currentUser = null;
let transactions = [];
let currentYear;
let currentMonth; // 0-11

// DOM references
const navButtons = document.querySelectorAll(".nav-item");
const sections = {
  dashboard: document.getElementById("dashboardSection"),
  transactions: document.getElementById("transactionsSection"),
  reports: document.getElementById("reportsSection"),
};

const monthSelect = document.getElementById("monthSelect");
const totalThisMonthEl = document.getElementById("totalThisMonth");
const monthChangeLabelEl = document.getElementById("monthChangeLabel");
const monthChangeValueEl = document.getElementById("monthChangeValue");
const cashReserveDisplayEl = document.getElementById("cashReserveDisplay");
const remainingBalanceDisplayEl = document.getElementById("remainingBalanceDisplay");
const categorySummaryListEl = document.getElementById("categorySummaryList");
const topCategoryValueEl = document.getElementById("topCategoryValue");
const largestExpenseValueEl = document.getElementById("largestExpenseValue");
const avgPerDayValueEl = document.getElementById("avgPerDayValue");
const transactionsTableBody = document.getElementById(
  "transactionsTableBody",
);
const reportsSummaryText = document.getElementById("reportsSummaryText");
const reportsCategoryList = document.getElementById("reportsCategoryList");

// Modal
const expenseModal = document.getElementById("expenseModal");
const openAddModalBtn = document.getElementById("openAddModalBtn");
const openAddModalBtnTable = document.getElementById("openAddModalBtnTable");
const closeModalBtn = document.getElementById("closeModalBtn");
const cancelModalBtn = document.getElementById("cancelModalBtn");
const expenseForm = document.getElementById("expenseForm");
const expenseIdInput = document.getElementById("expenseId");
const expenseDateInput = document.getElementById("expenseDate");
const expenseCategoryInput = document.getElementById("expenseCategory");
const expenseDescriptionInput = document.getElementById("expenseDescription");
const expenseAmountInput = document.getElementById("expenseAmount");
const modalTitle = document.getElementById("modalTitle");
const resetDataBtn = document.getElementById("resetDataBtn");
const incomeButton = document.getElementById("incomeButton");
const authScreen = document.getElementById("authScreen");
const appShell = document.getElementById("appShell");
const loginForm = document.getElementById("loginForm");
const signupForm = document.getElementById("signupForm");
const loginUsername = document.getElementById("loginUsername");
const loginPassword = document.getElementById("loginPassword");
const signupUsername = document.getElementById("signupUsername");
const signupPassword = document.getElementById("signupPassword");
const signupConfirm = document.getElementById("signupConfirm");
const showSignupBtn = document.getElementById("showSignupBtn");
const showLoginBtn = document.getElementById("showLoginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const sidebarUserName = document.getElementById("sidebarUserName");
const sidebarUserInitial = document.getElementById("sidebarUserInitial");

let incomeByMonth = {};

// Charts
let categoryBarChart;
let monthlyLineChart;
let categoryDonutChart;

// User / auth
function getUsers() {
  try {
    const raw = localStorage.getItem(USERS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveUsers(users) {
  try {
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
  } catch {
    // ignore
  }
}

function getCurrentUser() {
  try {
    return localStorage.getItem(CURRENT_USER_KEY);
  } catch {
    return null;
  }
}

function setCurrentUser(username) {
  currentUser = username;
  try {
    localStorage.setItem(CURRENT_USER_KEY, username);
  } catch {
    // ignore
  }
}

function clearCurrentUser() {
  currentUser = null;
  try {
    localStorage.removeItem(CURRENT_USER_KEY);
  } catch {
    // ignore
  }
}

function getTransactionsKey() {
  return currentUser
    ? `${STORAGE_PREFIX_TRANSACTIONS}:${currentUser}`
    : STORAGE_PREFIX_TRANSACTIONS;
}

function getIncomeKey() {
  return currentUser
    ? `${STORAGE_PREFIX_INCOME}:${currentUser}`
    : STORAGE_PREFIX_INCOME;
}

// Utilities
function loadTransactions() {
  try {
    const key = getTransactionsKey();
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch (e) {
    console.error("Failed to load transactions", e);
    return [];
  }
}

function loadIncomeMap() {
  try {
    const key = getIncomeKey();
    const raw = localStorage.getItem(key);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveIncomeMap() {
  try {
    localStorage.setItem(getIncomeKey(), JSON.stringify(incomeByMonth));
  } catch {
    // ignore
  }
}

function saveTransactions() {
  try {
    localStorage.setItem(getTransactionsKey(), JSON.stringify(transactions));
  } catch (e) {
    console.error("Failed to save transactions", e);
  }
}

function getYearMonthKey(dateStr) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function getCurrentYearMonthKey() {
  return `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}`;
}

function getPreviousYearMonth(year, monthIndex) {
  if (monthIndex === 0) {
    return { year: year - 1, month: 11 };
  }
  return { year, month: monthIndex - 1 };
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function formatCurrencyCompact(value) {
  const n = Number(value) || 0;
  if (n === 0) return "₹0";
  const abs = Math.abs(n);
  let suffix = "";
  let num = abs;
  if (abs >= 1_000_000) {
    num = abs / 1_000_000;
    suffix = "M";
  } else if (abs >= 1_000) {
    num = abs / 1_000;
    suffix = "K";
  }
  const base = num.toFixed(num >= 10 ? 0 : 1);
  return `${n < 0 ? "-" : ""}₹${base}${suffix}`;
}

function compareByDateDesc(a, b) {
  const da = new Date(a.date).getTime();
  const db = new Date(b.date).getTime();
  return db - da;
}

// Data aggregations
function getTransactionsForMonth(year, monthIndex) {
  return transactions
    .filter((t) => {
      const d = new Date(t.date);
      return (
        !Number.isNaN(d.getTime()) &&
        d.getFullYear() === year &&
        d.getMonth() === monthIndex
      );
    })
    .sort(compareByDateDesc);
}

function computeMonthlySummary(year, monthIndex) {
  const filtered = getTransactionsForMonth(year, monthIndex);
  const byCategory = {};
  let total = 0;
  let largest = 0;
  let largestTx = null;

  for (const c of categories) {
    byCategory[c] = 0;
  }

  for (const tx of filtered) {
    const amt = Number(tx.amount) || 0;
    byCategory[tx.category] = (byCategory[tx.category] || 0) + amt;
    total += amt;
    if (amt > largest) {
      largest = amt;
      largestTx = tx;
    }
  }

  // Previous month
  const { year: prevYear, month: prevMonth } = getPreviousYearMonth(
    year,
    monthIndex,
  );
  const prevFiltered = getTransactionsForMonth(prevYear, prevMonth);
  const prevTotal = prevFiltered.reduce(
    (sum, t) => sum + (Number(t.amount) || 0),
    0,
  );

  // Top category
  let topCategory = null;
  let topCategoryAmount = 0;
  for (const c of categories) {
    if (byCategory[c] > topCategoryAmount) {
      topCategoryAmount = byCategory[c];
      topCategory = c;
    }
  }

  // Avg per day
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const avgPerDay = daysInMonth ? total / daysInMonth : 0;

  return {
    filtered,
    byCategory,
    total,
    prevTotal,
    topCategory,
    topCategoryAmount,
    largestTx,
    avgPerDay,
  };
}

function getAllMonthBuckets() {
  const map = new Map();
  for (const tx of transactions) {
    const key = getYearMonthKey(tx.date);
    if (!key) continue;
    const [y, m] = key.split("-").map((n) => Number(n));
    if (!map.has(key)) {
      map.set(key, { year: y, month: m - 1, total: 0 });
    }
    const bucket = map.get(key);
    bucket.total += Number(tx.amount) || 0;
  }
  const arr = Array.from(map.values()).sort((a, b) => {
    if (a.year === b.year) return a.month - b.month;
    return a.year - b.year;
  });
  return arr;
}

// Rendering
function renderMonthSelect() {
  const buckets = getAllMonthBuckets();
  const currentKey = getCurrentYearMonthKey();
  const existingKeys = new Set(buckets.map((b) => `${b.year}-${b.month}`));
  if (!existingKeys.has(`${currentYear}-${currentMonth}`)) {
    buckets.push({ year: currentYear, month: currentMonth, total: 0 });
    buckets.sort((a, b) => {
      if (a.year === b.year) return a.month - b.month;
      return a.year - b.year;
    });
  }

  monthSelect.innerHTML = "";
  for (const b of buckets) {
    const d = new Date(b.year, b.month, 1);
    const label = d.toLocaleDateString(undefined, {
      month: "short",
      year: "numeric",
    });
    const value = `${b.year}-${String(b.month + 1).padStart(2, "0")}`;
    const opt = document.createElement("option");
    opt.value = value;
    opt.textContent = label;
    if (value === currentKey) {
      opt.selected = true;
    }
    monthSelect.appendChild(opt);
  }
}

function renderSummary() {
  const summary = computeMonthlySummary(currentYear, currentMonth);

  totalThisMonthEl.textContent = formatCurrency(summary.total);

  const diff = summary.total - summary.prevTotal;
  const diffPct =
    summary.prevTotal > 0 ? (diff / summary.prevTotal) * 100 : null;

  monthChangeLabelEl.textContent = "vs last month";
  monthChangeValueEl.classList.remove(
    "metric-change--up",
    "metric-change--down",
  );
  if (summary.prevTotal === 0 && summary.total === 0) {
    monthChangeValueEl.textContent = "No data";
  } else if (summary.prevTotal === 0) {
    monthChangeValueEl.textContent = "+∞";
    monthChangeValueEl.classList.add("metric-change--up");
  } else {
    const sign = diff >= 0 ? "+" : "";
    const pctText = diffPct ? `${sign}${diffPct.toFixed(1)}%` : "0%";
    monthChangeValueEl.textContent = `${sign}${formatCurrencyCompact(
      diff,
    )} (${pctText})`;
    monthChangeValueEl.classList.add(
      diff >= 0 ? "metric-change--up" : "metric-change--down",
    );
  }

  // Monthly income display
  const key = getCurrentYearMonthKey();
  const income = Number(incomeByMonth[key]) || 0;
  cashReserveDisplayEl.textContent = formatCurrency(income);

  // Remaining balance display
  const remainingBalance = income - summary.total;
  if (remainingBalanceDisplayEl) {
    remainingBalanceDisplayEl.textContent = formatCurrency(remainingBalance);
  }

  // Category list
  categorySummaryListEl.innerHTML = "";
  for (const c of categories) {
    const li = document.createElement("li");
    const labelSpan = document.createElement("span");
    labelSpan.className = "category-list__label";
    labelSpan.textContent = c;
    const valueSpan = document.createElement("span");
    valueSpan.className = "category-list__value";
    valueSpan.textContent = formatCurrency(summary.byCategory[c]);
    li.appendChild(labelSpan);
    li.appendChild(valueSpan);
    categorySummaryListEl.appendChild(li);
  }

  topCategoryValueEl.textContent = summary.topCategory
    ? `${summary.topCategory} (${formatCurrency(summary.topCategoryAmount)})`
    : "—";
  largestExpenseValueEl.textContent = summary.largestTx
    ? `${formatCurrency(summary.largestTx.amount)} on ${new Date(
        summary.largestTx.date,
      ).toLocaleDateString()}`
    : "—";
  avgPerDayValueEl.textContent = formatCurrency(summary.avgPerDay);

  // Table
  renderTransactionsTable(summary.filtered);

  // Reports section
  renderReportsSummary(summary, income);

  // Charts
  updateCharts(summary);
}

function renderReportsSummary(summary, income) {
  const monthLabel = new Date(currentYear, currentMonth, 1).toLocaleDateString(
    undefined,
    { month: "long", year: "numeric" },
  );
  if (reportsSummaryText) {
    const remaining = (Number(income) || 0) - summary.total;
    reportsSummaryText.innerHTML = `
      <strong>${monthLabel}</strong><br>
      Income: ${formatCurrency(income)}<br>
      Spent: ${formatCurrency(summary.total)}<br>
      Remaining: ${formatCurrency(remaining)}
    `;
  }
  if (reportsCategoryList) {
    reportsCategoryList.innerHTML = "";
    for (const c of categories) {
      const li = document.createElement("li");
      const labelSpan = document.createElement("span");
      labelSpan.className = "category-list__label";
      labelSpan.textContent = c;
      const valueSpan = document.createElement("span");
      valueSpan.className = "category-list__value";
      valueSpan.textContent = formatCurrency(summary.byCategory[c]);
      li.appendChild(labelSpan);
      li.appendChild(valueSpan);
      reportsCategoryList.appendChild(li);
    }
  }
}

function renderTransactionsTable(rows) {
  if (!transactionsTableBody) return;
  transactionsTableBody.innerHTML = "";
  if (!rows.length) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 5;
    td.textContent = "No expenses for this month yet.";
    td.style.textAlign = "center";
    td.style.color = "var(--text-muted)";
    tr.appendChild(td);
    transactionsTableBody.appendChild(tr);
    return;
  }

  for (const tx of rows) {
    const tr = document.createElement("tr");

    const dateTd = document.createElement("td");
    dateTd.textContent = new Date(tx.date).toLocaleDateString();
    const catTd = document.createElement("td");
    catTd.textContent = tx.category;
    const descTd = document.createElement("td");
    descTd.textContent = tx.description || "—";
    const amountTd = document.createElement("td");
    amountTd.className = "table__amount-col";
    amountTd.textContent = formatCurrency(tx.amount);
    const actionsTd = document.createElement("td");
    actionsTd.className = "table__actions";

    const editBtn = document.createElement("button");
    editBtn.className = "btn-text";
    editBtn.textContent = "Edit";
    editBtn.addEventListener("click", () => openEditModal(tx.id));

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "btn-text btn-text--danger";
    deleteBtn.textContent = "Delete";
    deleteBtn.addEventListener("click", () => handleDelete(tx.id));

    actionsTd.appendChild(editBtn);
    actionsTd.appendChild(deleteBtn);

    tr.appendChild(dateTd);
    tr.appendChild(catTd);
    tr.appendChild(descTd);
    tr.appendChild(amountTd);
    tr.appendChild(actionsTd);
    transactionsTableBody.appendChild(tr);
  }
}

// Charts
function initCharts() {
  const categoryBarCtx = document
    .getElementById("categoryBarChart")
    .getContext("2d");
  const monthlyLineCtx = document
    .getElementById("monthlyLineChart")
    .getContext("2d");
  const categoryDonutCtx = document
    .getElementById("categoryDonutChart")
    .getContext("2d");

  const accent = "#ff7a26";
  const accentSoft = "rgba(255, 122, 38, 0.35)";
  const accentAlt = "#f97316";

  categoryBarChart = new Chart(categoryBarCtx, {
    type: "bar",
    data: {
      labels: categories,
      datasets: [
        {
          label: "This month",
          data: [0, 0, 0, 0],
          backgroundColor: [accent, accentAlt, accent, accentAlt],
          borderRadius: 8,
          borderSkipped: false,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label(context) {
              const value = context.parsed.y || 0;
              return formatCurrency(value);
            },
          },
        },
      },
      scales: {
        x: {
          ticks: { color: "#a0a4b8" },
          grid: { display: false },
        },
        y: {
          ticks: {
            color: "#6b7280",
            callback(value) {
              return formatCurrencyCompact(value);
            },
          },
          grid: {
            color: "rgba(255, 255, 255, 0.04)",
          },
        },
      },
    },
  });

  monthlyLineChart = new Chart(monthlyLineCtx, {
    type: "line",
    data: {
      labels: [],
      datasets: [
        {
          label: "Total per month",
          data: [],
          borderColor: accent,
          backgroundColor: accentSoft,
          tension: 0.35,
          fill: true,
          pointRadius: 3,
          pointHoverRadius: 5,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label(context) {
              const value = context.parsed.y || 0;
              return formatCurrency(value);
            },
          },
        },
      },
      scales: {
        x: {
          ticks: { color: "#a0a4b8" },
          grid: { display: false },
        },
        y: {
          ticks: {
            color: "#6b7280",
            callback(value) {
              return formatCurrencyCompact(value);
            },
          },
          grid: {
            color: "rgba(255, 255, 255, 0.04)",
          },
        },
      },
    },
  });

  categoryDonutChart = new Chart(categoryDonutCtx, {
    type: "doughnut",
    data: {
      labels: categories,
      datasets: [
        {
          data: [0, 0, 0, 0],
          backgroundColor: [
            "rgba(255, 122, 38, 0.9)",
            "rgba(248, 113, 113, 0.9)",
            "rgba(59, 130, 246, 0.9)",
            "rgba(52, 211, 153, 0.9)",
          ],
          borderWidth: 0,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "65%",
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          callbacks: {
            label(context) {
              const label = context.label || "";
              const value = context.parsed || 0;
              return `${label}: ${formatCurrency(value)}`;
            },
          },
        },
      },
    },
  });
}

function updateCharts(summary) {
  if (!categoryBarChart || !monthlyLineChart || !categoryDonutChart) {
    return;
  }

  // Category bar chart
  const barData = categories.map((c) => summary.byCategory[c] || 0);
  categoryBarChart.data.datasets[0].data = barData;
  categoryBarChart.update();

  // Monthly trend line chart (use up to 6 latest months)
  const buckets = getAllMonthBuckets();
  const lastBuckets = buckets.slice(-6);
  const labels = lastBuckets.map((b) =>
    new Date(b.year, b.month, 1).toLocaleDateString(undefined, {
      month: "short",
      year: "2-digit",
    }),
  );
  const values = lastBuckets.map((b) => b.total);
  monthlyLineChart.data.labels = labels;
  monthlyLineChart.data.datasets[0].data = values;
  monthlyLineChart.update();

  // Donut chart
  categoryDonutChart.data.datasets[0].data = barData;
  categoryDonutChart.update();
}

// Modal helpers
function openAddModal() {
  modalTitle.textContent = "Add Expense";
  expenseIdInput.value = "";
  const today = new Date();
  expenseDateInput.value = today.toISOString().slice(0, 10);
  expenseCategoryInput.value = "";
  expenseDescriptionInput.value = "";
  expenseAmountInput.value = "";
  expenseModal.classList.add("is-open");
}

function openEditModal(id) {
  const tx = transactions.find((t) => t.id === id);
  if (!tx) return;
  modalTitle.textContent = "Edit Expense";
  expenseIdInput.value = tx.id;
  expenseDateInput.value = tx.date;
  expenseCategoryInput.value = tx.category;
  expenseDescriptionInput.value = tx.description || "";
  expenseAmountInput.value = tx.amount;
  expenseModal.classList.add("is-open");
}

function closeModal() {
  expenseModal.classList.remove("is-open");
}

function handleDelete(id) {
  const tx = transactions.find((t) => t.id === id);
  const confirmDelete = window.confirm(
    tx
      ? `Delete ${formatCurrency(tx.amount)} on ${new Date(
          tx.date,
        ).toLocaleDateString()}?`
      : "Delete this expense?",
  );
  if (!confirmDelete) return;
  transactions = transactions.filter((t) => t.id !== id);
  saveTransactions();
  renderMonthSelect();
  renderSummary();
}

// Event wiring
function setupNav() {
  navButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const section = btn.getAttribute("data-section");
      if (!section) return;
      navButtons.forEach((b) => b.classList.remove("is-active"));
      btn.classList.add("is-active");

      Object.entries(sections).forEach(([key, el]) => {
        if (key === section) {
          el.classList.add("is-active");
        } else {
          el.classList.remove("is-active");
        }
      });
    });
  });
}

function setupModal() {
  openAddModalBtn.addEventListener("click", openAddModal);
  openAddModalBtnTable.addEventListener("click", openAddModal);
  closeModalBtn.addEventListener("click", closeModal);
  cancelModalBtn.addEventListener("click", closeModal);
  expenseModal
    .querySelector(".modal__backdrop")
    .addEventListener("click", closeModal);

  expenseForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const id = expenseIdInput.value || `tx_${Date.now()}`;
    const date = expenseDateInput.value;
    const category = expenseCategoryInput.value;
    const description = expenseDescriptionInput.value.trim();
    const amount = Number(expenseAmountInput.value);
    if (!date || !category || Number.isNaN(amount) || amount <= 0) {
      alert("Please provide a valid date, category, and positive amount.");
      return;
    }

    const existingIndex = transactions.findIndex((t) => t.id === id);
    const tx = { id, date, category, description, amount };
    if (existingIndex >= 0) {
      transactions[existingIndex] = tx;
    } else {
      transactions.push(tx);
    }
    saveTransactions();

    // If user added a transaction in a different month, switch to that month
    const d = new Date(date);
    if (!Number.isNaN(d.getTime())) {
      currentYear = d.getFullYear();
      currentMonth = d.getMonth();
    }

    renderMonthSelect();
    renderSummary();
    closeModal();
  });
}

function setupMonthSelect() {
  monthSelect.addEventListener("change", () => {
    const value = monthSelect.value; // yyyy-mm
    if (!value) return;
    const [y, mStr] = value.split("-");
    currentYear = Number(y);
    currentMonth = Number(mStr) - 1;
    renderSummary();
  });
}

function seedDemoDataIfEmpty() {
  if (transactions.length > 0) return;
  const now = new Date();
  const currentYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
    2,
    "0",
  )}`;

  const sample = [
    {
      date: `${currentYm}-02`,
      category: "Food",
      description: "Groceries",
      amount: 2200,
    },
    {
      date: `${currentYm}-03`,
      category: "Fuel",
      description: "Petrol",
      amount: 1200,
    },
    {
      date: `${currentYm}-05`,
      category: "Travel",
      description: "Cab ride",
      amount: 650,
    },
    {
      date: `${currentYm}-07`,
      category: "Personal",
      description: "Gym membership",
      amount: 1800,
    },
  ];

  transactions = sample.map((tx, idx) => ({
    id: `seed_${idx}`,
    ...tx,
  }));
  saveTransactions();
}

function resetAllData() {
  const ok = window.confirm(
    "This will clear all existing expenses and reset your reports. Continue?",
  );
  if (!ok) return;
  transactions = [];
  saveTransactions();

  const now = new Date();
  currentYear = now.getFullYear();
  currentMonth = now.getMonth();

  renderMonthSelect();
  renderSummary();
}

function handleUpdateIncome() {
  const key = getCurrentYearMonthKey();
  const current = Number(incomeByMonth[key]) || 0;
  const input = window.prompt(
    "Enter monthly income for this month:",
    current ? String(current) : "",
  );
  if (input === null) return;
  const value = Number(input);
  if (Number.isNaN(value) || value < 0) {
    alert("Please enter a valid non-negative number.");
    return;
  }
  incomeByMonth[key] = value;
  saveIncomeMap();
  renderSummary();
}

function showAuthScreen() {
  if (authScreen) authScreen.style.display = "flex";
  if (appShell) appShell.style.display = "none";
  if (loginForm) loginForm.style.display = "";
  if (signupForm) signupForm.style.display = "none";
  if (loginUsername) loginUsername.value = "";
  if (loginPassword) loginPassword.value = "";
  if (signupUsername) signupUsername.value = "";
  if (signupPassword) signupPassword.value = "";
  if (signupConfirm) signupConfirm.value = "";
}

function hideAuthScreen() {
  if (authScreen) authScreen.style.display = "none";
  if (appShell) appShell.style.display = "grid";
}

function showApp() {
  hideAuthScreen();
  const name = currentUser
    ? currentUser.charAt(0).toUpperCase() + currentUser.slice(1).toLowerCase()
    : "—";
  if (sidebarUserName) sidebarUserName.textContent = name;
  if (sidebarUserInitial) {
    sidebarUserInitial.textContent = currentUser ? currentUser.charAt(0).toUpperCase() : "?";
  }
}

function handleLogin(e) {
  e.preventDefault();
  const username = (loginUsername && loginUsername.value.trim()) || "";
  const password = loginPassword ? loginPassword.value : "";
  if (!username || !password) {
    alert("Please enter username and password.");
    return;
  }
  // Default user
  if (username === DEFAULT_USERNAME && password === DEFAULT_PASSWORD) {
    setCurrentUser(DEFAULT_USERNAME);
    loadUserData();
    showApp();
    init();
    return;
  }
  const users = getUsers();
  if (!users[username] || users[username].password !== password) {
    alert("Invalid username or password.");
    return;
  }
  setCurrentUser(username);
  loadUserData();
  showApp();
  init();
}

function handleSignup(e) {
  e.preventDefault();
  const username = (signupUsername && signupUsername.value.trim()) || "";
  const password = signupPassword ? signupPassword.value : "";
  const confirm = signupConfirm ? signupConfirm.value : "";
  if (!username) {
    alert("Please choose a username.");
    return;
  }
  if (password.length < 4) {
    alert("Password must be at least 4 characters.");
    return;
  }
  if (password !== confirm) {
    alert("Passwords do not match.");
    return;
  }
  const users = getUsers();
  if (users[username]) {
    alert("Username already exists. Please login or choose another.");
    return;
  }
  users[username] = { password };
  saveUsers(users);
  setCurrentUser(username);
  transactions = [];
  incomeByMonth = {};
  saveTransactions();
  // Ask new user for personal monthly income
  const incomeStr = window.prompt("Enter your personal monthly income (₹):", "");
  if (incomeStr !== null) {
    const incomeNum = Number(incomeStr);
    if (!Number.isNaN(incomeNum) && incomeNum >= 0) {
      const now = new Date();
      const key = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      incomeByMonth[key] = incomeNum;
      saveIncomeMap();
    }
  }
  loadUserData();
  showApp();
  init();
}

function loadUserData() {
  transactions = loadTransactions();
  incomeByMonth = loadIncomeMap();
  // One-time migration: if default user has no data but old global key has data, copy it
  if (currentUser === DEFAULT_USERNAME && transactions.length === 0) {
    try {
      const raw = localStorage.getItem(STORAGE_PREFIX_TRANSACTIONS);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          transactions = parsed;
          saveTransactions();
        }
      }
      const rawIncome = localStorage.getItem(STORAGE_PREFIX_INCOME);
      if (rawIncome) {
        const parsed = JSON.parse(rawIncome);
        if (parsed && typeof parsed === "object") {
          incomeByMonth = parsed;
          saveIncomeMap();
        }
      }
    } catch {
      // ignore
    }
  }
}

function handleLogout() {
  clearCurrentUser();
  transactions = [];
  incomeByMonth = {};
  showAuthScreen();
}

function setupAuth() {
  if (showSignupBtn) {
    showSignupBtn.addEventListener("click", () => {
      if (loginForm) loginForm.style.display = "none";
      if (signupForm) signupForm.style.display = "";
    });
  }
  if (showLoginBtn) {
    showLoginBtn.addEventListener("click", () => {
      if (signupForm) signupForm.style.display = "none";
      if (loginForm) loginForm.style.display = "";
    });
  }
  if (loginForm) loginForm.addEventListener("submit", handleLogin);
  if (signupForm) signupForm.addEventListener("submit", handleSignup);
  if (logoutBtn) logoutBtn.addEventListener("click", handleLogout);
}

function init() {
  const now = new Date();
  currentYear = now.getFullYear();
  currentMonth = now.getMonth();

  setupNav();
  setupModal();
  setupMonthSelect();
  initCharts();

  if (resetDataBtn) {
    resetDataBtn.addEventListener("click", resetAllData);
  }
  if (incomeButton) {
    incomeButton.addEventListener("click", handleUpdateIncome);
  }

  renderMonthSelect();
  renderSummary();
}

function bootstrap() {
  setupAuth();
  const savedUser = getCurrentUser();
  if (savedUser) {
    currentUser = savedUser;
    loadUserData();
    showApp();
    init();
  } else {
    showAuthScreen();
  }
}

window.addEventListener("DOMContentLoaded", bootstrap);

// ===============================
// PWA - Service Worker Register
// ===============================

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("./service-worker.js")
      .then(reg => {
        console.log("Service Worker Registered:", reg.scope);
      })
      .catch(err => {
        console.log("Service Worker Registration Failed:", err);
      });
  });
}