# Dislike Both Mechanic

> Status: Phase A shipped, scoring still pending
> Last updated: 2026-03-30
> Owner: sequencing / DNA

## Why This Exists

目前 sequencing 已經有兩個非選片動作：

- `reroll`：換一組比較
- `skip`：兩部都無法判斷，直接略過這輪

但實際使用情境裡，還有第三種常見狀態：

- 使用者不是「看不懂」
- 也不是「這組不適合比較」
- 而是「兩部都看過或都能理解，但兩部都不喜歡」

這三者如果都被塞進現在的 `skip`，資料會失真。

目前後端把 `skip` 視為弱負訊號：

- `chosen_tmdb_id = None`
- `test_dimension` 記為 `-0.3` 弱負向

這代表今天的 `skip` 比較接近：

- 對這輪測試維度缺乏吸引力
- 或使用者無法建立偏好

它不等於「我明確討厭這兩部片」。

因此，如果要加 `dislike both`，不能只換前端文案，必須先把資料語義拆開。

## Product Goal

讓使用者在遇到「兩部都不想選」時，不必被迫亂選，同時不要污染 DNA。

成功標準：

1. 使用者能分清楚 `reroll`、`skip`、`dislike both`
2. `skip` 保持目前的弱訊號語義
3. `dislike both` 不會被誤當成「沒看過 / 無法判斷」
4. 後端 scoring 有明確規則，不靠前端猜

## Recommended Semantics

### `reroll`

意思：

- 這組比較不適合我現在判斷
- 我想換一組，不提供偏好訊號

資料效果：

- 不寫入 `Pick`
- 不影響 DNA
- 只更新本輪排除清單

### `skip`

意思：

- 這輪兩部都難以判斷
- 可能沒看過、沒印象、沒有足夠把握

資料效果：

- 保持現有語義
- 寫入 `Pick` with `chosen_tmdb_id = None`
- 保持目前弱負訊號行為

### `dislike both`

意思：

- 這輪我有能力判斷
- 但兩部都不想選
- 這是「明確拒絕」，不是「無法判斷」

資料效果：

- 必須和 `skip` 分開紀錄
- 不能沿用 `chosen_tmdb_id = None` + 現有 `skip` 解讀

## Recommendation

不要先改 DNA 算法。第一階段只做資料語義拆分與 UI 試行。

原因：

1. 現有 `skip` 已經和 builder、consistency、AI prompt 綁在一起
2. 一次同時改 UI + schema + scoring，回歸風險高
3. 先把事件分開記錄，之後才有真實資料能判斷它該算弱負向、雙片負向，還是僅作 diagnostics

## Proposed Rollout

### Phase A: Event Separation Only

先加 `dislike both`，但不立刻讓它參與 DNA 主分數。

做法：

1. `Pick` 或 request schema 新增 `decision_type`
2. 區分：
   - `pick`
   - `skip`
   - `dislike_both`
3. `dna_builder` 先維持：
   - `skip` 照舊進弱負訊號
   - `dislike_both` 暫時不進主向量，或只進 diagnostics
4. personality / analytics 可以先看到這類事件數量

優點：

- 風險最低
- 可以先觀察真實使用頻率
- 不會立刻污染既有 DNA

### Phase B: Limited Scoring Adoption

等收集到足夠事件後，再決定 `dislike both` 如何進分。

可選方案：

#### Option 1: Dimension-level weak negative

規則：

- 對 `test_dimension` 給比 `skip` 更明確的負向，例如 `-0.45`

適用：

- 如果產品上認定「兩部都不喜歡」代表該維度明確排斥

風險：

- 很可能把「題目品質不好」誤判成「使用者討厭該維度」

#### Option 2: Movie-level rejection only

規則：

- 對兩部電影的 implicit tags 都給弱負向
- 不直接打 `test_dimension`

適用：

- 如果想表達的是「這兩部片都不對胃口」，不一定等於整個維度都排斥

風險：

- 計算較複雜
- 比較難跟現有顯性 signal 系統整合

#### Option 3: Diagnostics only

規則：

- 不進 DNA 主向量
- 只用來：
  - 偵測低品質 pair
  - 調整 candidate selection
  - 產生內部分析報表

適用：

- 如果目標主要是降低使用者被迫亂選，而不是增加新訊號

風險：

- 改善 UX，但對 DNA 精度幫助有限

## Recommended Implementation Path

建議選：

1. **先做 Phase A**
2. **先採 Option 3**
3. 有使用資料後，再評估 Option 1 或 Option 2

理由：

- 現在最需要的是避免錯誤訊號，不是急著新增一種高風險分數
- `dislike both` 很可能也是 pair quality feedback，而不只是 taste feedback
- 若沒有資料，直接定權重容易拍腦袋

## API / Schema Direction

### Current problem

今天 `/sequencing/skip` 等於：

- 一個 UX action
- 一個資料事件
- 一個 scoring semantics

這三者綁太緊。

### Proposed direction

把「使用者決策」抽成明確欄位。

例如：

- `decision_type = pick`
- `decision_type = skip`
- `decision_type = dislike_both`

搭配現有欄位：

- `chosen_tmdb_id`
- `pick_mode`
- `movie_a_tmdb_id`
- `movie_b_tmdb_id`
- `test_dimension`

這樣可以保留現有資料結構，同時把事件語義拆開。

## UI Recommendation

不要一次把三個次要按鈕全部做成等權重。

建議：

1. 主操作仍是選左 / 選右
2. 次操作保留：
   - `reroll`
   - `skip`
3. `dislike both` 放在次層：
   - info drawer
   - expanded action row
   - 長按或「更多選項」

原因：

- 如果直接把第三個按鈕跟主選片同權重放出來，會顯著提高 decision paralysis
- 這個功能是「救援選項」，不是主流程

## Analytics To Add

如果上線 `dislike both`，至少要看：

1. 每輪 `skip` vs `reroll` vs `dislike_both` 比率
2. 哪些 `test_dimension` 最常出現 `dislike_both`
3. 哪些 pair 最常被 `dislike_both`
4. 使用 `dislike_both` 後是否提高完成率
5. 使用 `dislike_both` 的人是否更常重測或中途流失

## Open Questions

1. `dislike both` 是不是只應在 Phase 2-3 開放，不應進入 Phase 1？
2. 如果同一使用者過度頻繁使用 `dislike both`，要不要限制次數？
3. 它比較像 taste signal，還是題組品質 feedback？
4. personality reading 要不要提及「明確排斥」類型訊號？

## Decision

目前建議：

- 不把 `dislike both` 直接塞進現有 `skip`
- 不先改 builder 權重
- 先把它當成獨立事件規格處理
- 等事件資料出來後，再決定要不要進 DNA 主分數
