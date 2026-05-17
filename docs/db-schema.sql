-- Cloudflare D1 schema for Echo Garden Father’s Day MVP

CREATE TABLE IF NOT EXISTS gift_sessions (
  id TEXT PRIMARY KEY,
  token TEXT NOT NULL UNIQUE,
  lp_id TEXT NOT NULL UNIQUE,
  order_id TEXT,
  payment_status TEXT DEFAULT 'manual_confirmed',
  status TEXT NOT NULL DEFAULT 'draft',
  max_attempts INTEGER NOT NULL DEFAULT 2,
  attempts_used INTEGER NOT NULL DEFAULT 0,
  selected_artwork_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT,
  submitted_at TEXT
);

CREATE TABLE IF NOT EXISTS artworks (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  attempt_number INTEGER NOT NULL,
  image_url TEXT,
  video_url TEXT,
  original_media_url TEXT,
  audio_url TEXT,
  thumbnail_url TEXT,
  media_type TEXT,
  duration_seconds REAL,
  width INTEGER,
  height INTEGER,
  aspect_ratio TEXT,
  status TEXT NOT NULL DEFAULT 'created',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES gift_sessions(id)
);

CREATE INDEX IF NOT EXISTS idx_artworks_session_id
ON artworks(session_id);

CREATE TABLE IF NOT EXISTS gift_messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL UNIQUE,
  to_display_name TEXT NOT NULL,
  from_display_name TEXT NOT NULL,
  message TEXT NOT NULL,
  public_to_name TEXT,
  public_from_name TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES gift_sessions(id)
);

CREATE TABLE IF NOT EXISTS shipping_addresses (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL UNIQUE,
  recipient_name TEXT NOT NULL,
  postal_code TEXT NOT NULL,
  address_line1 TEXT NOT NULL,
  address_line2 TEXT,
  sender_name TEXT,
  sender_postal_code TEXT,
  sender_address_line1 TEXT,
  sender_address_line2 TEXT,
  phone TEXT,
  shipping_status TEXT NOT NULL DEFAULT 'unshipped',
  shipped_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES gift_sessions(id)
);

CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  session_id TEXT,
  event_type TEXT NOT NULL,
  payload_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES gift_sessions(id)
);
