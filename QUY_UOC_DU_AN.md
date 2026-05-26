# QUY ƯỚC DỰ ÁN (PROJECT GUIDELINES)

*Tài liệu này dùng để làm "hợp đồng giao tiếp" giữa các lập trình viên và các trợ lý AI (Antigravity) khi cùng làm việc trên dự án NSL Partner Portal.*

## 1. Công nghệ sử dụng (Tech Stack)
- **Backend:** Node.js, Express.js.
- **Database:** Trực tiếp sử dụng Google Sheets API (`googleapis`) đọc từ file Google Sheets của NSL.
- **Frontend / Giao diện:** EJS (Templating Engine) + CSS thuần (`nsl-design-system.css`).
- **Đa ngôn ngữ (i18n):** Tự xây dựng middleware xử lý đa ngôn ngữ dựa trên query URL `?lang=en|vi|de`.

## 2. Cấu trúc thư mục (Folder Structure)
- `/server.js`: File gốc khởi chạy server, chứa tất cả các route logic.
- `/services/sheets.js`: Nơi duy nhất xử lý kết nối và format dữ liệu kéo từ Google Sheets về.
- `/services/googleAuth.js`: Chứa logic xác thực OAuth2 / Service Account với Google.
- `/middlewares/i18n.js`: Lưu trữ từ điển dịch thuật (vi, en, de) và logic gán ngôn ngữ.
- `/views/`: Chứa tất cả các trang giao diện HTML (EJS).
  - `/views/login.ejs`: Trang đăng nhập.
  - `/views/profile.ejs`: Trang chi tiết học viên (Setcard Online).
  - `/views/partner/dashboard.ejs`: Bảng điều khiển dành riêng cho đối tác (Partner).
  - `/views/admin/dashboard.ejs`: Bảng điều khiển của Admin.
- `/public/css/`: Chứa file CSS dùng chung (`nsl-design-system.css`).

## 3. Cấu trúc Dữ liệu Học viên (Student Data Contract)
Khi Frontend (EJS) nhận được object `student`, nó được đảm bảo sẽ có các trường (fields) cơ bản sau:
- `StudentID`, `FullName`, `CenterCode`
- `NSLScore`: Điểm đánh giá năng lực NSL.
- `AvailableFrom`: Lấy từ cột "Availability" bên tab CHECKLIST.
- `ProfessionCode`: Chứa danh sách mã nghề (vd: `ZFA, GASTRONOMIE`). Đã được gộp từ cột "APPLIED PROFESSIONS".
- `DeutschLevel`: Trình độ tiếng Đức (vd: `B1`, `B2`).

## 4. Quy tắc phát triển giao diện (UI Rules)
- **Thiết kế Wavy Header:** Tất cả các trang đều phải dùng chung dải sóng Vàng-Đỏ trên đầu trang (Height: 180px, mã màu `#f2a900` và `#cc1f1f`).
- **Màu sắc Trung tâm (Center Colors):** 
  - ANG = Đỏ (`#EA4335`)
  - HDEU = Xanh dương (`#4285F4`)
  - DIE = Nâu (`#8D6E63`)
  - LA = Vàng (`#FBBC04`)
  - NW = Xanh lá (`#34A853`)
- **Mã màu chuẩn:** Ưu tiên dùng các biến CSS toàn cục đã định nghĩa trong `:root` của file `nsl-design-system.css` (ví dụ: `var(--nsl-red)`).

## 5. Dành riêng cho Antigravity (AI Instructions)
- **Dành cho Antigravity A:** Mỗi khi bạn thêm thư viện mới (`npm install`), sửa cấu trúc `student` trong `sheets.js`, hoặc đổi thiết kế CSS quan trọng, bạn **BẮT BUỘC** phải cập nhật thông tin đó vào file này.
- **Dành cho Antigravity B:** Trước khi thực hiện sửa lỗi hay thêm tính năng, hãy đọc file này để nắm cấu trúc hiện tại, tránh việc tự chế ra biến mới (ví dụ không được dùng `student.Availability` vì nó đã được chuẩn hóa thành `student.AvailableFrom`).
