# Sao Mai Phu My Resort – Photo Gallery 1.0

Website thư viện ảnh 4 ngôn ngữ, upload nhiều ảnh, lưu bản gốc và preview trên R2, quản lý D1, album riêng tư có mật khẩu, tải ảnh đơn và ZIP tối đa 25 ảnh/lượt trên trình duyệt.

## 1. Đưa lên GitHub
Giải nén ZIP, tạo repository GitHub và upload toàn bộ file/thư mục (không upload ZIP lồng bên trong).

## 2. Cloudflare D1
Cloudflare Dashboard > Workers & Pages > D1 > Create database: `sao-mai-gallery-db`.
Vào Console của D1, chạy nội dung `sql/schema.sql` (hoặc dùng `npx wrangler d1 execute sao-mai-gallery-db --remote --file=./sql/schema.sql` sau khi đăng nhập wrangler).

## 3. Cloudflare R2
R2 > Create bucket: `sao-mai-gallery`. Không cần public bucket; API đọc ảnh qua Pages Functions.

## 4. Cloudflare Pages
Workers & Pages > Create > Pages > Connect to GitHub repository.
Framework preset: None. Build command: `npm run build`. Build output directory: `dist`.

Trong Pages > Settings > Functions > Bindings (hoặc Settings > Bindings tùy giao diện):
- D1 database binding: **DB** -> `sao-mai-gallery-db`
- R2 bucket binding: **PHOTOS** -> `sao-mai-gallery`

Trong Settings > Variables and Secrets thêm **Secrets** (không lưu vào GitHub):
- `ADMIN_PASSWORD`: mật khẩu mạnh, riêng biệt
- `SESSION_SECRET`: chuỗi ngẫu nhiên tối thiểu 32 ký tự

Deploy lại sau khi thêm bindings và secrets. Sau đó mở URL `*.pages.dev`.

## 5. Kiểm tra
- Trang chủ có 5 album mặc định.
- Nhấn Quản trị, đăng nhập, upload 1 ảnh vào Center 1.
- Kiểm tra xem ảnh, tải gốc và chọn ảnh tải ZIP.
- Tạo album sự kiện có mật khẩu và thử xem ở cửa sổ ẩn danh.

## 6. Lưu ý bảo mật, vận hành
- Chỉ sử dụng HTTPS; cookie admin HttpOnly, Secure, SameSite=Lax, HMAC ký bằng secret.
- Album có mật khẩu không phải giải pháp kiểm soát truy cập doanh nghiệp; mật khẩu album được truyền trong URL khi truy xuất ảnh và có thể lưu trong lịch sử trình duyệt. Không dùng cho ảnh nhạy cảm. Cần nâng cấp phiên xác thực album trước khi sử dụng riêng tư thực tế.
- Không có rate-limit riêng cho đăng nhập; nên cấu hình Cloudflare WAF/rate limiting nếu website công khai.
- Đang giới hạn 25 MB/ảnh do upload qua Pages Functions. Ảnh lớn cần direct upload R2 có chữ ký trong bản nâng cấp.
- ZIP được tạo tại trình duyệt, tối đa 25 ảnh/lượt, có thể tốn RAM trên điện thoại. Không phù hợp album hàng nghìn ảnh.
- Thư viện JSZip tải qua jsDelivr CDN; nếu mạng chặn CDN này, chức năng ZIP sẽ không hoạt động.
- Tạo preview trên trình duyệt bằng canvas; ảnh HEIC/RAW không được đảm bảo hỗ trợ.
- Chưa có phân trang, quota monitor, nén ảnh server, chức năng sửa album hoặc sao lưu tự động.
- Không lưu dữ liệu ảnh chỉ ở một nơi: thiết lập sao lưu R2/D1 định kỳ.
- R2 free tier có giới hạn lưu trữ và request; theo dõi Billing trong Cloudflare.

## Cấu trúc
`public/` giao diện, `functions/api/[[path]].js` API Pages Functions, `sql/schema.sql` dữ liệu ban đầu.

## Danh mục dịch vụ mặc định (9)
Center 1, Center 2, Hệ thống phòng nghỉ, Sân Pickleball, Sân Tennis, Phòng ăn VIP, Phòng Gym, Hồ bơi, Nhà hàng Poolside.

Nếu D1 đã được khởi tạo ở bản trước, chạy lại `sql/schema.sql` trên D1 để thêm 4 danh mục mới; các câu lệnh `INSERT OR IGNORE` không xóa album/ảnh hiện có.


## v1.2 – Album riêng cho từng hạng phòng
- Trang **Hệ thống phòng nghỉ** dẫn đến danh sách album hạng phòng.
- Vào **Quản trị → Tạo album → Loại album: Hạng phòng nghỉ**, đặt tên đúng với các hạng phòng thực tế của resort, rồi upload ảnh vào từng album.
- Không tạo sẵn tên hạng phòng chưa được xác nhận.
- Các album và ảnh cũ vẫn giữ nguyên. Ảnh trước đây upload vào album `rooms` vẫn nằm trong kho nhưng không hiện trong danh sách hạng phòng; hãy tạo album hạng phòng mới và tải lại ảnh nếu cần.
- Đây là bản cập nhật mã nguồn, cần triển khai và kiểm thử trên Cloudflare trước khi dùng chính thức.

## v1.3 – 7 hạng phòng chính thức, ẩn toàn bộ giá
- `sql/schema.sql` khởi tạo sẵn 7 album phòng: Family Villa, Suite Villa, Sweety Room, Deluxe, Superior, Standard Room B, Standard Room A.
- Chỉ hiển thị tên, diện tích, sức chứa và ảnh. **Không lưu hoặc hiển thị giá phòng/dịch vụ**.
- Album phòng hiển thị trong mục **Hệ thống phòng nghỉ**. Không cần tạo thủ công 7 album nữa.
- Nếu đã chạy schema bản trước, chạy lại schema mới (INSERT OR IGNORE không xóa ảnh cũ).
- Sau khi tạo D1/R2, gắn bindings và secrets, deploy lại Pages; chưa có ảnh cho tới khi admin upload.
- Không upload bảng giá phòng có giá như ảnh giới thiệu công khai nếu muốn ẩn giá hoàn toàn.
