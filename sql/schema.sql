CREATE TABLE IF NOT EXISTS albums (id TEXT PRIMARY KEY, title TEXT NOT NULL, category TEXT NOT NULL, description TEXT DEFAULT '', private INTEGER NOT NULL DEFAULT 0, password_hash TEXT DEFAULT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS photos (id TEXT PRIMARY KEY, album_id TEXT NOT NULL, filename TEXT NOT NULL, original_key TEXT NOT NULL, preview_key TEXT, mime TEXT NOT NULL, bytes INTEGER NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(album_id) REFERENCES albums(id));
CREATE INDEX IF NOT EXISTS idx_photos_album ON photos(album_id);
INSERT OR IGNORE INTO albums (id,title,category) VALUES ('center1','Sao Mai Center 1','services'),('center2','Sao Mai Center 2','services'),('rooms','Hệ thống phòng nghỉ','services'),('pickleball','Sân Pickleball','services'),('tennis','Sân Tennis','services'),('vip-dining','Phòng ăn VIP','services'),('gym','Phòng Gym','services'),('pool','Hồ bơi','services'),('poolside','Nhà hàng Poolside','services');

-- Seven official room categories; no prices stored or displayed.
INSERT OR IGNORE INTO albums (id,title,category,description) VALUES ('family-villa','Biệt thự gia đình – Family Villa','room-types','130 m² · 4 khách');
INSERT OR IGNORE INTO albums (id,title,category,description) VALUES ('suite-villa','Biệt thự cao cấp – Suite Villa','room-types','60 m² · 2 khách');
INSERT OR IGNORE INTO albums (id,title,category,description) VALUES ('sweety-room','Phòng tình yêu – Sweety Room','room-types','40 m² · 2 khách');
INSERT OR IGNORE INTO albums (id,title,category,description) VALUES ('deluxe','Phòng cao cấp – Deluxe','room-types','35 m² · 2 khách');
INSERT OR IGNORE INTO albums (id,title,category,description) VALUES ('superior','Phòng trung cấp – Superior','room-types','33 m² · 2 khách');
INSERT OR IGNORE INTO albums (id,title,category,description) VALUES ('standard-b','Phòng tiêu chuẩn B – Standard Room B','room-types','20 m² · 1 khách');
INSERT OR IGNORE INTO albums (id,title,category,description) VALUES ('standard-a','Phòng tiêu chuẩn A – Standard Room A','room-types','17 m² · 1 khách');
