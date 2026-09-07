# Bộ mockup UI — Hệ thống bản đồ số theo dõi dữ liệu số hóa

## Phạm vi sản phẩm

Sản phẩm chỉ phục vụ **xem dữ liệu, theo dõi hiện trạng/cảnh báo và thống kê**. Bộ giao diện không có nút hoặc luồng thêm mới, chỉnh sửa, xóa, duyệt hay nhập dữ liệu.

## Danh sách ảnh

| Nền tảng | Tệp                                     | Màn hình và chức năng                                                |
| -------- | --------------------------------------- | -------------------------------------------------------------------- |
| Mobile   | `mobile-01-ban-do-tong-quan.png`        | Bản đồ toàn màn hình, chọn lớp, KPI bottom sheet và điều hướng chính |
| Mobile   | `mobile-02-thong-ke-du-lieu.png`        | Dashboard mobile dạng card, biểu đồ trạng thái, xu hướng và xếp hạng |
| Mobile   | `mobile-03-danh-sach-chi-tiet.png`      | Danh sách chỉ đọc, bộ lọc, bản đồ định vị và chi tiết thuộc tính     |
| Mobile   | `mobile-04-theo-doi-canh-bao.png`       | Danh sách cảnh báo, mức độ, bộ lọc, chi tiết và vị trí liên quan     |
| Mobile   | `mobile-05-chi-tiet-tram-quan-trac.png` | Chi tiết trạm, chỉ số tức thời, biểu đồ 24 giờ và lịch sử quan trắc  |

## Cấu trúc chức năng đề nghị

- **Bản đồ:** bật/tắt lớp, tìm kiếm, lọc, xem chú giải, định vị, chọn và xem chi tiết đối tượng.
- **Dữ liệu:** danh sách theo lớp, lọc phường xã/trạng thái/thời gian, sắp xếp, phân trang và chuyển tới vị trí trên bản đồ.
- **Theo dõi:** sức khỏe nguồn dữ liệu, thời điểm đồng bộ cuối, cảnh báo quá hạn, mất kết nối, bất thường và lịch sử sự kiện.
- **Thống kê:** KPI tổng, phân bố theo lớp/phường xã/trạng thái, xu hướng thời gian, drill-down và xuất báo cáo theo quyền.
- **Chi tiết IoT:** metadata trạm, trạng thái hoạt động, giá trị mới nhất, biểu đồ chuỗi thời gian và bảng số liệu gần nhất.
- **Collection động:** menu lớp, renderer bản đồ, danh sách, panel và widget thống kê được sinh từ registry do backend phát hành; không khai báo cứng collection trong client.

## Design system tham chiếu

- Màu chính: `#0878BD`; xanh đậm: `#075A9B`; nền: `#F5F8FB`.
- Bình thường: `#16A34A`; cần chú ý: `#F59E0B`; nghiêm trọng: `#DC2626`; mất kết nối: `#64748B`.
- Font triển khai đề nghị: Be Vietnam Pro hoặc font sans-serif Unicode tương đương.
- Grid cơ sở: 8px; bo góc card 8–12px; border xanh xám nhẹ; shadow thấp.
- Không dùng màu làm tín hiệu duy nhất: luôn kèm nhãn, icon và mô tả trạng thái.
- Web giữ header, sidebar và vùng nội dung; Mobile dùng bottom tab, bottom sheet và màn hình chi tiết native.

## Prompt set đã sử dụng

1. Web bản đồ: bản đồ hành chính Huế, sidebar lớp, KPI tổng quan, xem chi tiết và footer liên hệ.
2. Web thống kê: KPI, biểu đồ phường xã/trạng thái/xu hướng và bảng tổng hợp theo lớp.
3. Web danh sách: bộ lọc, bảng chỉ đọc, mini map và panel chi tiết đối tượng.
4. Web theo dõi: KPI vận hành, biểu đồ sức khỏe nguồn, cảnh báo và nhật ký sự kiện.
5. Web trạm IoT: thông tin trạm mưa, chỉ số tức thời, biểu đồ 24 giờ và bảng số liệu.
6. Mobile bản đồ: map toàn màn hình, layer bottom sheet, KPI và năm bottom tabs.
7. Mobile thống kê: KPI cards, donut, bar chart, trend chart và xếp hạng lớp.
8. Mobile danh sách: tìm kiếm/lọc, thẻ dữ liệu chỉ đọc, định vị bản đồ và chi tiết.
9. Mobile theo dõi: cảnh báo theo mức độ, bộ lọc, chi tiết sự kiện và mở vị trí.
10. Mobile trạm IoT: trạng thái trạm, chỉ số mới nhất, biểu đồ và lịch sử quan trắc.

Các prompt đều yêu cầu giao diện tiếng Việt, phong cách cổng thông tin Huế xanh–trắng, không watermark và tuyệt đối không có thao tác ghi dữ liệu.

## Lưu ý triển khai

Ảnh là định hướng high-fidelity, không phải kích thước CSS tuyệt đối. Đội lập trình cần chuyển thành design token và component responsive, dùng API chỉ đọc cho collection/field/item/thống kê/theo dõi, đồng thời kiểm tra accessibility trên thiết bị thực. Số liệu và tên bản ghi trong mockup chỉ minh họa bố cục, tuyệt đối không được hard-code vào sản phẩm. Mỗi widget khi triển khai phải khai báo collection Directus, endpoint/BFF, field mapping, filter và quyền; nếu nguồn chưa sẵn sàng thì hiển thị “Chưa có dữ liệu”.
