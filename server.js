/*
  server.js
  Node + Express backend for Expense Splitter
  - SQLite persistence (expenses.db created from init.sql)
  - Users inserted with smallest unused positive integer ID
  - Simple REST API: /api/users, /api/expenses, /api/summary
*/

const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const fs = require("fs");
const path = require("path");
const bodyParser = require("body-parser");
const cors = require("cors");

const DB_FILE = path.join(__dirname, "expenses.db");
const INIT_SQL = path.join(__dirname, "init.sql");

// If DB doesn't exist, create it from init.sql
if (!fs.existsSync(DB_FILE)) {
  console.log("DB not found — creating from init.sql");
  const init = fs.readFileSync(INIT_SQL, "utf8");
  const tempDb = new sqlite3.Database(DB_FILE);
  tempDb.exec(init, (err) => {
    if (err) console.error("DB init error:", err);
    else console.log("DB initialized.");
    tempDb.close();
  });
}

const db = new sqlite3.Database(DB_FILE);
const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

// Promise helpers
function runAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}
function allAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

/* ----------- Users API ----------- */
// Get all users
app.get("/api/users", async (req, res) => {
  try {
    const rows = await allAsync("SELECT * FROM users ORDER BY id");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create user: choose smallest unused positive integer id (1,2,3...)
app.post("/api/users", async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: "name required" });

    const rows = await allAsync("SELECT id FROM users ORDER BY id");
    const ids = rows.map((r) => Number(r.id)).filter(Boolean);

    let nextId = 1;
    for (let i = 0; i < ids.length; i++) {
      if (ids[i] === nextId) nextId++;
      else if (ids[i] > nextId) break;
    }

    await runAsync("INSERT INTO users (id, name) VALUES (?, ?)", [nextId, name]);
    const u = await allAsync("SELECT * FROM users WHERE id = ?", [nextId]);
    res.json(u[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Delete user
app.delete("/api/users/:id", async (req, res) => {
  try {
    await runAsync("DELETE FROM users WHERE id = ?", [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ----------- Expenses API ----------- */
// List expenses
app.get("/api/expenses", async (req, res) => {
  try {
    const rows = await allAsync("SELECT * FROM expenses ORDER BY created_at DESC");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create expense
app.post("/api/expenses", async (req, res) => {
  try {
    const { payer_id, amount, description, participants } = req.body;
    if (!payer_id || !amount || !participants || !participants.length)
      return res.status(400).json({ error: "missing fields" });

    const partStr = participants.join(",");
    const r = await runAsync(
      "INSERT INTO expenses (payer_id, amount, description, participants) VALUES (?,?,?,?)",
      [payer_id, amount, description || "", partStr]
    );
    const e = await allAsync("SELECT * FROM expenses WHERE id = ?", [r.lastID]);
    res.json(e[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete expense
app.delete("/api/expenses/:id", async (req, res) => {
  try {
    await runAsync("DELETE FROM expenses WHERE id = ?", [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ----------- Summary API ----------- */
// Returns users with balances and the list of expenses
app.get("/api/summary", async (req, res) => {
  try {
    const users = await allAsync("SELECT * FROM users");
    const expenses = await allAsync("SELECT * FROM expenses");

    const balanceMap = {};
    users.forEach((u) => (balanceMap[u.id] = 0));

    for (const ex of expenses) {
      const parts = ex.participants.split(",").map((s) => Number(s)).filter(Boolean);
      if (!parts.length) continue;
      const share = ex.amount / parts.length;
      for (const pid of parts) {
        if (pid === ex.payer_id) continue;
        balanceMap[pid] -= share;
        balanceMap[ex.payer_id] += share;
      }
    }

    const result = users.map((u) => ({
      id: u.id,
      name: u.name,
      balance: Number((balanceMap[u.id] || 0).toFixed(2)),
    }));

    res.json({ users: result, expenses });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("✅ Server running on port", PORT));
