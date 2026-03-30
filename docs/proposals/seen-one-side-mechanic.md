# Seen One Side Mechanic

> Status: proposal
> Drafted: 2026-03-30
> Owner: sequencing / DNA

## Why This Exists

目前 sequencing 已經有：

- `pick`
- `reroll`
- `skip`
- `dislike_both`

但還有一個很常見、而且資訊價值不低的情境：

- 使用者只看過左邊，右邊沒看過
- 或只看過右邊，左邊沒看過

現在很多人會直接用 `skip` 處理。

這樣做的問題是：

1. 整題被當成「難以判斷」
2. 系統失去一個明確的 exposure signal
3. 當 Phase 1 開始放更多非主流 / bridge-auteur 片，這種情況只會更常發生

## Product Goal

保留「只看過一部」這種弱但有價值的訊號，同時避免把它誤當成明確喜好。

成功標準：

1. 使用者不必在「一部看過、一部沒看過」時被迫亂選
2. `skip` 保持「兩邊都難以判斷」的語義
3. `seen_one_side` 不直接污染 DNA 主偏好
4. 後端能把它用在後續出題、reroll、analytics

## Recommended Semantics

### `skip`

意思：

- 兩邊都難以判斷
- 可能都沒看過，或都沒有足夠印象

資料效果：

- 維持現狀
- 仍作為弱負向或低吸引力訊號

### `seen_left_only`

意思：

- 左邊看過
- 右邊沒看過或無法判斷
- 這不是偏好勝負

資料效果：

- 記錄 exposure，但不記錄 winner
- 先不進 DNA 主向量

### `seen_right_only`

意思：

- 右邊看過
- 左邊沒看過或無法判斷
- 這不是偏好勝負

資料效果：

- 記錄 exposure，但不記錄 winner
- 先不進 DNA 主向量

## Recommendation

不要把「只看過一部」當成一般 pick，也不要沿用現在的 `skip`。

建議新增獨立 decision type：

- `seen_left_only`
- `seen_right_only`

理由：

1. 這是 exposure signal，不是 preference signal
2. 如果沿用 `skip`，資料語義會混在一起
3. 如果硬當成 pick，會直接污染 taste signal

## Recommended Rollout

### Phase A: Event Separation + UI Relief

先把事件拆開，但不讓它進 DNA 主分數。

做法：

1. `PickDecisionType` 新增：
   - `seen_left_only`
   - `seen_right_only`
2. 新增對應 endpoint，或在現有 `/skip` 類路由加明確 decision type
3. frontend 在次層操作提供：
   - `只看過左邊`
   - `只看過右邊`
4. `dna_builder` 先忽略這兩類事件
5. pair selection / diagnostics / analytics 先開始吃這些事件

### Phase B: Adaptive Follow-up

等有資料後，再讓它影響下一題，不一定影響 DNA 主分數。

可能做法：

1. 如果使用者標記 `seen_left_only`
   - 優先補一題同維度、但兩邊都更熟的 pair
2. 如果某些 pair 長期大量出現 `seen_one_side`
   - 視為 pair familiarity imbalance
3. 若某些片反覆被標記「看過」
   - 可作為 seed familiarity signal，用來做候選片熟悉度調整

## Recommended Scoring Policy

第一階段建議：

- `pick`: 正常進分
- `skip`: 維持現有弱負向
- `dislike_both`: 維持 diagnostics only
- `seen_left_only / seen_right_only`: diagnostics + adaptive routing only

不建議第一階段就做：

- 將 seen-one-side 視為弱正向
- 將 seen-one-side 視為對另一邊弱負向
- 讓 seen-one-side 直接影響 archetype

原因：

- 看過不等於喜歡
- 沒看過不等於排斥
- 很容易把 familiarity 誤判成 taste

## UX Recommendation

不要把這兩個按鈕直接放進主操作列，否則 decision cost 會過高。

建議放法：

1. 維持主操作：
   - 選左
   - 選右
2. 次操作：
   - `reroll`
   - `skip`
3. 展開式更多選項：
   - `dislike both`
   - `只看過左邊`
   - `只看過右邊`

文案重點：

- 明確說這不是偏好，只是幫系統知道你的看片接觸面

## Data Model Direction

推薦沿用現在的 `decision_type` 架構，而不是再發明新表。

方向：

- `decision_type = pick`
- `decision_type = skip`
- `decision_type = dislike_both`
- `decision_type = seen_left_only`
- `decision_type = seen_right_only`

欄位可維持：

- `movie_a_tmdb_id`
- `movie_b_tmdb_id`
- `chosen_tmdb_id = null`
- `pick_mode = null`
- `test_dimension`
- `response_time_ms`

必要時可加一個 helper method，把 seen side 轉成 `known_tmdb_id`，但不建議第一步就改 schema。

## Analytics To Add

至少要追：

1. `skip` vs `dislike_both` vs `seen_left_only/right_only` 比率
2. 哪些 pair 最常出現 seen-one-side
3. 哪些維度最常出現 seen-one-side
4. seen-one-side 是否在 Phase 1 明顯高於 Phase 2-3
5. 加入這個功能後，是否降低 skip 率與亂選率

## Decision

推薦做，而且優先度不低。

但建議採取保守路線：

1. 先把事件語義拆開
2. 先把它當 exposure signal，不當 taste signal
3. 先用來改善 routing、pair review、analytics
4. 之後再決定是否要給極弱權重
