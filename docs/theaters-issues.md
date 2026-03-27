# Theaters (放映廳) Issues & Improvements

## Status Audit — 2026-03-27

- Fixed: `POST /groups/{group_id}/lists` 已接受 `items` 並建立初始片單項目，見 `groups.py:473-519`
- Partial: list item API 已補上新增/刪除，但仍缺 reorder，見 `groups.py:522-588`
- Partial: frontend 已能快速建立片單並追加純文字 title 項目，但仍沒有電影搜尋/metadata 補全，見 `useTheaterDetail.ts:94-150`
- Partial: detail 頁面現在會在 `groupId` 缺失時直接進入 error state，不再於初始載入階段發出 `/groups//...` 請求；但 mutation callback 本身仍未對空 `groupId` 做 guard，見 `useTheaterDetail.ts:32-39`

## Critical — Must Fix

- [x] **auto_assign 不再刪除所有既有 membership** — 已改為 additive，不會清掉既有群組，手動加入的群組會被保留。
- [x] **`list_visible_groups` 不再逐個 group 呼叫 `build_group_payload`** — `/groups` 列表路徑已改為 batched payload assembly，member preview / recent messages / recent activity 改走批次查詢，不再是每個 group 各跑一輪。
- [x] **`get_group` endpoint 不再載入所有 groups** — 已改為單一 group visibility lookup + 單筆 payload 建構。
- [x] **`isMutating` 不再用單一 boolean 共享所有 mutation** — 已改為 counter-based mutation tracking。

## High — Security & Validation

- [x] **list item delete 已補 ownership 驗證** — 現在需為 item 建立者或 list 擁有者才可刪除。
- [x] **Pydantic schema 已補長度限制** — `GroupMessageCreate.body`、`TheaterListCreate.title/description/items`、`TheaterListItemCreate.title_en/match_tags/note`、`TheaterListReplyCreate.body` 都已加上 `Field(...)` 限制，避免超大 payload 先進 app 再靠 route truncate。
- [x] **`_ensure_group_visible_to_user` 不再載入所有 groups** — 已改為單一 group + membership 檢查。
- [x] **error state 在成功 mutation 後會清除** — 後續成功操作會清空舊錯誤訊息。

## Medium — Bugs & Code Quality

- [x] **空 groupId 不再觸發畸形 API 請求** — 初始載入與所有 mutation callback 都會在 `groupId` 缺失時提早返回，不再打 `/groups//...`。
- [ ] **`joinGroup`/`leaveGroup` 未用 useCallback** — `useTheaterDetail.ts:173-174` 每次 render 建新 function，可能導致不必要的 re-render。
- [x] **Group type 已統一** — theater group/list/message/activity 型別已抽到共用檔，`groupStore.ts`、`detail/types.ts`、`page.tsx` 都改為引用同一份定義。
- [x] **`groupStore.postGroupMessage` 會 trim body** — 現在會先 `trim()`，whitespace-only 直接略過，不再送出無效請求。
- [x] **auto_assign response 不再被 frontend 丟棄後重新 fetch** — `groupStore.autoAssign` 直接採用 `/groups/auto-assign` 回傳 payload，避免雙倍 query。

## Low — Architecture & Future

- [ ] **Detail route 用 query param** — `/theaters/detail?id=xxx` 而非 `/theaters/[id]`，已有 placeholder 未使用。
- [ ] **啟動門檻太高** — `min_members_to_activate = 20`，早期幾乎所有群組顯示未啟用。
- [ ] **無即時更新** — 留言板和片單需手動 refresh，無 WebSocket 或 polling。
- [ ] **`TheaterListItem` circular eager-load** — `theater_list.py:62` item 反向 relationship 用 `lazy="selectin"` 會額外載入 parent + 所有 sibling items。
- [ ] **留言板定位模糊** — Phase D 規劃 list-scoped replies，與通用留言板並存尷尬。
- [ ] **`_recent_messages` SQL desc + Python reversed** — `group_engine.py:215-232` 可用 subquery 避免 Python 端反轉。

---

## Phase C Blockers (Feature Gaps)

- [ ] **List items 無 API** — 已部分改善：新增/刪除 endpoints 已存在，但仍無 reorder endpoint
- [x] **POST /lists 接受 items** — 建立片單時已可直接建立初始 items，不再永遠為空
- [ ] **Frontend：建立片單無法搜尋/加電影** — 已部分改善：可快速輸入 title 建立 items，也可後續 append title；但仍沒有電影搜尋、TMDB 選擇與 metadata 補全
- [ ] **Frontend：片單無詳情頁顯示電影卡片**
- [ ] **List items 缺 metadata** — 無 poster_path、genres、runtime

---

## Roadmap Status

| Phase | Status | Description |
|-------|--------|-------------|
| A | Done | Activation path (auto-assign on DNA completion) |
| B | Done | Theater info architecture (index, detail, recommendations, shared watchlist) |
| C | Done | User-curated lists MVP — list CRUD, item CRUD, reorder, notes, edit flow |
| D | Done | List-scoped replies |
| E | Done | Activity feed + signals |

## Suggested Fix Priority

1. Fix bugs: type consolidation
2. Architecture: route migration, activation threshold, real-time updates
3. Product follow-up: movie search / metadata enrichment for list items
