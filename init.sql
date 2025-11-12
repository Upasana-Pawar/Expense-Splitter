-- init.sql
-- Creates tables and seeds demo data with explicit compact IDs

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,   -- no AUTOINCREMENT: we will control ID assignment
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  payer_id INTEGER NOT NULL,
  amount REAL NOT NULL,
  description TEXT,
  participants TEXT NOT NULL, -- comma-separated user ids
  created_at INTEGER DEFAULT (strftime('%s','now')),
  FOREIGN KEY(payer_id) REFERENCES users(id)
);

-- Seed users with explicit compact IDs (1,2,3)
DELETE FROM users;
INSERT INTO users (id, name) VALUES
  (1, 'You'),
  (2, 'Aaroha'),
  (3, 'Upasana');

-- Seed a sample expense matching the seeded users
DELETE FROM expenses;
INSERT INTO expenses (payer_id, amount, description, participants) VALUES
  (1, 600.0, 'lunch', '1,2,3');
