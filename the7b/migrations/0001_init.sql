-- 7B winter pilot schema

CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  email TEXT UNIQUE NOT NULL COLLATE NOCASE,
  display_name TEXT UNIQUE NOT NULL COLLATE NOCASE,
  pass_hash TEXT NOT NULL,
  is_admin INTEGER NOT NULL DEFAULT 0,
  mailing_consent INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- token holds the SHA-256 of the cookie value, never the cookie itself.
CREATE TABLE sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL
);
CREATE INDEX sessions_user ON sessions(user_id);

CREATE TABLE objectives (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  points INTEGER NOT NULL CHECK (points >= 0),
  sort INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE submissions (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  objective_id INTEGER NOT NULL REFERENCES objectives(id),
  photo_key TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'removed')),
  reject_reason TEXT,
  featured INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  decided_at TEXT
);
CREATE UNIQUE INDEX one_approved_per_objective
  ON submissions(user_id, objective_id) WHERE status = 'approved';
CREATE UNIQUE INDEX one_pending_per_objective
  ON submissions(user_id, objective_id) WHERE status = 'pending';
CREATE INDEX submissions_wall ON submissions(status, decided_at);
CREATE INDEX submissions_user_day ON submissions(user_id, created_at);

-- Points are a ledger: grants are positive, revocations negative. Totals are sums.
-- reason is one of approve, featured, revoke_approve, revoke_featured.
CREATE TABLE points_ledger (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  submission_id INTEGER REFERENCES submissions(id),
  delta INTEGER NOT NULL,
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
-- Safety net: a submission can never be granted or revoked for the same reason twice.
CREATE UNIQUE INDEX ledger_once_per_reason
  ON points_ledger(submission_id, reason) WHERE submission_id IS NOT NULL;
CREATE INDEX ledger_user ON points_ledger(user_id);

CREATE TABLE happenings (
  id INTEGER PRIMARY KEY,
  text TEXT NOT NULL,
  date_label TEXT,
  sort INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1
);

INSERT INTO objectives (title, description, points, sort) VALUES
  ('Snowman Somewhere Special',
   'Build a snowman anywhere recognizably Sandpoint. Carrot optional. Personality required.', 20, 1),
  ('Liberty in a Beanie',
   'Our Lady of City Beach stands out there all winter. Keep her company — photo with the Statue of Liberty, winter gear encouraged.', 10, 2),
  ('Lights on First',
   'Downtown under the holiday lights. Cocoa optional but strongly encouraged.', 10, 3),
  ('Schweitzer Day',
   'Summit or lodge, skis or snowshoes or just the view — show us your mountain day.', 30, 4),
  ('The Quiet Mile',
   'A winter trail or sledding hill anywhere in Bonner County. The quieter the spot, the better the postcard.', 30, 5);
