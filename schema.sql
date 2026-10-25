CREATE TABLE IF NOT EXISTS search_cache (
  cache_key text PRIMARY KEY,
  payload jsonb NOT NULL,
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS search_cache_expiry ON search_cache(expires_at);
CREATE TABLE IF NOT EXISTS request_limits (
  bucket text PRIMARY KEY,
  hits integer NOT NULL DEFAULT 1,
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS request_limits_expiry ON request_limits(expires_at);
