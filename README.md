# Antigravity × Google Flow MCP (Windows 1-Click & Cross-Platform)

Bộ công cụ kết nối trực tiếp **Google Antigravity IDE** với **Google Flow (`labs.google/fx/tools/flow` — Veo 3.1 & Imagen 3)** thông qua **Local MCP Server + Chrome Extension Bridge (`127.0.0.1:8792`)**, đi kèm bộ **Google Flow Skills** tự động hóa tạo ảnh, tạo nhân vật đồng nhất và sản xuất video đa cảnh.

---

## Tính năng chính (Features)

1. **Cài đặt 1-Click chuẩn Windows (`install-windows.bat`):**
   - Tự động xử lý lỗi chặn `ExecutionPolicy` của PowerShell trên Windows bằng cách cấu hình trực tiếp `node.exe` và `npm.cmd`.
   - Tự động đăng ký MCP Server `"deepx-flow"` vào `%USERPROFILE%\.gemini\config\mcp_config.json` (tự tạo bản sao lưu `.bak` và giữ nguyên mọi MCP server khác đã cài trước đó).
   - Tự động nạp bộ `20+` MCP Tool Schemas & Skills vào cấu hình của Antigravity để nhận diện công cụ tức thì (hot-reload).
2. **Thư mục `chrome-extension/` tách rời gọn nhẹ:**
   - Tách sạch mã nguồn Manifest V3 của Chrome Extension khỏi `node_modules/`, giúp thao tác `Load unpacked` trên `chrome://extensions` nhanh tức thì và không báo cảnh báo file thừa.
3. **Bộ Skills chuyên dụng cho Google Flow (`skills/`):**
   - `deepx-rapid-flow`: Tự động hóa sản xuất video đa cảnh, khóa thẻ tham chiếu nhân vật (`@character`) và nối chuyển cảnh liên hoàn.
   - `gemini-storyboard-director`: Phân tích kịch bản, thiết kế góc máy điện ảnh và ánh sáng trên Google Flow.
   - `matanyone-video-matting`: Tối ưu tạo video phông nền tách lớp VFX / chroma key.
   - `retro-8bit-arcade-style`: Tạo hoạt ảnh phong cách pixel art 8-bit / 16-bit trên Veo & Imagen.

---

## Kiến trúc hoạt động (Architecture)

```text
Antigravity Agent ──(stdio MCP)──► mcp-server (Node.js) ◄──(ws://127.0.0.1:8792/ws)──► Chrome Extension ──► flow.google.com
```

- Sử dụng trực tiếp phiên đăng nhập Google Flow trên trình duyệt Chrome của máy bạn (không yêu cầu cấu hình API Key riêng).
- Cầu nối WebSocket chỉ giao tiếp nội bộ trên máy tại `127.0.0.1:8792`.

---

## Yêu cầu hệ thống (Requirements)

- **Windows 10/11** (hoặc macOS / Linux với `setup.sh`).
- **Node.js `v20+`** ([https://nodejs.org/](https://nodejs.org/)).
- **Google Chrome** đã đăng nhập [Google Flow](https://labs.google/fx/tools/flow).
- **Google Antigravity**.

---

## Hướng dẫn cài đặt nhanh trên Windows

### Bước 1: Chạy bộ cài tự động
Clone repo về máy và nhấp đúp chạy **`install-windows.bat`** (hoặc chạy trong Terminal):

```powershell
git clone https://github.com/<your-username>/antigravity-google-flow-mcp.git
cd antigravity-google-flow-mcp
.\install-windows.bat
```

### Bước 2: Gắn Extension vào Chrome (chỉ làm 1 lần)
1. Mở Chrome, truy cập địa chỉ: `chrome://extensions`
2. Bật công tắc **`Developer mode`** ở góc trên cùng bên phải.
3. Bấm nút **`Load unpacked`** ở góc trên bên trái → chọn thư mục **`chrome-extension`** bên trong repo này.

### Bước 3: Mở Project trên Google Flow & Sử dụng
1. Mở `https://labs.google/fx/tools/flow` trên Chrome và bấm **`New project`** (hoặc mở một project có sẵn; nếu vừa cài Extension thì bấm `F5` làm mới trang 1 lần).
2. Mở **Antigravity** — MCP server `deepx-flow` sẽ tự động kết nối sẵn sàng để bạn ra lệnh tạo ảnh, tạo nhân vật và tạo video trực tiếp trên Google Flow.

---

## Danh sách các MCP Tools (`deepx-flow`)

| Tool | Chức năng |
|---|---|
| `deepx_status` | Kiểm tra trạng thái kết nối giữa Antigravity, Chrome Extension và Google Flow |
| `deepx_get_options` | Tra cứu danh sách model (`veo-quality`, `veo-lite`, `veo-omni`, `imagen-3`), tỉ lệ khung hình và chế độ tạo |
| `deepx_upload_asset` | Tải ảnh/video từ máy tính lên thư viện Project của Google Flow (`mediaId`) |
| `deepx_generate_image` | Tạo ảnh trên Google Flow bằng `Imagen 3` / `Nano Banana` |
| `deepx_generate_character` | Tạo và lưu nhân vật đồng nhất (`@character`) trong Character Studio |
| `deepx_generate_video` | Tạo video (`textToVideo`, `imageToVideo`, `startAndEndVideo`, `referenceImagesToVideo`) |
| `deepx_rapid_storyboard_autopilot` | Tự động chạy kịch bản nhiều cảnh liên tiếp kèm trích xuất frame nối cảnh và tải file |
| `deepx_download_media` | Tải video/ảnh đã tạo xong từ Google Flow về thư mục Downloads trên máy |

---

## Bảo mật & Ghi công (Security & Credits)

- `.gitignore` đã loại trừ `node_modules/`, log và các file tạm cá nhân; không lưu trữ hay đẩy bất kỳ thông tin phiên đăng nhập nào vào mã nguồn.
- Cầu nối chỉ lắng nghe cục bộ tại `127.0.0.1:8792`. Dự án độc lập, không trực thuộc hay được bảo trợ bởi Google.
- **Credits:** Đóng gói và tối ưu hóa bộ cài Windows 1-Click cho Antigravity dựa trên [sangam-Prajapati/antigravity-flow-connector](https://github.com/sangam-Prajapati/antigravity-flow-connector).
