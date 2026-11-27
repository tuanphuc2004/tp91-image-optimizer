# TP91 Image Optimizer (0đ Browser Image & OG Image Tool)

Công cụ nén ảnh sang **WebP / JPEG / PNG**, cắt chuẩn **OG Image (`1200×630`)**, đóng dấu **Watermark** và đóng gói **ZIP** chạy **100% trên trình duyệt** bằng HTML5 Canvas API — không cần server xử lý ảnh, không phát sinh chi phí API.

## Tính năng chính

- **Xử lý hoàn toàn trên trình duyệt (0đ server):** Ảnh không rời khỏi thiết bị người dùng.
- **Nhập ảnh linh hoạt:** Kéo thả, chọn nhiều ảnh cùng lúc (tối đa 20 ảnh/lượt) hoặc dán trực tiếp từ clipboard (`Ctrl + V`).
- **Bộ preset chuẩn Web & SEO:**
  - Giữ kích thước gốc (chỉ nén dung lượng)
  - `OG Image (1200 × 630)` (tự cắt `cover` cân giữa + sẵn nút copy thẻ `<meta property="og:image">`)
  - `Thumbnail 16:9 (1280 × 720)`
  - `Vuông 1:1 (1080 × 1080)`
  - `Tối đa ngang 1600px`
  - `Tùy chỉnh` (`Cover`, `Contain` kèm màu nền, hoặc thu nhỏ theo tỉ lệ)
- **Watermark chữ & Đóng gói ZIP:** Đóng dấu bản quyền góc dưới phải/giữa ảnh và tải tất cả thành file `.zip` bằng bộ tạo ZIP STORE thuần TypeScript (`createStoreZip`).
- **So sánh Trước / Sau:** Modal đối chiếu ảnh gốc và ảnh sau nén trực quan.

## Cài đặt & chạy local

```bash
npm install
npm run dev
```

Kiểm tra test, lint và build production:

```bash
npm test
npm run lint
npm run build
```

## Deploy miễn phí trên Vercel Hobby

1. Push repo lên GitHub.
2. Vào [vercel.com](https://vercel.com) → **Add New Project** → chọn repo `tp91-image-optimizer`.
3. Không cần cấu hình biến môi trường, bấm **Deploy**.
