# Theaters (放映廳) Issues & Improvements

## Status Audit — 2026-03-29

- Fixed: `POST /groups/{group_id}/lists` 已接受 `items` 並建立初始片單項目，見 `groups.py:473-519`
- Fixed: list item API 已包含新增/刪除/reorder，見 `groups.py`
- Partial: frontend 已能快速建立片單並追加純文字 title 項目；list item 現在已支援 `title_zh/poster_url/genres/runtime_minutes` metadata 與 detail 顯示，但仍沒有電影搜尋與自動 metadata 補全
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

- [x] **Detail route 已改為動態路由** — 主要入口已切到 `/theaters/[id]`，並保留舊 `/theaters/detail?id=...` 作相容層。
- [x] **啟動門檻已下修** — 預設與 seed 的 `min_members_to_activate` 已統一調整為 `3`，並補 migration 下修既有群組門檻。
- [ ] **無即時更新** — 留言板和片單需手動 refresh，無 WebSocket 或 polling。
- [ ] **`TheaterListItem` circular eager-load** — `theater_list.py:62` item 反向 relationship 用 `lazy="selectin"` 會額外載入 parent + 所有 sibling items。
- [ ] **留言板定位模糊** — Phase D 規劃 list-scoped replies，與通用留言板並存尷尬。
- [ ] **`_recent_messages` SQL desc + Python reversed** — `group_engine.py:215-232` 可用 subquery 避免 Python 端反轉。

---

## Phase C Follow-ups (Feature Gaps)

- [x] **List items API 已齊** — 建立、追加、刪除、reorder、note 更新都已有對應 endpoints
- [x] **POST /lists 接受 items** — 建立片單時已可直接建立初始 items，不再永遠為空
- [ ] **Frontend：建立片單無法搜尋/加電影** — 已部分改善：可快速輸入 title 建立 items，也可後續 append title；list item metadata 結構已補齊，但仍沒有電影搜尋、TMDB 選擇與自動 metadata 補全
- [x] **Frontend：片單已有詳情頁顯示電影卡片**
- [x] **List items metadata 已補基礎欄位** — `title_zh`、`poster_url`、`genres`、`runtime_minutes` 已進 model / API / frontend types，dynamic theater detail 也會顯示這些欄位。

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

1. Product follow-up: movie search / metadata enrichment for list items
2. Architecture: real-time updates and query/load cleanup
3. UX follow-up: clarify the role split between list-scoped replies and the broader theater discussion flow
