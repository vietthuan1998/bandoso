# TODOS (Việc cần làm)

## Dữ liệu & Backend

### Secret tĩnh thứ hai: MAP_TILE_AUTH_HEADER cho map.huecity.vn:8280

**Việc cần làm:** `MAP_TILE_AUTH_HOST_PATTERN`/`MAP_TILE_AUTH_HEADER` (Basic auth tĩnh, dùng trong `TILE_AUTH_RULES` ở `src/services/map/mapTileAuth.ts` cùng chỗ với `DCU_BEARER_TOKEN`) đang bị build vào bundle JS qua `@env`, y hệt lỗ hổng `DCU_BEARER_TOKEN` — nhưng cho host `map.huecity.vn:8280`, khác với BFF `dcudata.cgb.vn`.

**Lý do:** Phát hiện trong lúc triển khai kế hoạch vá `DCU_BEARER_TOKEN` (`docs/designs/huemaps-bff-migration.md`) — cùng loại lỗ hổng (`react-native-dotenv` bake secret vào bundle), nhưng map.huecity.vn không có tài liệu API/BFF tương đương để thay thế bằng session accessToken như đã làm với dcudata.cgb.vn. Chủ động để ngoài phạm vi plan hiện tại theo quyết định của người dùng.

**Bối cảnh:** Cần xác nhận map.huecity.vn:8280 là hệ thống gì (self-hosted style/tile server?), ai vận hành, và có cách nào xác thực theo phiên tương tự BFF hay không, trước khi lên kế hoạch vá.

**Nỗ lực:** Chưa rõ — phụ thuộc vào việc map.huecity.vn có hỗ trợ auth theo phiên hay không
**Ưu tiên:** P1 (cùng mức độ khẩn cấp bảo mật như DCU_BEARER_TOKEN)
**Phụ thuộc vào:** Xác nhận với đội vận hành map.huecity.vn

### Pipeline CI (typecheck → lint → test → build)

**Việc cần làm:** Thêm pipeline CI chạy typecheck, lint, unit test và build trên mỗi lần push/PR.

**Lý do:** Repo hiện chưa có cấu hình CI (không có `.github/workflows`). Đặc tả kỹ thuật (mục 25) yêu cầu pipeline có quality gate, và việc di chuyển sang BFF sắp tới (xem Architecture Review, `/plan-ceo-review` ngày 22/09/2026) không nên triển khai mà thiếu kiểm thử tự động — kiểm tra thủ công cho một lần di chuyển tầng dữ liệu là cách lỗi dễ lọt qua nhất.

**Bối cảnh:** Repo dùng `react-native-community/cli` dạng bare (Android + iOS). Phiên bản tối thiểu: GitHub Actions chạy `npm run lint`, `tsc --noEmit`, `npm test`. Nên làm việc này trước hoặc song song với việc dựng khung BFF để việc di chuyển đó được CI bao phủ ngay từ đầu, thay vì kiểm tra bằng tay.

**Nỗ lực:** S
**Ưu tiên:** P1
**Phụ thuộc vào:** Không có

### Unit test cho statisticsOverview.ts

**Việc cần làm:** Bổ sung unit test cho `src/services/statistics/statisticsOverview.ts` — công thức KPI, phân loại phường/xã bằng point-in-polygon, tính toán xu hướng theo thời gian, phân loại độ mới dữ liệu.

**Lý do:** Đây là logic phức tạp nhất trong codebase hiện tại và chưa có test nào (chỉ có `__tests__/App.test.tsx`). Đây cũng chính là logic sẽ được chuyển lên server như một phần của việc di chuyển BFF ưu tiên P1 (phát hiện Architecture Review #1) — có test ở đây giúp giảm rủi ro cho việc di chuyển bằng cách có một baseline đúng để đối chiếu.

**Bối cảnh:** Cần bao phủ: `normalizeWardKey` (chuẩn hóa dấu tiếng Việt/tiền tố), `pointInMultiPolygon`/`classifyPoint` (point-in-polygon kiểu lọc bbox trước), `computeGroups` (tính phần trăm tổng khi có giá trị null), `buildDayWindows` (tính ngày qua ranh giới tháng/năm), và cách xử lý lỗi có kiểu (typed) một khi phần đó được triển khai (xem quyết định ở Error & Rescue Map, cùng đợt review).

**Nỗ lực:** M
**Ưu tiên:** P2
**Phụ thuộc vào:** Không có (có thể bắt đầu trước khi di chuyển BFF; test này sẽ dùng lại được khi chuyển logic lên server)

### Cache offline có mốc thời gian hiển thị

**Việc cần làm:** Thêm cơ chế cache read-through (cấu hình, dữ liệu bản đồ gần đây) kèm chỉ báo "dữ liệu lúc HH:MM" hiển thị rõ, theo mục 17/21.4 của đặc tả.

**Lý do:** Đặc tả yêu cầu rõ hành vi offline phải hiển thị dữ liệu cache kèm mốc thời gian, không bao giờ để dữ liệu cũ trông như đang là dữ liệu trực tiếp. Hiện chưa có cơ chế cache/offline nào trong code đã rà soát (không thấy dùng NetInfo).

**Bối cảnh:** Chỉ nên làm việc này SAU KHI có BFF — cache các response gọi thẳng Directus hiện tại là cache một cấu trúc sắp thay đổi. Xem lại khi các endpoint `/api/v1/*` đã hoạt động.

**Nỗ lực:** M
**Ưu tiên:** P3
**Phụ thuộc vào:** Dựng khung BFF (phát hiện Architecture Review #1)

### Tích hợp crash reporting / đo lường (metrics)

**Việc cần làm:** Tích hợp SDK crash-reporting và metrics (ví dụ Sentry) vào ứng dụng mobile.

**Lý do:** Hiện `package.json` chưa có crash reporting. Kết hợp với phát hiện ở Section 2 (lỗi hiện đang bị nuốt âm thầm ở tầng dữ liệu), hiện không có cách nào biết được có lỗi xảy ra ở production ngoài việc người dùng phản ánh.

**Bối cảnh:** Nên làm song song với việc xử lý lỗi có kiểu (typed) ở Section 2 — một khi lỗi có status/loại rõ ràng, SDK crash-reporting sẽ có nơi để gửi thông tin đó thay vì chỉ log cục bộ.

**Nỗ lực:** S
**Ưu tiên:** P2
**Phụ thuộc vào:** Không có

## Chất lượng mã nguồn

### Xác nhận tài khoản đăng nhập + endpoint danh sách còn thiếu với đội vận hành BFF

**Việc cần làm:** Xác nhận hai điều với đội vận hành `dcudata.cgb.vn` trước khi mở rộng migration sang BFF (xem `docs/designs/huemaps-bff-migration.md`): (1) mỗi cán bộ phường xã đang trial đã có tài khoản đăng nhập cá nhân theo địa bàn trong hệ thống auth của BFF/Directus chưa; (2) endpoint liệt kê/tìm kiếm/phân trang danh sách bản ghi rời (cho màn Danh sách chỉ đọc, `dataRecords.ts` hiện dùng) có tồn tại nhưng chưa vào tài liệu `/docs`, hay màn đó cần thiết kế lại dựa trên property nhúng trong tile MVT.

**Lý do:** Cả hai là blocker liên-đội cho kế hoạch vá bảo mật + migrate registry động (`/plan-eng-review` ngày 24/09/2026). Nếu chưa có tài khoản, việc cấp + phân phát tốn thời gian hơn nhiều so với chỉ xây màn hình đăng nhập, và mốc thời gian ước tính trong design doc chỉ áp dụng cho phần code. Nếu endpoint danh sách không tồn tại, màn Danh sách chỉ đọc không migrate được sang BFF như dự kiến.

**Bối cảnh:** Đây là việc xác nhận/giao tiếp, không phải code — gửi câu hỏi cho đội vận hành BFF trước hoặc song song với spike kỹ thuật (Bước 0 trong design doc), không chặn việc bắt đầu vá bảo mật nếu đội vận hành chưa phản hồi kịp.

**Nỗ lực:** S
**Ưu tiên:** P1
**Phụ thuộc vào:** Không có (liên-đội, chạy song song với Bước 0 của kế hoạch vá bảo mật)
