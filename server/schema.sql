CREATE TABLE IF NOT EXISTS blocks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL,        -- 'direct' | 'manuel' | 'goliday' | 'ical:<nom>'
  ref TEXT NOT NULL,
  start TEXT NOT NULL,         -- AAAA-MM-JJ (première nuit)
  end TEXT NOT NULL,           -- AAAA-MM-JJ (jour de départ, exclu)
  UNIQUE (source, ref)
);
CREATE INDEX IF NOT EXISTS blocks_end ON blocks (end);
CREATE TABLE IF NOT EXISTS requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  arrival TEXT, departure TEXT, nights INTEGER, people INTEGER, kind TEXT, name TEXT, email TEXT, phone TEXT,
  sheets INTEGER, towels INTEGER, message TEXT, estimate INTEGER, status TEXT, created TEXT,
  pi_id TEXT, paid_at TEXT, mail_error TEXT, ip TEXT, mail_subject TEXT, mail_body TEXT, offers INTEGER
);
CREATE TABLE IF NOT EXISTS settings (k TEXT PRIMARY KEY, v TEXT);
CREATE INDEX IF NOT EXISTS requests_created ON requests (created);
