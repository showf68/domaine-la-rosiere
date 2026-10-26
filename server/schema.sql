CREATE TABLE IF NOT EXISTS blocks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL,        -- 'direct' | 'abritel' | 'airbnb' ...
  ref TEXT NOT NULL,
  start TEXT NOT NULL,         -- AAAA-MM-JJ (première nuit)
  end TEXT NOT NULL,           -- AAAA-MM-JJ (jour de départ, exclu)
  UNIQUE (source, ref)
);
CREATE TABLE IF NOT EXISTS requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  arrival TEXT, departure TEXT, people INTEGER, kind TEXT, name TEXT, email TEXT, phone TEXT,
  sheets INTEGER, towels INTEGER, message TEXT, estimate INTEGER, created TEXT
);
