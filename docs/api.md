# Tài liệu tích hợp API — digitalMap

Base URL: `https://dcudata.cgb.vn/api/v1`

## Mục lục

1. [Bắt đầu nhanh](#1-bắt-đầu-nhanh)
2. [Quy ước chung](#2-quy-ước-chung)
3. [Xác thực và phiên làm việc](#3-xác-thực-và-phiên-làm-việc)
4. [Registry lớp bản đồ](#4-registry-lớp-bản-đồ)
5. [Vẽ bản đồ và tile MVT](#5-vẽ-bản-đồ-và-tile-mvt)
6. [Danh mục dùng chung](#6-danh-mục-dùng-chung)
7. [Thống kê](#7-thống-kê)
8. [Xuất báo cáo](#8-xuất-báo-cáo)
9. [API quản trị](#9-api-quản-trị)
10. [Phạm vi dữ liệu và phân quyền](#10-phạm-vi-dữ-liệu-và-phân-quyền)
11. [Lưu ý riêng cho Mobile](#11-lưu-ý-riêng-cho-mobile)
12. [Trạng thái dữ liệu và giới hạn đã biết](#12-trạng-thái-dữ-liệu-và-giới-hạn-đã-biết)

---

## 1. Bắt đầu nhanh

Ba lệnh dưới đây đủ để dựng được bản đồ có dữ liệu.

```bash
# 1. Đăng nhập, lấy accessToken
curl -X POST https://dcudata.cgb.vn/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"...","password":"..."}'

# 2. Lấy cấu hình toàn bộ lớp bản đồ (không cần token vẫn gọi được)
curl https://dcudata.cgb.vn/api/v1/map/layers

# 3. Lấy danh mục 40 phường xã
curl https://dcudata.cgb.vn/api/v1/catalog/wards
```

### Thứ tự khởi động khuyến nghị (Web và Mobile)

1. `GET /map/config/version` — lấy `registryVersion`. Nếu trùng bản đã cache thì bỏ qua bước 2.
2. `GET /map/layers` — cấu hình lớp. Dùng nó để dựng menu, source/layer MVT, ô tìm kiếm và panel chi tiết.
3. `GET /catalog/wards` — ranh giới và tên phường xã cho bộ lọc địa bàn.
4. `POST /auth/login` khi người dùng đăng nhập; sau đó gọi lại `/map/layers` kèm token vì danh sách lớp có thể hẹp lại theo quyền.

Hai endpoint `/map/*` và toàn bộ `/catalog/*` gọi được khi chưa đăng nhập — đủ để hiển thị bản đồ công khai. Dữ liệu nghiệp vụ và thống kê thì bắt buộc có token.

---

## 2. Quy ước chung

Mọi phản hồi thành công đều bọc trong `data` + `meta`:

```json
{
  "data": {},
  "meta": {
    "requestId": "0HNOP9...",
    "generatedAt": "2026-09-23T15:09:13+07:00"
  }
}
```

Lỗi luôn có dạng này, thông điệp đã là tiếng Việt và hiển thị thẳng được cho người dùng:

```json
{
  "error": {
    "code": "FORBIDDEN_WARD_SCOPE",
    "message": "Tài khoản không có quyền xem dữ liệu của phường/xã này.",
    "requestId": "b1f0a2c4"
  }
}
```

> **Quan trọng**
> Luôn bắt theo `error.code`, không bắt theo `message` — câu chữ có thể được sửa cho dễ hiểu hơn, mã thì không đổi. Khi báo lỗi cho người dùng nên kèm `requestId` để đối soát log.

### Mã lỗi

| Mã lỗi                                                 | HTTP | Khi nào                                       |
| ------------------------------------------------------ | ---- | --------------------------------------------- |
| `BAD_REQUEST`                                          | 400  | Thiếu tham số hoặc sai định dạng              |
| `UNAUTHORIZED`                                         | 401  | Chưa đăng nhập, token hết hạn hoặc bị thu hồi |
| `FORBIDDEN`                                            | 403  | Thiếu quyền                                   |
| `FORBIDDEN_WARD_SCOPE`                                 | 403  | Ngoài phạm vi phường xã được giao             |
| `FORBIDDEN_COLLECTION`                                 | 403  | Ngoài phạm vi lớp dữ liệu được giao           |
| `NOT_FOUND`                                            | 404  | Không tồn tại                                 |
| `LAYER_NOT_PUBLISHED`                                  | 404  | Lớp chưa được phát hành                       |
| `CONFLICT` · `ROLE_IN_USE` · `LAYER_ALREADY_PUBLISHED` | 409  | Xung đột trạng thái                           |
| `VALIDATION_FAILED`                                    | 422  | Dữ liệu gửi lên không hợp lệ                  |
| `NOT_IMPLEMENTED`                                      | 501  | Chức năng chưa làm                            |
| `UPSTREAM_ERROR`                                       | 502  | Lỗi từ hệ thống nguồn                         |

### Các quy ước khác

- **Thời gian** — mọi mốc đều là ISO 8601 có offset `+07:00`, ví dụ `2026-09-23T15:09:13+07:00`. Không bao giờ trả chuỗi thời gian không xác định múi giờ, nên parse trực tiếp được.
- **Phân trang** — các endpoint danh sách nhận `page` (từ 1) và `pageSize`, trả về `meta.total`, `meta.page`, `meta.pageSize`.
- **Tham số dạng danh sách** — ngăn bằng dấu phẩy, ví dụ `?wards=19900,19858&collections=thua_dat,bts`.
- **`meta.notes`** — mảng chuỗi tiếng Việt giải thích những gì số liệu không tự nói được (vì sao tổng lệch, vì sao một chỉ tiêu để trống). Nên hiển thị cho người dùng, đừng bỏ qua.

---

## 3. Xác thực và phiên làm việc

Gửi token ở mọi request cần quyền: `Authorization: Bearer <accessToken>`.

| Method | Endpoint        | Mục đích                       |
| ------ | --------------- | ------------------------------ |
| POST   | `/auth/login`   | Đăng nhập                      |
| POST   | `/auth/refresh` | Làm mới phiên                  |
| POST   | `/auth/logout`  | Thu hồi phiên                  |
| GET    | `/auth/me`      | Hồ sơ, vai trò, quyền, phạm vi |

`POST /auth/login` với `{ "username", "password" }` trả về:

```json
{
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "nJ9dFULFfgKGcy9Wp...",
    "tokenType": "Bearer",
    "expiresIn": 28800,
    "roles": ["system_admin"],
    "permissions": [
      "data.read",
      "statistics.read",
      "report.export",
      "layer.manage"
    ],
    "wardScopeType": "all"
  }
}
```

`GET /auth/me` trả thêm phạm vi chi tiết:

```json
{
  "data": {
    "id": "485583d4-684b-40d7-83d7-44bf33f40145",
    "username": "admin",
    "fullName": "Quản trị hệ thống",
    "unit": "UBND phường Thuận An",
    "roles": ["system_admin"],
    "permissions": ["data.read", "statistics.read", "..."],
    "wardScope": { "type": "all", "wardIds": [] },
    "allowedCollections": ["thua_dat", "bts", "..."]
  }
}
```

### Quy tắc làm mới phiên

`accessToken` sống `expiresIn` giây (mặc định 1 giờ trên production). Khi nhận `401 UNAUTHORIZED`, gọi `POST /auth/refresh` với `{ "refreshToken" }` để lấy cặp token mới, rồi phát lại request cũ.

> **Dễ làm hỏng phiên**
> Refresh token **xoay vòng**: mỗi token chỉ dùng được đúng một lần. Mỗi lần refresh trả về một `refreshToken` mới — phải ghi đè cái cũ. Hai hệ quả cần xử lý:
>
> - Gọi refresh song song từ nhiều request cùng lúc sẽ làm hỏng phiên. Hãy gộp về **một lượt refresh duy nhất** và cho các request khác chờ kết quả đó.
> - Refresh thất bại (401) nghĩa là phiên đã bị thu hồi — đưa người dùng về màn đăng nhập, đừng thử lại.

### Khi nào phiên bị thu hồi

Quyền nằm sẵn trong `accessToken` nên mọi thay đổi quyền đều thu hồi toàn bộ phiên đang mở: đổi vai trò, đổi địa bàn, đổi phạm vi collection, khoá tài khoản, đặt lại mật khẩu. Đây là hành vi có chủ đích — nếu không thì token cũ vẫn mang quyền cũ cho tới khi hết hạn. Client chỉ cần coi đó là một lần 401 bình thường.

### SSO Huế

`GET /sso/config` và `POST /sso/get-token` đã sẵn sàng cho giai đoạn sau (Keycloak `sso.huecity.vn`). Hiện hệ thống dùng tài khoản cục bộ; tài khoản tạo từ SSO chưa có vai trò nào cho tới khi quản trị gán.

---

## 4. Registry lớp bản đồ

> **Nguyên tắc**
> Đây là endpoint quan trọng nhất. Không khai báo cứng bất kỳ tên collection, tên field hay nhãn tiếng Việt nào trong mã client — tất cả lấy từ đây. Thêm một lớp dữ liệu mới sẽ không cần phát hành phiên bản app mới.

```
GET /api/v1/map/layers
GET /api/v1/map/config/version
```

Hai endpoint này trả JSON ở mức gốc, **không** bọc `{ data, meta }` như phần còn lại.

```json
{
  "schemaVersion": 1,
  "registryVersion": "2026-09-23T08:06:28Z-r1",
  "publishedAt": "2026-09-23T15:06:28+07:00",
  "layers": ["... 15 lớp ..."]
}
```

### Cấu hình một lớp

```json
{
  "collectionKey": "water_level_station",
  "directusCollection": "water_level_station",
  "sourceLayer": "water_level_station",
  "featureIdField": "id",
  "directusIdField": "id",
  "tileUrl": "https://dcu.huecity.vn/mvt/{z}/{x}/{y}.mvt?collections=water_level_station",
  "label": "Trạm đo mực nước",
  "menuGroup": "iot",
  "geometryTypes": ["Point"],
  "geometryField": "geom",
  "titleFields": ["name", "code"],
  "searchableFields": ["name", "code", "address"],
  "listFields": ["name", "code", "address"],
  "detailFields": [
    "name",
    "code",
    "number",
    "address",
    "altitude",
    "water_station_type",
    "city",
    "area"
  ],
  "hiddenFields": [
    "id",
    "geom",
    "user_created",
    "user_updated",
    "date_created"
  ],
  "fieldLabels": {
    "name": "Tên trạm",
    "code": "Mã trạm",
    "altitude": "Độ cao"
  },
  "valueLabels": {},
  "objectValueKeys": { "water_station_type": "desc" },
  "minZoom": 10,
  "maxZoom": 12,
  "color": "#0f9b8e",
  "icon": "water",
  "capabilities": {
    "mvt": true,
    "directus": true,
    "list": true,
    "detail": true,
    "search": true,
    "statistics": true
  },
  "dimensions": { "updatedAtField": "date_updated", "measureFields": [] }
}
```

### Dùng từng field vào việc gì

| Field                 | Dùng để                                                             |
| --------------------- | ------------------------------------------------------------------- |
| `collectionKey`       | Khoá định danh lớp. Đưa vào mọi endpoint thống kê                   |
| `label`               | Nhãn hiển thị trên menu và panel                                    |
| `menuGroup`           | Khoá nhóm menu, tra nhãn ở `/catalog/layer-groups`                  |
| `geometryTypes`       | `Point` / `LineString` / `Polygon` — quyết định kiểu layer MapLibre |
| `sourceLayer`         | Tên source-layer khi khai layer MVT                                 |
| `tileUrl`             | Mẫu URL tile, xem mục 5                                             |
| `featureIdField`      | Khoá của feature; dùng cho feature-state và tra chi tiết            |
| `titleFields`         | Thử lần lượt, lấy giá trị đầu tiên khác rỗng làm tiêu đề            |
| `listFields`          | Cột hiển thị trong bảng danh sách                                   |
| `detailFields`        | Thứ tự dòng trong panel chi tiết                                    |
| `searchableFields`    | Field đưa vào ô tìm kiếm                                            |
| `hiddenFields`        | Phải ẩn, kể cả khi API trả về                                       |
| `fieldLabels`         | Tên field → nhãn tiếng Việt. Không có thì hiển tên field            |
| `valueLabels`         | Dịch mã sang chữ, ví dụ `operation_status` `"1"` → `"Bình thường"`  |
| `objectValueKeys`     | Field lưu JSON object → property cần lấy ra                         |
| `minZoom` / `maxZoom` | Khoảng zoom hiển thị lớp                                            |
| `color` / `icon`      | Màu và tên icon Material Symbols                                    |
| `capabilities`        | Bật/tắt tính năng: list, detail, search, statistics                 |
| `dimensions`          | Chiều thống kê khả dụng, xem mục 7                                  |

### Ba chỗ dễ làm sai

> **Kiểm tra lại trước khi bàn giao**
>
> - **`hiddenFields` không phải gợi ý.** Lớp `danh_muc_du_an_thu_hut_dau_tu` có hai field hình học (`geom_etry` và `vitri`); bỏ qua danh sách này là panel chi tiết in nguyên khối JSON MultiPolygon ra màn hình.
> - **`objectValueKeys` phải xử lý.** `water_station_type` lưu `{ "desc": "Tháp báo lũ", "name": "flood_3m" }`; không lấy đúng property thì người dùng thấy `[object Object]`.
> - **Đừng giả định khoá là `id`.** Chín lớp `gisportal_*` dùng `objectid`. Luôn đọc `featureIdField`.

### Cache bằng ETag

`/map/layers` trả `ETag: "<registryVersion>"` và `Cache-Control: public, max-age=60, must-revalidate`. Gửi lại `If-None-Match` để nhận `304` khi chưa đổi.

Cách làm nhẹ nhất: poll `GET /map/config/version` (phản hồi vài trăm byte) và chỉ tải lại registry khi `registryVersion` đổi.

```json
{
  "registryVersion": "2026-09-23T08:06:28Z-r1",
  "publishedAt": "2026-09-23T15:06:28+07:00",
  "layerCount": 15
}
```

`registryVersion` là bất biến: mỗi lần phát hành sinh một giá trị mới chứ không ghi đè, nên dùng làm khoá cache được.

---

## 5. Vẽ bản đồ và tile MVT

Mỗi lớp trong registry dựng thành một source và một layer. Ví dụ với MapLibre GL:

```js
for (const layer of registry.layers) {
  map.addSource(`mvt-${layer.collectionKey}`, {
    type: 'vector',
    tiles: [layer.tileUrl],
    minzoom: layer.minZoom,
    maxzoom: layer.maxZoom ?? 22,
  });

  const kind = layer.geometryTypes[0];
  map.addLayer({
    id: `mvt-${layer.collectionKey}`,
    source: `mvt-${layer.collectionKey}`,
    'source-layer': layer.sourceLayer, // bắt buộc, không đoán
    type:
      kind === 'Polygon' ? 'fill' : kind === 'LineString' ? 'line' : 'circle',
    minzoom: layer.minZoom,
    paint:
      kind === 'Polygon'
        ? { 'fill-color': layer.color, 'fill-opacity': 0.35 }
        : { 'circle-color': layer.color, 'circle-radius': 6 },
  });
}
```

### Chứng thực tile — điểm dễ hỏng nhất

Host tile yêu cầu xác thực, mà token tuyệt đối không được nằm trong mã client. Tile phải đi qua **proxy cùng origin**; phía server gắn header `Authorization` rồi chuyển tiếp.

**Web** — viết lại URL tile bằng `transformRequest` của MapLibre, đổi phần host sang đường dẫn proxy cùng origin. Phải giữ nguyên origin đầy đủ chứ không dùng đường dẫn tương đối: MapLibre tải tile trong Web Worker, mà worker không dựng được `Request` từ URL tương đối.

```js
transformRequest: url =>
  url.startsWith('https://dcu.huecity.vn')
    ? {
        url: url.replace(
          'https://dcu.huecity.vn',
          `${location.origin}/api/tiles/dcu`,
        ),
      }
    : undefined;
```

**Mobile** — gắn header `Authorization` trong lớp tải tile của SDK bản đồ, hoặc trỏ qua cùng proxy như Web. Đừng nhét token vào query string.

> **Hỏng câm lặng**
> Không tự ghép `tileUrl`. Nó phải được dùng nguyên văn từ registry. Sai một ký tự trong phần host (thêm `/`, đổi `https` thành `http`) là quy tắc viết lại không khớp, tile gọi thẳng host thật và nhận 401 — bản đồ trắng mà không báo lỗi gì.

### Ranh giới hành chính

`GET /catalog/wards/geojson` trả FeatureCollection ranh giới 40 phường xã (ở mức gốc, nạp thẳng vào thư viện bản đồ). Mỗi feature có `id` = mã ĐVHC và `properties`: `code`, `name`, `type`, `areaKm2`. Dùng cho lớp nền hành chính và bản đồ tô màu theo số liệu.

Tệp này khoảng **4,7 MB** — nên cache lại, đừng tải mỗi lần mở màn hình.

### Chọn feature

Click trên bản đồ trả về thuộc tính feature của tile. Lấy khoá theo `layer.featureIdField`, rồi dựng panel chi tiết theo `detailFields` + `fieldLabels` + `valueLabels` + `objectValueKeys`, bỏ mọi field có trong `hiddenFields`.

---

## 6. Danh mục dùng chung

Tất cả đều chỉ đọc, gọi được khi chưa đăng nhập, và hầu như không đổi — nên cache dài.

| Endpoint                      | Nội dung                                     |
| ----------------------------- | -------------------------------------------- |
| `GET /catalog/wards`          | 40 phường xã: mã, tên, loại, diện tích, bbox |
| `GET /catalog/wards/{code}`   | Chi tiết một phường xã kèm bí danh tên cũ    |
| `GET /catalog/wards/geojson`  | Ranh giới cho bản đồ                         |
| `GET /catalog/layer-groups`   | Nhóm menu lớp dữ liệu                        |
| `GET /catalog/statuses`       | Bộ trạng thái vòng đời                       |
| `GET /catalog/sectors`        | Lĩnh vực đầu tư (15 mã)                      |
| `GET /catalog/units`          | Đơn vị quản lý                               |
| `GET /catalog/quality-levels` | Mức chất lượng dữ liệu                       |

### Phường xã

```json
{
  "data": [
    {
      "code": "19753",
      "name": "Phường Phú Xuân",
      "type": "phuong",
      "areaKm2": 10.38,
      "bbox": [107.53, 16.41, 107.62, 16.49]
    }
  ],
  "meta": { "total": 40 }
}
```

> **Khoá quan hệ** > `code` là mã đơn vị hành chính và là khoá duy nhất để nối dữ liệu. Tên chỉ để hiển thị — tên đổi theo từng đợt sắp xếp địa giới, mã thì không. Đừng dùng tên làm khoá ở bất kỳ đâu.

Hiện có 21 phường và 19 xã, tổng diện tích 4.946,6 km². `type` nhận `phuong | xa | thi_tran`.

### Nhóm lớp

Dùng `key` để khớp với `layer.menuGroup`, `label` để hiển thị, `icon` là tên Material Symbols.

```json
[
  { "key": "land", "label": "Đất đai, địa chính", "icon": "landscape" },
  { "key": "iot", "label": "Quan trắc, IoT", "icon": "sensors" }
]
```

Có 9 nhóm: `land`, `planning`, `environment`, `infrastructure`, `telecom`, `iot`, `science`, `investment`, `data`.

### Trạng thái

`GET /catalog/statuses` trả bộ dùng chung 9 trạng thái. Thêm `?collectionKey=thua_dat` để lấy bộ riêng của một lớp; chưa cấu hình riêng thì tự rơi về bộ chung và ghi chú trong `meta.notes`.

```json
[
  { "code": "draft", "label": "Khởi tạo", "color": "#94a3b8" },
  { "code": "digitizing", "label": "Đang số hóa", "color": "#3b82f6" },
  { "code": "pending_review", "label": "Chờ kiểm tra", "color": "#f59e0b" }
]
```

Đủ bộ: `draft`, `digitizing`, `pending_review`, `rejected`, `approved`, `published`, `updating`, `quality_error`, `archived`. Dùng `color` từ API, đừng tự đặt bảng màu trong client.

---

## 7. Thống kê

Cần quyền `statistics.read`. Bốn endpoint dùng chung tham số lọc `collections`, `wards`, `dateFrom`, `dateTo`.

| Endpoint                                            | Trả về                                              |
| --------------------------------------------------- | --------------------------------------------------- |
| `GET /statistics/summary`                           | KPI tổng, theo lớp, theo trạng thái, theo phường xã |
| `GET /statistics/{collectionKey}/groups?dimension=` | Nhóm theo một chiều                                 |
| `GET /statistics/{collectionKey}/trend?bucket=`     | Xu hướng theo `day` \| `month` \| `quarter`         |
| `GET /statistics/{collectionKey}/measures?fields=`  | Sum / avg / min / max                               |

`dimension` nhận `ward`, `status`, `unit`, `updatedAt` — khoá logic, không phải tên cột. `fields` phải nằm trong `layer.dimensions.measureFields`. Gửi tên cột tự đặt sẽ nhận `422`.

### Phản hồi summary

```json
{
  "data": {
    "scope": {
      "collections": ["thua_dat"],
      "wardIds": ["19900"],
      "dateFrom": null,
      "dateTo": null,
      "scopeType": "all"
    },
    "totals": {
      "total": 350534,
      "completed": null,
      "inProgress": null,
      "error": null,
      "overdue": null,
      "unknownWard": 64
    },
    "byLayer": [
      { "collection": "thua_dat", "label": "Thửa đất", "count": 348144 }
    ],
    "byStatus": [],
    "byWard": [
      {
        "wardId": "19858",
        "wardName": "Phường Phong Thái",
        "total": 32669,
        "completed": null,
        "error": null,
        "overdue": null,
        "completionRatio": null,
        "lastUpdatedAt": null
      }
    ],
    "trend": []
  },
  "meta": { "timezone": "Asia/Ho_Chi_Minh", "notes": ["..."] }
}
```

### Bốn quy tắc hiển thị bắt buộc

> **Sai là báo cáo sai**
>
> 1. **`null` không phải `0`.** `completed`, `error`, `overdue` bằng `null` nghĩa là _chưa đo được_, không phải "không có bản ghi nào". Hiển thị — hoặc ẩn ô, tuyệt đối không vẽ thành cột 0.
> 2. **`completionRatio: null` thì hiển số lượng, không hiển phần trăm.** Chỉ khác `null` khi lớp có kế hoạch số hoá đã phê duyệt làm mẫu số. Hiện chưa lớp nào có, nên đừng làm thanh tiến độ phần trăm.
> 3. **`byWard` trả đủ phường xã kể cả giá trị 0** — giữ nguyên để bản đồ tô màu và bảng xếp hạng không khuyết ô.
> 4. **`unknownWard` phải được hiển thị.** Đó là số bản ghi không quy được về phường xã nào. Bỏ nó đi là tổng trên màn hình không khớp tổng thật.

Tổng `byWard` cộng lại có thể nhỏ hơn `totals.total`; phần chênh luôn được giải thích trong `meta.notes`. Không tự cộng bù cho khớp.

### Nhóm theo chiều

```
GET /statistics/thua_dat/groups?dimension=ward
```

```json
{
  "data": {
    "dimension": "ward",
    "field": "ma_xa",
    "total": 348144,
    "unknownCount": 0,
    "items": [
      {
        "key": "19858",
        "label": "Phường Phong Thái",
        "count": 32605,
        "ratio": 0.0937
      }
    ]
  }
}
```

`key` là giá trị để drill-down: chọn một lát biểu đồ thì dùng `key` đó làm `?wards=` cho danh sách và bản đồ. `field` chỉ để tham khảo; với 13 lớp không có trường phường xã, nó trả `(chỉ mục địa bàn)` vì số liệu lấy từ chỉ mục tính sẵn.

### Đo lường

```
GET /statistics/thua_dat/measures?fields=dien_tich
```

```json
{
  "data": [
    {
      "field": "dien_tich",
      "label": "Diện tích",
      "sum": 1106801900,
      "avg": 3179.16,
      "min": 0,
      "max": 140110420
    }
  ]
}
```

API không trả đơn vị đo. `dien_tich` đang là m² — nhãn đơn vị do client ghi, và nên thống nhất một chỗ.

---

## 8. Xuất báo cáo

Cần quyền `report.export`.

```http
POST /api/v1/reports/export
Content-Type: application/json

{
  "format": "xlsx",
  "report": "byWard",
  "collections": ["thua_dat"],
  "wards": ["19900", "19858"]
}
```

| Tham số                                      | Giá trị                                    |
| -------------------------------------------- | ------------------------------------------ |
| `format`                                     | `xlsx` hoặc `csv`                          |
| `report`                                     | `byWard` (mặc định), `byLayer`, `byStatus` |
| `collections`, `wards`, `dateFrom`, `dateTo` | Như `/statistics/summary`                  |

Phản hồi là **file nhị phân**, không phải JSON. Tên file lấy từ header `Content-Disposition`, dạng `bao-cao-so-hoa-20260923-1515.xlsx`.

Số liệu trong file đi qua đúng đường thống kê như trên màn hình nên không thể lệch nhau. Phần đầu mỗi file ghi sẵn thời điểm chốt số và bộ lọc đã áp dụng.

> **Chưa có**
> PDF chưa hỗ trợ — gửi `format: "pdf"` sẽ nhận `501 NOT_IMPLEMENTED`. Ứng dụng nên chỉ hiển hai lựa chọn `xlsx` và `csv`.

**Mobile** — tải về rồi mở bằng trình xem của hệ điều hành (share sheet trên iOS, FileProvider trên Android). Đừng dựng bảng tính trong app.

---

## 9. API quản trị

Chỉ dành cho màn hình quản trị, không xuất hiện trong ứng dụng xem dữ liệu. Ẩn menu ở client không phải là bảo mật — server vẫn kiểm tra quyền ở mọi endpoint.

### Tài khoản — quyền `user.manage`

| Method         | Endpoint                           |
| -------------- | ---------------------------------- |
| GET POST       | `/admin/users`                     |
| GET PUT DELETE | `/admin/users/{id}`                |
| PUT            | `/admin/users/{id}/status`         |
| POST           | `/admin/users/{id}/reset-password` |
| GET PUT        | `/admin/users/{id}/roles`          |
| GET PUT        | `/admin/users/{id}/wards`          |
| GET PUT        | `/admin/users/{id}/collections`    |

`GET /admin/users` lọc theo `role`, `wardCode`, `unitCode`, `status`, `search` và có phân trang.

`DELETE` là **xoá mềm**: tài khoản không đăng nhập được nữa nhưng vẫn còn để đối chiếu nhật ký. Giao diện nên dùng chữ "vô hiệu hoá" chứ không phải "xoá".

Gán địa bàn theo mã đơn vị hành chính:

```jsonc
// PUT /admin/users/{id}/wards
{ "scopeType": "ward", "wardIds": ["19900", "19858"] }

// Lãnh đạo thành phố / quản trị:
{ "scopeType": "all" }
```

### Vai trò — quyền `role.manage`

`GET POST /admin/roles`, `PUT DELETE /admin/roles/{id}`.

`GET /admin/roles` trả kèm `availablePermissions` để dựng ô chọn quyền. Sáu vai trò chuẩn có `isSystem: true`: không xoá được và không sửa được bộ quyền — giao diện nên khoá nút thay vì để người dùng bấm rồi nhận 409. Xoá vai trò còn tài khoản đang dùng trả `409 ROLE_IN_USE` kèm số lượng.

### Lớp dữ liệu — quyền `layer.manage`

| Method         | Endpoint                                     | Mục đích                     |
| -------------- | -------------------------------------------- | ---------------------------- |
| GET            | `/admin/directus/collections`                | Collection có thể đăng ký    |
| GET            | `/admin/directus/collections/{name}/fields`  | Field và kiểu                |
| GET POST       | `/admin/map-layers`                          | Danh sách, thêm lớp          |
| GET PUT DELETE | `/admin/map-layers/{key}`                    | Chi tiết, sửa, xoá           |
| POST           | `/admin/map-layers/{key}/infer`              | Suy cấu hình từ schema       |
| POST           | `/admin/map-layers/{key}/validate`           | Kiểm tra trước khi phát hành |
| GET            | `/admin/map-layers/{key}/preview`            | Xem trước                    |
| POST           | `/admin/map-layers/{key}/publish`            | Phát hành                    |
| POST           | `/admin/map-layers/{key}/disable`            | Ngừng hiển thị               |
| GET            | `/admin/map-layers/{key}/versions`           | Lịch sử phiên bản            |
| POST           | `/admin/map-layers/{key}/rollback/{version}` | Khôi phục                    |

Thêm lớp chỉ cần hai trường; backend tự đọc schema và suy phần còn lại:

```json
// POST /admin/map-layers
{ "collectionKey": "rain_water_depth", "geometryTypes": ["Point"] }
```

Luồng màn hình nên là: **thêm → sửa nhãn/màu → validate → preview → publish**. Kết quả validate trả `errors` và `warnings` riêng; chỉ khi `errors` rỗng mới publish được, còn `warnings` thì hiển thị để người quản trị quyết định.

Xoá lớp là xoá cấu hình hiển thị, không đụng tới dữ liệu. Lớp đã từng phát hành trả `409 LAYER_ALREADY_PUBLISHED` — hướng người dùng sang `/disable`.

### Vận hành địa bàn

- `POST /admin/wards/reload` — nạp lại danh mục phường xã.
- `GET /admin/wards/legacy-codes` — liệt kê mã cũ còn sót.
- `GET /admin/ward-index`, `POST /admin/ward-index/rebuild` — xem và dựng lại chỉ mục địa bàn.
- `GET /admin/audit` — đọc nhật ký quản trị (quyền `audit.read`).

---

## 10. Phạm vi dữ liệu và phân quyền

### Sáu vai trò

| Mã             | Tên                | Phạm vi                      |
| -------------- | ------------------ | ---------------------------- |
| `guest`        | Khách / công chúng | Lớp công khai                |
| `ward_officer` | Cán bộ phường xã   | Phường xã được gán           |
| `specialist`   | Cán bộ chuyên môn  | Theo collection được cấp     |
| `city_leader`  | Lãnh đạo thành phố | Toàn bộ 40 phường xã         |
| `data_admin`   | Quản trị dữ liệu   | Toàn bộ + quản trị lớp       |
| `system_admin` | Quản trị hệ thống  | Toàn bộ + quản trị tài khoản |

Bảy quyền: `data.read`, `statistics.read`, `report.export`, `layer.manage`, `user.manage`, `role.manage`, `audit.read`.

### Client làm gì với phạm vi

- Đọc `permissions` từ `/auth/me` để ẩn/hiện menu và nút. Đó là trải nghiệm người dùng, không phải cơ chế bảo mật — server kiểm tra lại ở mọi request.
- Đọc `wardScope` để hiển thị phạm vi đang xem trên header, ví dụ "Phạm vi: 2 phường/xã" hoặc "Toàn thành phố".

  ```json
  "wardScope": { "type": "all",  "wardIds": [] }
  "wardScope": { "type": "ward", "wardIds": ["19900"] }
  ```

- Đọc `allowedCollections` để biết lớp nào được xem. `/map/layers` cũng đã tự lọc theo quyền, nên hai nguồn này luôn khớp nhau.

### Ba điều client không được làm

> 1. **Không tự lọc dữ liệu theo quyền.** Server đã lọc trước khi trả về. Lọc thêm ở client chỉ làm số liệu lệch so với báo cáo.
> 2. **Không gửi tham số phạm vi để "mở rộng" quyền.** `?wards=` chỉ thu hẹp trong phạm vi đã được cấp; xin thêm thì bị bỏ qua lặng lẽ và `scope` trong phản hồi cho biết phạm vi thực tế đã áp dụng.
> 3. **Không tự tính điểm thuộc phường xã nào ở client.** Phép này đã chuyển hẳn về server: nó vừa là số liệu chính thức, vừa không dùng làm cơ chế bảo mật được.

---

## 11. Lưu ý riêng cho Mobile

- **Lưu token** — `refreshToken` vào Keychain (iOS) hoặc Keystore / EncryptedSharedPreferences (Android). Không dùng AsyncStorage, UserDefaults hay SharedPreferences thường. `accessToken` giữ trong bộ nhớ là đủ.
- **Cache theo `registryVersion`** — lưu registry, danh mục phường xã và GeoJSON ranh giới xuống đĩa. Mỗi lần mở app gọi `/map/config/version` (nhẹ) và chỉ tải lại khi version đổi. Riêng GeoJSON ranh giới ~4,7 MB nên bắt buộc cache.
- **Hiển thị rõ dữ liệu từ cache** — khi đang dùng bản đã lưu, ghi thời điểm đồng bộ gần nhất. Số liệu thống kê offline không được trình bày như số liệu toàn hệ thống.
- **Tile MVT** — xem mục 5. Gắn header `Authorization` trong lớp tải tile của SDK, đừng nhét token vào query string vì nó sẽ nằm lại trong log.
- **Giữ bộ lọc khi chuyển tab** — danh sách và bản đồ dùng chung một bộ lọc (collections, wards, khoảng thời gian). Chuyển qua lại không được reset.
- **Quyền vị trí** — xin đúng lúc và giải thích mục đích. App vẫn phải dùng được nếu người dùng từ chối.

> **Vì sao có quy tắc này**
> Đồng bộ hành vi với Web — hai app dùng chung một registry và một bộ API thống kê. Mọi con số đều do backend chốt; không app nào được tự tính lại. Đây chính là nguyên nhân của sự cố cũ: Web báo 14% đã cập nhật trong khi Mobile báo 99,4% trên cùng dữ liệu.

---

## 12. Trạng thái dữ liệu và giới hạn đã biết

_Số liệu kiểm chứng ngày 23/09/2026 trên môi trường phát triển._

### 15 lớp đã phát hành

| Nhóm                             | Lớp                  | Số bản ghi   | Zoom  |
| -------------------------------- | -------------------- | ------------ | ----- |
| land                             | Thửa đất             | 348.144      | 14–18 |
| telecom                          | Trạm BTS             | 1.831        | 10–12 |
| investment                       | Dự án thu hút đầu tư | 312          | 9+    |
| iot                              | Trạm đo mưa          | 55           | 10–12 |
| iot                              | Trạm đo mực nước     | 17           | 10–12 |
| iot                              | Trạm đo gió IoT      | 4            | 10–12 |
| environment · planning · science | 9 lớp `gisportal_*`  | 1–48 mỗi lớp | 9+    |

Tổng 350.534 bản ghi. Danh mục có đủ 40 phường xã (21 phường, 19 xã).

### Bốn giới hạn cần biết trước khi dựng giao diện

1. **Chưa lớp nào có trường trạng thái.** Mọi chỉ tiêu theo trạng thái (`completed`, `error`, `overdue`) đều trả `null`, và `byStatus` rỗng. Biểu đồ donut theo trạng thái chưa vẽ được — hãy thiết kế để khối đó ẩn đi gọn gàng thay vì hiển biểu đồ trống.
2. **`trend` hiện trả mảng rỗng.** `thua_dat` có trường `date_updated` nhưng chưa bản ghi nào được cập nhật, nên không có điểm dữ liệu. Biểu đồ xu hướng cần trạng thái rỗng tử tế.
3. **2.189 bản ghi mang mã đơn vị hành chính cũ** (49 mã trước sắp xếp địa giới). Chúng không thuộc phường xã nào nên tổng `byWard` nhỏ hơn `totals.total` đúng 2.189. Chênh lệch này luôn được giải thích trong `meta.notes` — hiển thị ra, đừng giấu.
4. **64 dự án thiếu hình học** trong tổng 312, nên không lên tile và không gán được địa bàn. Danh sách vẫn có đủ 312; bản đồ chỉ thấy 248.

### Về chỉ mục địa bàn

Chỉ hai lớp (`thua_dat` qua `ma_xa`, `bts` qua `ward`) có trường phường xã thật. 13 lớp còn lại được gán địa bàn bằng chỉ mục hình học tính sẵn trên server — 495/559 bản ghi đã có địa bàn. Với client thì không khác gì: vẫn gọi `?wards=` như bình thường.

### Thay đổi sắp tới

- Bảng nối dự án ↔ phường xã đang rỗng; khi được điền sẽ thay chỉ mục hình học cho lớp dự án và giải quyết 64 bản ghi nói trên.
- Nhãn tiếng Việt sẽ chuyển dần sang lấy từ Directus. `fieldLabels` trong registry vẫn là nguồn duy nhất client cần đọc — không ảnh hưởng tới client.
- Xuất PDF sẽ bổ sung sau.

### Câu hỏi còn mở

- Chưa chốt công thức "đã cập nhật" (tên chỉ tiêu, mẫu số, điều kiện loại trừ). Trong khi chờ, không app nào được tự định nghĩa một công thức riêng.
- Chưa có kế hoạch số hoá được phê duyệt làm mẫu số, nên mọi tỷ lệ hoàn thành đều là `null`.
