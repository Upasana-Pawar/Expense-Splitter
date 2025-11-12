// public/app.js
// Frontend logic for Expense Splitter (complete file)
// Currency display changed to Indian Rupees (INR) with proper formatting

// Helper: call backend API
async function api(path, opts = {}) {
  const res = await fetch('/api' + path, Object.assign({
    headers: { 'Content-Type': 'application/json' }
  }, opts));
  if (!res.ok) {
    let txt = await res.text();
    try { txt = JSON.parse(txt).error || txt; } catch(e){}
    throw new Error(txt);
  }
  return res.json();
}

// DOM refs
const usersUL = document.getElementById('users');
const userForm = document.getElementById('user-form');
const userNameIn = document.getElementById('user-name');

const payerSelect = document.getElementById('payer');
const participantsSelect = document.getElementById('participants');
const amountIn = document.getElementById('amount');
const descrIn = document.getElementById('descr');
const expenseForm = document.getElementById('expense-form');

const expensesDiv = document.getElementById('expenses');
const balancesDiv = document.getElementById('balances');
const currentUserSel = document.getElementById('current-user');
const totalsDiv = document.getElementById('totals');

// viewing-as label
const viewingAsLabel = document.getElementById('viewing-as');

const btnClearExpense = document.getElementById('btn-clear-expense');

let users = [];

// ---------- Currency formatting helper (INR) ----------
const currencyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

// Use this everywhere to display amounts
function formatCurrency(amount) {
  // ensure number
  const n = Number(amount) || 0;
  return currencyFormatter.format(n);
}

// Initialization
async function load() {
  try {
    users = await api('/users');
    renderUsers();
    fillSelects();
    await loadSummary();
  } catch (err) {
    console.error('Load error:', err);
    alert('Error loading app: ' + err.message);
  }
}

// Render users
function renderUsers() {
  usersUL.innerHTML = '';
  currentUserSel.innerHTML = '';

  users.forEach(u => {
    const li = document.createElement('li');
    li.innerHTML = `
      <div class="friend-left">
        <div class="id-pill">${escapeHtml(String(u.id))}</div>
        <div class="friend-name">${escapeHtml(u.name)}</div>
      </div>
      <div class="friend-actions">
        <button data-id="${u.id}" class="del" title="Delete user">Delete</button>
      </div>
    `;
    usersUL.appendChild(li);

    const opt = document.createElement('option');
    opt.value = String(u.id);
    opt.textContent = u.name;
    currentUserSel.appendChild(opt);
  });

  if (!currentUserSel.value && users.length) {
    currentUserSel.value = String(users[0].id);
  }
}

// Fill selects
function fillSelects() {
  payerSelect.innerHTML = '';
  participantsSelect.innerHTML = '';
  users.forEach(u => {
    const o1 = document.createElement('option');
    o1.value = String(u.id);
    o1.textContent = u.name;
    payerSelect.appendChild(o1);

    const o2 = document.createElement('option');
    o2.value = String(u.id);
    o2.textContent = u.name;
    participantsSelect.appendChild(o2);
  });
}

// Add friend
userForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = userNameIn.value.trim();
  if (!name) return;
  try {
    await api('/users', { method: 'POST', body: JSON.stringify({ name }) });
    userNameIn.value = '';
    await load();
  } catch (err) {
    console.error('Add user error', err);
    alert('Could not add user: ' + err.message);
  }
});

// Delete friend
usersUL.addEventListener('click', async (e) => {
  const btn = e.target.closest('button.del');
  if (!btn) return;
  const id = btn.dataset.id;
  if (!id) return;
  if (!confirm('Delete user? This will remove them from the database.')) return;
  try {
    await api('/users/' + id, { method: 'DELETE' });
    await load();
  } catch (err) {
    console.error('Delete user error', err);
    alert('Could not delete user: ' + err.message);
  }
});

// Add expense
expenseForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const payer_id = Number(payerSelect.value);
  const amount = Number(amountIn.value);
  const description = descrIn.value.trim();
  const participants = Array.from(participantsSelect.selectedOptions).map(o => Number(o.value));

  if (!payer_id || !amount || !participants.length) {
    return alert('Please fill payer, amount and participants.');
  }

  try {
    await api('/expenses', { method: 'POST', body: JSON.stringify({ payer_id, amount, description, participants }) });
    amountIn.value = ''; descrIn.value = ''; participantsSelect.selectedIndex = -1;
    await load();
  } catch (err) {
    console.error('Add expense error', err);
    alert('Could not add expense: ' + err.message);
  }
});

// Clear form
btnClearExpense.addEventListener('click', () => {
  amountIn.value = ''; descrIn.value = ''; participantsSelect.selectedIndex = -1;
});

// Load summary
async function loadSummary() {
  try {
    const data = await api('/summary');
    renderExpenses(data.expenses);
    renderBalances(data.users);
  } catch (err) {
    console.error('Summary load error', err);
    alert('Could not load summary: ' + err.message);
  }
}

// Render expenses
function renderExpenses(expenses) {
  expensesDiv.innerHTML = '';
  if (!expenses || !expenses.length) {
    expensesDiv.innerHTML = `<div class="expense-item"><div class="expense-meta"><div class="expense-title">No expenses yet</div><div class="expense-desc muted">Add an expense to get started</div></div></div>`;
    return;
  }

  expenses.forEach(e => {
    const parts = String(e.participants || '').split(',').map(s => Number(s)).filter(Boolean);
    const partNames = parts.map(id => users.find(u => u.id === id)?.name || '?').join(', ');
    const payer = users.find(u => u.id === e.payer_id)?.name || '?';

    const wrapper = document.createElement('div');
    wrapper.className = 'expense-item';
    wrapper.innerHTML = `
      <div class="expense-meta">
        <div class="expense-title">${escapeHtml(e.description || 'Expense')}</div>
        <div class="expense-desc">Paid by ${escapeHtml(payer)} • ${escapeHtml(partNames)}</div>
      </div>
      <div style="text-align:right;">
        <div style="font-weight:700">${formatCurrency(Number(e.amount).toFixed(2))}</div>
        <div style="margin-top:8px"><button data-id="${e.id}" class="del-exp">Delete</button></div>
      </div>
    `;
    expensesDiv.appendChild(wrapper);
  });

  document.querySelectorAll('.del-exp').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete expense?')) return;
      try {
        await api('/expenses/' + btn.dataset.id, { method: 'DELETE' });
        await load();
      } catch (err) {
        console.error('Delete expense error', err);
        alert('Could not delete expense: ' + err.message);
      }
    });
  });
}

// Render balances
function renderBalances(usersBal) {
  balancesDiv.innerHTML = '';
  let totalOwe = 0;
  let totalOwed = 0;

  if (!currentUserSel.value && users.length) currentUserSel.value = String(users[0].id);
  showViewingAs();

  usersBal.forEach(u => {
    const balRow = document.createElement('div');
    balRow.className = 'bal-row';
    let badgeHtml = '';

    if (u.balance > 0) {
      badgeHtml = `<span class='badge owed'>${formatCurrency(Number(u.balance).toFixed(2)).replace(/\u00A0/g, ' ')} </span>`;
      totalOwed += Number(u.balance);
    } else if (u.balance < 0) {
      badgeHtml = `<span class='badge owe'>${'Owes ' + formatCurrency(Math.abs(Number(u.balance)).toFixed(2)).replace(/\u00A0/g, ' ')}</span>`;
      totalOwe += Math.abs(Number(u.balance));
    } else {
      badgeHtml = `<span class='badge settled'>Settled</span>`;
    }

    balRow.innerHTML = `<div>${escapeHtml(u.name)}</div><div>${badgeHtml}</div>`;
    balancesDiv.appendChild(balRow);
  });

  totalsDiv.innerHTML = `<div><strong>Total owed:</strong> ${formatCurrency(Number(totalOwe).toFixed(2))} &nbsp; | &nbsp; <strong>Total owed to:</strong> ${formatCurrency(Number(totalOwed).toFixed(2))}</div>`;
}

// Viewing-as label logic
function showViewingAs() {
  if (!viewingAsLabel) return;
  const idx = currentUserSel.selectedIndex;
  const text = idx >= 0 ? currentUserSel.options[idx].textContent : '';
  if (!text) {
    viewingAsLabel.classList.remove('active');
    viewingAsLabel.textContent = '';
    return;
  }
  viewingAsLabel.textContent = `👀 Viewing as ${text}`;
  viewingAsLabel.classList.add('active');

  clearTimeout(showViewingAs._timeout);
  showViewingAs._timeout = setTimeout(() => {
    viewingAsLabel.classList.remove('active');
  }, 2500);
}

// View-as change handler
currentUserSel.addEventListener('change', () => {
  showViewingAs();
  loadSummary();
});

// Utility: escape HTML
function escapeHtml(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Init
load();
