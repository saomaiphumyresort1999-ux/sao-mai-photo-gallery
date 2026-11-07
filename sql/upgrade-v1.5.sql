-- Execute statements separately in Cloudflare D1 Console if needed.
CREATE TABLE IF NOT EXISTS auth_limits (key TEXT PRIMARY KEY, attempts INTEGER NOT NULL DEFAULT 0, window_start INTEGER NOT NULL DEFAULT 0, blocked_until INTEGER NOT NULL DEFAULT 0);
CREATE INDEX IF NOT EXISTS idx_auth_limits_blocked ON auth_limits(blocked_until);
