# PLAN: MOBA 3v3 trên web (tên tạm: "Tứ Tộc")

> Tài liệu này là nguồn tham chiếu duy nhất cho việc triển khai. Đặt ở thư mục gốc của repo.
> Mọi con số về cân bằng (máu, sát thương, thời gian) là **giá trị khởi điểm**, sẽ chỉnh qua chơi thử.

## 1. Tổng quan

- **Thể loại:** MOBA 3v3, một đường, trận khoảng 10 phút, chạy trên trình duyệt.
- **Điểm bán hàng:** mở link là chơi, không cài đặt, không bắt buộc đăng ký.
- **Hai cách vào trận:**
  1. Phòng riêng: tạo phòng, gửi link, bạn bè mở link là vào.
  2. Ghép trận tự động với người lạ theo điểm trình độ ẩn (MMR).
- **Hệ thống tướng:** 4 tộc (Người, Rồng, Thần, Người máy) x 6 vai trò.
- **Bản quyền:** toàn bộ tên, nhân vật, hình ảnh, âm thanh là nội dung gốc. Không dùng tên, tướng, kỹ năng, bản đồ hay asset của game khác.

### Định nghĩa MVP

Sáu người ở sáu máy khác nhau vào chung một trận (qua link hoặc ghép trận), chơi trọn một trận có lính, trụ, đền, 4 tướng (mỗi tộc một tướng), shop, và có đội thắng.

## 2. Thiết kế game

### 2.1 Bản đồ

- Một đường chính nối hai đền (nhà chính) của hai đội.
- Mỗi đội: 2 trụ trên đường + 1 đền. Phải phá trụ theo thứ tự mới đánh được đền.
- Hai bên đường là rừng, mỗi bên 2 trại quái (hồi sinh sau 60 giây).
- Giữa bản đồ: 3 bệ di vật và hang Cổ thú.
- Bụi cỏ: đứng trong bụi thì đối phương không thấy trừ khi cũng vào bụi.

### 2.2 Lính và trụ

- Mỗi 20 giây sinh một đợt: 3 lính cận chiến + 2 lính đánh xa mỗi bên.
- Lính đi dọc đường, tấn công mục tiêu địch gần nhất.
- Trụ ưu tiên bắn lính, chuyển sang bắn tướng nếu tướng đó đánh tướng phe trụ trong tầm.
- Phá đền địch là thắng.

### 2.3 Kinh tế và cấp độ

- Vàng: last-hit lính, quái rừng, hạ gục tướng, phá trụ (chia cả đội), cộng dần theo thời gian.
- Kinh nghiệm: chia cho các tướng đứng gần đơn vị địch bị hạ.
- Cấp tối đa 12. Mỗi cấp được 1 điểm kỹ năng. Chiêu cuối mở ở cấp 4, nâng ở cấp 8 và 12.
- Mỗi tướng: đánh thường + nội tại tộc + 4 chiêu (Q, W, E, R).
- Shop khoảng 15 món, mua tại đền. Tối đa 4 ô đồ (tộc Người có 5).

### 2.4 Di vật cổ (điểm khác biệt 1)

Mỗi 2 phút, một trong ba bệ di vật sáng lên ngẫu nhiên. Đứng trên bệ đủ 5 giây không bị ngắt để chiếm. Cả đội nhận hiệu ứng trong 60 giây:

| Di vật | Hiệu ứng |
|---|---|
| Sấm | Đòn đánh thường giật sét lan sang 2 kẻ địch gần đó |
| Khiên | Lính và trụ phe mình nhận khiên chắn sát thương |
| Cuồng nộ | Tăng sát thương gây ra, đồng thời tăng sát thương nhận vào |

### 2.5 Cổ thú (điểm khác biệt 2)

Phút thứ 7, Cổ thú xuất hiện ở hang giữa bản đồ. Đội hạ được nó sẽ có Cổ thú đi cùng đợt lính kế tiếp, đẩy thẳng về đền địch. Mục đích: đảm bảo trận kết thúc quanh mốc 10 phút.

### 2.6 Bốn tộc

Mỗi tộc có một cơ chế nền làm thay đổi cách chơi, không chỉ là nhãn.

| Tộc | Cơ chế nền | Điểm yếu | Mạnh nhất lúc |
|---|---|---|---|
| **Người** | 5 ô trang bị thay vì 4, mua đồ rẻ hơn 10% | Không có sức mạnh bẩm sinh | Giữa trận, khi đủ đồ |
| **Rồng** | Không dùng mana. Tiến hóa ở cấp 5 và 9: đổi hình dạng, tăng kích thước, chiêu mạnh hơn | Yếu đầu trận, thân to dễ trúng chiêu | Cuối trận |
| **Thần** | Chỉ số gốc cao. Tăng sức mạnh khi có lính phe mình ở gần (tín đồ) | Thời gian hồi sinh dài hơn 50% | Đầu trận |
| **Người máy** | Dùng thanh Nhiệt thay mana. Chiêu không tốn mana, mỗi lần dùng tăng Nhiệt. Nhiệt đầy thì Quá tải: câm lặng và chậm 3 giây | Không hồi máu tự nhiên, chỉ hồi ở đền hoặc bằng trang bị | Ổn định cả trận, phụ thuộc kỹ năng quản lý Nhiệt |

Chi tiết tộc Người máy:
- Nhiệt từ 0 đến 100, tự giảm khi không dùng chiêu.
- Nhiệt trên 50: chiêu gây thêm sát thương (thưởng cho việc chơi sát ngưỡng).
- Nhiệt chạm 100: Quá tải 3 giây, sau đó Nhiệt về 0.

### 2.7 Danh sách tướng

Tên là tạm đặt. Đội hình ra mắt 8 tướng, MVP làm 4 tướng đánh dấu (MVP).

| Tướng | Tộc | Vai trò | Nét riêng |
|---|---|---|---|
| Kael, Kỵ sĩ lưu vong (MVP) | Người | Đấu sĩ | Giảm mạnh sát thương từ phía trước, nhận gấp đôi từ sau lưng |
| Lyra, Thợ săn tiền thưởng | Người | Xạ thủ | Đặt bẫy, đánh dấu mục tiêu, hạ gục được thêm vàng |
| Ignar, Hỏa long (MVP) | Rồng | Pháp sư | Phun lửa theo vệt, sau tiến hóa lần 2 bay qua được địa hình |
| Baru, Thạch long | Rồng | Đỡ đòn | Hóa đá chặn đường, húc lùi kẻ địch |
| Sola, Nữ thần Bình minh (MVP) | Thần | Hỗ trợ | Hồi máu, ban khiên cho lính và đồng đội |
| Vesper, Thần Bóng tối | Thần | Sát thủ | Tàng hình, làm mù tầm nhìn một vùng |
| Bolt-7, Pháo thủ cơ giới (MVP) | Người máy | Xạ thủ | Chuyển sang dạng pháo cố định: tầm xa hơn, không di chuyển được |
| Mekka, Thợ máy chiến trường | Người máy | Hỗ trợ | Dựng tháp pháo mini, sửa trụ phe mình |

### 2.8 Cộng hưởng tộc (bật sau khi 8 tướng đã cân bằng)

- Đội có 3 tộc khác nhau: cả đội tăng tốc độ di chuyển.
- Đội có 2 tướng cùng tộc: cơ chế tộc đó được tăng cường (ví dụ 2 Rồng tiến hóa sớm hơn 1 cấp, 2 Người máy giảm Nhiệt nhanh hơn).

## 3. Luồng người chơi

### 3.1 Danh tính

- Lần đầu vào trang: tự tạo tài khoản khách, lưu token trong trình duyệt.
- Đăng nhập Google là tùy chọn, dùng để giữ điểm khi đổi máy.

### 3.2 Phòng riêng qua link

1. Nhập biệt danh, bấm Tạo phòng.
2. Server tạo phòng với mã 5 ký tự, trả link dạng `/r/K7QX2`.
3. Người khác mở link, vào sảnh chờ của phòng.
4. Chọn đội và tướng. Chủ phòng bấm Bắt đầu.
5. Ô trống được lấp bằng bot.
6. Rớt mạng: mở lại link để vào lại, trong lúc đó bot điều khiển hộ.
7. Trận phòng riêng không tính MMR.

### 3.3 Ghép trận tự động

1. Một mình hoặc nhóm 2-3 người (lập nhóm bằng link mời) bấm Tìm trận.
2. Server quét hàng chờ mỗi 1-2 giây, tìm 6 người có MMR gần nhau.
3. Phạm vi MMR ban đầu hẹp (cộng trừ 100), nới thêm 50 mỗi 10 giây chờ.
4. Đủ 6 người: thử các cách chia đội, chọn cách có MMR trung bình hai đội sát nhau nhất. Nhóm đi chung luôn cùng đội và được cộng thêm MMR khi tính.
5. Bảng Chấp nhận 10 giây. Ai từ chối hoặc không bấm bị loại khỏi hàng chờ, người còn lại quay về đầu hàng.
6. Chọn tướng 30 giây, một đội không trùng tướng.
7. Chờ quá 75 giây: lấp chỗ trống bằng bot (ghi rõ là bot). Trận có bot thì MMR thay đổi ít hơn.
8. Sau trận: cập nhật MMR bằng OpenSkill, lưu lịch sử.
9. Thoát giữa trận: bot thay, người thoát bị khóa tìm trận 5 phút, 15 phút, 1 giờ nếu tái phạm.

Lúc đầu chỉ có một hàng chờ và một máy chủ (Singapore).

## 4. Kiến trúc kỹ thuật

### 4.1 Công nghệ

| Phần | Công nghệ |
|---|---|
| Ngôn ngữ | TypeScript toàn bộ |
| Monorepo | Yarn workspaces (Yarn 4, bật qua corepack, `nodeLinker: node-modules`) |
| Client | Vite, React, React Three Fiber, drei, Zustand |
| Server | Node.js, Colyseus |
| Lõi game | TypeScript thuần, ECS nhẹ (miniplex) |
| Điểm trình độ | openskill |
| Cơ sở dữ liệu | PostgreSQL (Supabase hoặc Neon) |
| Test | Vitest |
| Đóng gói server | Docker (multi-stage), docker compose cho môi trường local |
| Triển khai | Client: Cloudflare Pages hoặc Vercel. Server: chạy image Docker trên Fly.io, Railway hoặc VPS, khu vực Singapore |

Dùng bản ổn định mới nhất của mỗi thư viện tại thời điểm khởi tạo, ghi lại phiên bản trong `package.json`.

### 4.2 Cấu trúc thư mục

```
/
├─ PLAN.md
├─ package.json            # "workspaces": ["packages/*", "apps/*"]
├─ .yarnrc.yml             # nodeLinker: node-modules
├─ yarn.lock
├─ docker-compose.yml      # server + postgres cho local
├─ .dockerignore
├─ packages/
│  └─ core/                 # Lõi game, KHÔNG phụ thuộc Three.js, React, Colyseus
│     ├─ src/
│     │  ├─ sim/            # World, vòng lặp tick, các system
│     │  ├─ systems/        # movement, combat, ability, minion, tower, economy, relic, beast, ai
│     │  ├─ races/          # human.ts, dragon.ts, god.ts, machine.ts
│     │  ├─ data/           # heroes.ts, items.ts, map.ts, balance.ts
│     │  ├─ pathfinding/
│     │  └─ types.ts
│     └─ test/
├─ apps/
│  ├─ client/
│  │  └─ src/
│  │     ├─ scene/          # Map, đơn vị, hiệu ứng (R3F)
│  │     ├─ ui/             # HUD, shop, sảnh, tìm trận
│  │     ├─ net/            # Kết nối Colyseus, nội suy
│  │     ├─ input/          # Chuột, phím
│  │     └─ store/          # Zustand
│  └─ server/
│     ├─ Dockerfile
│     └─ src/
│        ├─ rooms/          # LobbyRoom, MatchRoom, QueueRoom
│        ├─ matchmaking/    # Hàng chờ, chia đội, MMR
│        ├─ db/             # Truy vấn, migration
│        └─ auth/           # Token khách, Google
```

### 4.3 Nguyên tắc bắt buộc

1. **Server quyết định mọi thứ.** Client chỉ gửi lệnh, không bao giờ gửi kết quả (vị trí, sát thương, vàng).
2. **Lõi game tách khỏi hình ảnh.** `packages/core` chạy được trong Node không cần trình duyệt. Cùng một code chạy trên server (online) và client (chơi thử offline).
3. **Tick cố định 20 lần mỗi giây.** Mọi logic dùng số tick, không dùng thời gian thực.
4. **Ngẫu nhiên có seed.** Lõi game dùng bộ sinh số ngẫu nhiên có seed để tái hiện được trận khi debug.
5. **Dữ liệu tách khỏi logic.** Chỉ số tướng, đồ, lính nằm trong `data/`, chỉnh cân bằng không sửa system.
6. **Client nội suy.** Hiển thị trạng thái trễ khoảng 100 ms và nội suy giữa hai bản cập nhật.

### 4.4 Lệnh client gửi lên server

```ts
type Command =
  | { t: "move"; x: number; z: number }
  | { t: "attack"; targetId: number }
  | { t: "cast"; slot: "Q" | "W" | "E" | "R"; x?: number; z?: number; targetId?: number }
  | { t: "stop" }
  | { t: "buy"; itemId: string }
  | { t: "sell"; slotIndex: number }
  | { t: "levelUp"; slot: "Q" | "W" | "E" | "R" };
```

Server kiểm tra hợp lệ từng lệnh (tầm, hồi chiêu, vàng, trạng thái khống chế) trước khi áp dụng.

### 4.5 Định nghĩa dữ liệu tướng

```ts
type Race = "human" | "dragon" | "god" | "machine";
type Role = "fighter" | "marksman" | "mage" | "tank" | "assassin" | "support";

interface HeroDef {
  id: string;
  name: string;
  race: Race;
  role: Role;
  base: {
    hp: number; hpPerLevel: number;
    attack: number; attackPerLevel: number;
    armor: number; moveSpeed: number;
    attackRange: number; attackInterval: number;
  };
  resource: "mana" | "none" | "heat";   // Người, Thần: mana. Rồng: none. Người máy: heat
  abilities: Record<"Q" | "W" | "E" | "R", AbilityDef>;
  evolutions?: EvolutionDef[];           // Chỉ tộc Rồng
}

interface AbilityDef {
  id: string;
  cooldownTicks: number[];               // Theo cấp chiêu
  cost: number[];                        // Mana hoặc Nhiệt sinh ra
  targeting: "self" | "unit" | "point" | "direction";
  range: number;
  effect: string;                        // Khóa tới hàm xử lý trong systems/ability
}
```

### 4.6 Cơ sở dữ liệu

```
players(id, guest_token, google_id, nickname, mu, sigma, games_played, created_at)
matches(id, mode, started_at, duration_s, winner_team, had_bots)
match_players(match_id, player_id, team, hero_id, kills, deaths, assists, mu_before, mu_after, left_early)
penalties(player_id, reason, until)
```

`mu` và `sigma` là hai giá trị của OpenSkill. MMR dùng để ghép = `mu - 3 * sigma`.

### 4.7 Docker cho server

- Build context là **thư mục gốc repo** (server phụ thuộc `packages/core`), Dockerfile nằm ở `apps/server/Dockerfile`.
- Lệnh build: `docker build -f apps/server/Dockerfile -t moba-server .`
- Server là stateful (mỗi trận sống trong bộ nhớ một tiến trình) và dùng WebSocket: nền tảng triển khai phải hỗ trợ WebSocket, không tự tắt container khi rảnh, và khi deploy bản mới cần chờ các trận đang chạy kết thúc.
- Chỉ đóng gói server. Client là file tĩnh, triển khai lên CDN.
- Cấu hình qua biến môi trường: `PORT`, `DATABASE_URL`, `GOOGLE_CLIENT_ID`, `TOKEN_SECRET`, `CORS_ALLOWED_ORIGINS`.

Dockerfile khởi điểm (cần chạy thử và chỉnh khi dựng project):

```dockerfile
FROM node:lts-slim AS build
WORKDIR /app
RUN corepack enable
COPY package.json yarn.lock .yarnrc.yml ./
COPY packages/core/package.json packages/core/
COPY apps/server/package.json apps/server/
RUN yarn workspaces focus @game/server
COPY packages/core packages/core
COPY apps/server apps/server
RUN yarn workspace @game/core build && yarn workspace @game/server build

FROM node:lts-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app ./
EXPOSE 2567
CMD ["node", "apps/server/dist/index.js"]
```

`docker-compose.yml` cho local gồm hai service: `server` (build từ Dockerfile trên, cổng 2567) và `postgres` (có volume lưu dữ liệu).

## 5. Các giai đoạn

Ước tính cho 1-2 lập trình viên toàn thời gian. Tổng khoảng 4,5 đến 5,5 tháng.

### Giai đoạn 0: Dựng nền (3-5 ngày)

- [x] Khởi tạo monorepo Yarn workspaces với `packages/core`, `apps/client`, `apps/server`
- [x] Dockerfile cho server, `docker-compose.yml` (server + postgres), `.dockerignore`
- [x] Cấu hình TypeScript, ESLint, Prettier, Vitest
- [x] Client: scene trống, mặt đất, camera nhìn từ trên xuống
- [x] Server: Colyseus chạy được, một phòng thử kết nối
- [x] Triển khai thử cả client và server lên mạng *(client: https://tu-toc.pages.dev trên Cloudflare Pages; server: https://tu-toc-server.onrender.com trên Render gói free)*

**Xong khi:** mở link công khai thấy scene 3D và client kết nối được tới server.

### Giai đoạn 1: Lõi chơi được, offline (2-3 tuần)

- [x] ECS và vòng lặp tick cố định trong `core`
- [x] Bản đồ một đường, vật cản, tìm đường
- [x] Click để di chuyển, click để tấn công
- [x] Lính sinh theo đợt, AI lính
- [x] Trụ và logic chọn mục tiêu, đền, điều kiện thắng
- [x] Hệ thống chiêu, hồi chiêu, hiệu ứng (choáng, chậm, khiên)
- [x] Tướng Kael đầy đủ 4 chiêu, nội tại tộc Người
- [x] Vàng, kinh nghiệm, lên cấp
- [x] HUD: máu, tài nguyên, chiêu, vàng
- [x] Test tự động cho combat và kinh tế

**Xong khi:** một người chơi thắng hoặc thua được trước máy, toàn bộ logic chạy trong `core`.

### Giai đoạn 2: Online và phòng qua link (2-3 tuần)

- [x] Tài khoản khách (token trong trình duyệt)
- [x] `MatchRoom` chạy `core` trên server, nhận lệnh, phát trạng thái
- [x] Client nội suy vị trí
- [x] `LobbyRoom`: tạo phòng, mã phòng, link `/r/:code`, chọn đội
- [x] Vào lại trận khi rớt mạng
- [x] Bot đơn giản lấp ô trống

**Xong khi:** 6 người ở 6 máy chơi chung một trận bằng Kael qua link mời.

### Giai đoạn 3: Nội dung (4-5 tuần)

- [x] Cơ chế tộc Rồng (không mana, tiến hóa), tướng Ignar
- [x] Cơ chế tộc Thần (tín đồ, hồi sinh lâu), tướng Sola
- [x] Cơ chế tộc Người máy (Nhiệt, Quá tải), tướng Bolt-7
- [x] Shop và 15 món đồ
- [x] Rừng, quái rừng, bụi cỏ và tầm nhìn
- [x] Màn chọn tướng
- [x] Bot nâng cao: đi đường, farm, lùi khi yếu máu, dùng chiêu
- [ ] **Mốc MVP** *(đủ nội dung; còn thiếu lần chơi thử 6 người ở 6 máy)*
- [x] 4 tướng còn lại: Lyra, Baru, Vesper, Mekka

**Xong khi:** đủ 8 tướng, mỗi tộc chơi khác nhau rõ rệt.

### Giai đoạn 4: Điểm khác biệt (1-2 tuần)

- [ ] Ba bệ di vật và hiệu ứng
- [ ] Cổ thú ở phút thứ 7
- [ ] Thông báo sự kiện trên màn hình và bản đồ nhỏ

**Xong khi:** trận trung bình kết thúc trong 9-12 phút.

### Giai đoạn 5: Ghép trận (2-3 tuần)

- [ ] PostgreSQL, migration, lưu người chơi và lịch sử trận
- [ ] Đăng nhập Google tùy chọn
- [ ] `QueueRoom`: hàng chờ, nới rộng phạm vi theo thời gian
- [ ] Chia đội cân bằng, hỗ trợ nhóm 2-3 người
- [ ] Bảng Chấp nhận, xử lý từ chối
- [ ] Cập nhật MMR bằng OpenSkill
- [ ] Lấp bot khi chờ lâu
- [ ] Phạt thoát trận

**Xong khi:** người lạ bấm Tìm trận và được xếp vào trận cân bằng, hoặc trận có bot sau tối đa 75 giây.

### Giai đoạn 6: Hoàn thiện (3-4 tuần)

- [ ] Model 3D và hoạt ảnh cho 8 tướng (Rồng cần model riêng cho từng dạng tiến hóa) *(đã có: Kael, lính, trụ, đền, cây, đá, dùng bộ KayKit CC0; 7 tướng còn lại chờ giai đoạn 3)*
- [ ] Hiệu ứng chiêu, âm thanh *(đã có cho 4 chiêu của Kael và các sự kiện chung; âm thanh tổng hợp bằng WebAudio)*
- [x] Bản đồ nhỏ, bảng điểm, màn kết thúc trận
- [ ] Cân bằng qua chơi thử
- [ ] Chế độ đồ họa thấp, tối ưu cho máy yếu *(đã có nút bật chế độ thấp; chưa đo trên máy yếu thật)*
- [ ] Cộng hưởng tộc (nếu 8 tướng đã cân bằng)

## 6. Rủi ro

| Rủi ro | Cách xử lý |
|---|---|
| Netcode khó hơn dự kiến | Làm sớm ở giai đoạn 2 với 1 tướng, dùng Colyseus thay vì tự viết |
| Bốn cơ chế tộc khó cân bằng | Mọi chỉ số trong file dữ liệu, làm từng tộc một và chơi thử trước khi sang tộc kế |
| Thiếu model, đặc biệt là Rồng và Người máy | Dùng hình khối tới hết giai đoạn 5, sau đó dùng asset miễn phí (Kenney, Quaternius) hoặc thuê họa sĩ |
| Ít người, hàng chờ lâu | Lấp bot, một hàng chờ, nới rộng phạm vi |
| Tài khoản khách mới để đánh người yếu | MMR người mới biến động nhanh, vài trận là về đúng trình độ |
| Giật trên máy yếu | Instanced mesh cho lính, giới hạn hiệu ứng, chế độ đồ họa thấp |
| Người chơi thoát giữa trận | Bot thay ngay, cho vào lại, phạt tăng dần |

## 7. Ngoài phạm vi bản đầu

Bậc hạng hiển thị, mùa giải, cấm/chọn tướng, chia khu vực máy chủ, skin và thanh toán, chat thoại, xem lại trận, ứng dụng di động riêng, tộc thứ năm trở đi.

## 8. Quy ước làm việc

- Làm theo thứ tự giai đoạn. Không bắt đầu giai đoạn sau khi tiêu chí "Xong khi" của giai đoạn trước chưa đạt.
- Mọi luật chơi viết trong `packages/core` và có test. Client và server không chứa luật chơi.
- Thêm tướng mới: chỉ thêm dữ liệu trong `data/heroes.ts` và hàm hiệu ứng chiêu, không sửa system chung.
- Đánh dấu `[x]` vào checklist khi xong để theo dõi tiến độ ngay trong file này.
