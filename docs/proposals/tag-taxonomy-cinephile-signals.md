# Tag Taxonomy Cinephile Signals

> Status: proposal
> Drafted: 2026-03-30
> Scope: next-pass taxonomy expansion after the bridge-auteur pool update

## Goal

現在 `phase1_pairs` 和 `movie_pool` 已經開始帶入 bridge-auteur 方向，但 `tag_taxonomy.json` 還主要停留在通用 taste descriptors。

這代表目前系統雖然能感知：

- `slowburn`
- `darkTone`
- `dialogue`
- `experimental`

但還不太能感知更 cinephile-specific 的偏好，例如：

- 作者片入口而不是純 experimental
- 城市孤獨 / 漫遊感而不是泛 existential
- 黑色幽默而不是純 darkTone 或 satirical
- 道德焦慮而不是泛 philosophical

這份提案的目標不是擴很多 tag，而是補一小批真正能承接前面 curation 方向的 signal。

## Recommendation

不要一次大擴 taxonomy。

先補 `4-6` 個新 tag，條件是：

1. 每個 tag 至少能在現有 `movie_pool` 找到 `8` 部片承接
2. 每個 tag 都有明確的產品價值，不只是影評詞彙
3. 每個 tag 都能和現有 tag 區隔，不是單純同義詞

## Proposed Tags

### 1. `artHouseBridge`

中文：

- `作者片入口`

建議 category：

- `culture`

要表達的不是「最純影展片」，而是：

- 對作者導向、較非主流、但仍有可進入性的電影有吸引力

和現有 tag 的差異：

- 不等於 `experimental`
- 不等於 `nonEnglish`
- 不等於 `slowburn`

初始承接片：

- `Paris, Texas`
- `Wings of Desire`
- `Perfect Days`
- `Phantom Thread`
- `Inside Llewyn Davis`
- `Drive My Car`
- `Past Lives`
- `Aftersun`

### 2. `urbanLoneliness`

中文：

- `城市孤獨`

建議 category：

- `theme`

要表達的是：

- 都市漂流
- 關係錯位
- 親密但疏離的情緒空間

和現有 tag 的差異：

- 比 `existential` 更具體
- 比 `nostalgic` 更偏當下疏離感

初始承接片：

- `Paris, Texas`
- `Perfect Days`
- `Lost in Translation`
- `Vive L'Amour`
- `In the Mood for Love`
- `Past Lives`
- `Aftersun`
- `Drive My Car`

### 3. `driftCinema`

中文：

- `漫遊感`

建議 category：

- `pacing`

要表達的是：

- 漫遊式節奏
- 低事件密度
- 觀看體驗靠空氣、停留與移動構成

和現有 tag 的差異：

- 比 `slowburn` 更偏漂流與停留，不只是慢

初始承接片：

- `Paris, Texas`
- `Perfect Days`
- `Lost in Translation`
- `Vive L'Amour`
- `Wings of Desire`
- `Drive My Car`
- `Still Life`
- `Aftersun`

### 4. `blackComedy`

中文：

- `黑色幽默`

建議 category：

- `tone`

要表達的是：

- 死板、荒謬、冷面笑點
- 不只是 satirical，也不只是 darkTone

和現有 tag 的差異：

- 比 `satirical` 更偏人物與情境荒謬
- 比 `absurdist` 更有可笑與可怖並存的調性

初始承接片：

- `A Serious Man`
- `Fargo`
- `Inside Llewyn Davis`
- `The Lobster`
- `Triangle of Sadness`
- `American Psycho`
- `The Big Lebowski`
- `Parasite`

### 5. `moralAnxiety`

中文：

- `道德焦慮`

建議 category：

- `depth`

要表達的是：

- 不安的倫理判斷
- 角色行為與價值秩序的持續緊張

和現有 tag 的差異：

- 比 `philosophical` 更具體
- 比 `socialCritique` 更偏個人與道德困境

初始承接片：

- `A Serious Man`
- `There Will Be Blood`
- `Decision to Leave`
- `Burning`
- `A Separation`
- `No Country for Old Men`
- `The White Ribbon`
- `Shoplifters`

### 6. `americanAuteur`

中文：

- `美國作者電影`

建議 category：

- `culture`

這個 tag 不是必須第一批就做，但如果要保留一個橋樑訊號給 PTA / Coen / New Hollywood 系脈絡，這個 tag 很有用。

風險：

- 比較接近 curation tag，而不是純 taste tag
- 容易和 `artHouseBridge` 有部分重疊

初始承接片：

- `Phantom Thread`
- `There Will Be Blood`
- `Magnolia`
- `Inside Llewyn Davis`
- `A Serious Man`
- `Fargo`
- `No Country for Old Men`
- `The Big Lebowski`

## Recommended First Batch

如果只做第一批，我建議先上這 `5` 個：

1. `artHouseBridge`
2. `urbanLoneliness`
3. `driftCinema`
4. `blackComedy`
5. `moralAnxiety`

把 `americanAuteur` 放到第二批再評估。

原因：

- 前五個比較像穩定 taste signal
- `americanAuteur` 比較像 curation lens，較容易被質疑是不是過度作者中心

## Category Changes Needed

如果加入上面幾個 tag，現有 categories 不一定全部夠用，但第一批其實不必先擴 category。

可以先這樣放：

- `artHouseBridge` → `culture`
- `urbanLoneliness` → `theme`
- `driftCinema` → `pacing`
- `blackComedy` → `tone`
- `moralAnxiety` → `depth`

也就是：

- 先讓 taxonomy 可用
- 不為了 category 命名另外開一輪重構

## What To De-Emphasize

如果這批新 tag 上線，後續不應再過度依賴下列舊 tag 來承載所有 cinephile signal：

- `slowburn`
- `experimental`
- `darkTone`
- `philosophical`
- `satirical`

這些 tag 仍有用，但不應再同時負責：

- 作者片入口
- 黑色幽默
- 城市孤獨
- 道德焦慮
- 漫遊感

## Implementation Order

建議實作順序：

1. 更新 `backend/app/data/tag_taxonomy.json`
2. 先只對 `movie_pool` 補一小批高價值片做 tag 映射
3. 補 `movie_pool_reviews.json` 或 changelog 說明
4. 跑：
   - `node scripts/validate_movie_pool.js`
   - `cd backend && ./.venv/bin/python -m pytest tests/unit/test_movie_pool.py`
   - `cd backend && ./.venv/bin/python -m pytest tests/unit/test_dna_builder.py`
   - `cd backend && ./.venv/bin/python -m pytest tests/unit/test_ai_pair_engine.py`

## Decision

應該補 taxonomy signal，而且現在比繼續無限制加片更重要。

但要做小步、強辨識度的擴充，不要把 taxonomy 直接從 taste system 變成影迷術語詞庫。
