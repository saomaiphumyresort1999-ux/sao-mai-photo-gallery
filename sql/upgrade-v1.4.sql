-- Run ONCE in existing Cloudflare D1 Console; keeps all current albums and photos.
-- This conservative quota starts with 0; ONLY use on a new/empty R2 bucket.
-- If R2 already contains objects, inventory all objects and initialize used_bytes to actual total first.
CREATE TABLE IF NOT EXISTS storage_quota (
 id INTEGER PRIMARY KEY CHECK(id=1),
 used_bytes INTEGER NOT NULL DEFAULT 0 CHECK(used_bytes>=0),
 reserved_bytes INTEGER NOT NULL DEFAULT 0 CHECK(reserved_bytes>=0),
 max_bytes INTEGER NOT NULL DEFAULT 8000000000 CHECK(max_bytes<=8000000000)
);
INSERT OR IGNORE INTO storage_quota(id,used_bytes,reserved_bytes,max_bytes) VALUES(1,0,0,8000000000);
SELECT * FROM storage_quota;
