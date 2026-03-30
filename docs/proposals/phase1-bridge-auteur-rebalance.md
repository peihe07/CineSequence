# Phase 1 Bridge-Auteur Rebalance

> Drafted: 2026-03-30
> Scope: next-pass curation notes for `phase1_pairs.json`

## Goal

讓 Phase 1 更早測到「作者片 / 非主流入口」偏好，但不要把基礎輪直接做成重影展問卷。

這一輪不是要全面改成更硬，而是補更多 `bridge-auteur` signal:

- 讓看過主流片的人也有機會往作者電影分流
- 讓影迷在第一輪就感覺到題組懂得區分氣質，不只是大片 vs 冷門片
- 讓後續 `movie_pool` 與 taxonomy 擴充有明確 anchor 可接

## Practical Constraint

目前 Phase 1 pair 不依賴 `movie_pool.json` 才能出題，所以可以先把 bridge-auteur 片放進 `phase1_pairs.json`。

但如果某部片不在 `movie_pool.json`，它的偏好訊號不會自然延續到後續 tag / DNA 隱性 signal。這代表：

1. `phase1_pairs` 可以先加
2. `movie_pool` + `tag_taxonomy` 一定要在下一步補上

## Director Anchors

這一輪先用三組 bridge-auteur 導演當 anchor。

### Wim Wenders

適合承接的氣質：

- 孤獨
- 漫遊
- 都市疏離
- 日常凝視
- 低刺激但高餘韻

優先候選：

- `Paris, Texas`
- `Wings of Desire`
- `Perfect Days`

### Paul Thomas Anderson

適合承接的氣質：

- 美國作者電影
- 人物壓力
- 關係控制
- 群像密度
- 表演張力

優先候選：

- `Phantom Thread`
- `There Will Be Blood`
- `Magnolia`

### Coen Brothers

適合承接的氣質：

- 黑色幽默
- 冷調荒謬
- 類型偏移
- 道德不安
- 角色挫敗感

優先候選：

- `Inside Llewyn Davis`
- `A Serious Man`
- `Fargo`
- `No Country for Old Men`

## Current Pool Gap

截至 2026-03-30，這批候選片在 `movie_pool.json` 的覆蓋如下：

- 已存在：`Perfect Days`, `Magnolia`, `No Country for Old Men`
- 尚未存在：`Paris, Texas`, `Wings of Desire`, `Phantom Thread`, `There Will Be Blood`, `Inside Llewyn Davis`, `A Serious Man`, `Fargo`

結論：

- `phase1_pairs` 可以先用這些片
- 下一步 `movie_pool` 應優先補上述缺口

## Triage

這裡先分成三類，方便下個實作回合直接動手。

### Keep

這些 pair 已經有 cinephile front-door 的效果，不必優先動：

- `p1_01` `The Dark Knight` vs `Burning`
- `p1_02` `Pulp Fiction` vs `The Assassin`
- `p1_03` `Avatar` vs `Still Life`
- `p1_05` `Lady Bird` vs `Vive L'Amour`
- `p1_06` `Inside Out` vs `Aftersun`
- `p1_28` `Dune` vs `Drive My Car`
- `p1_41` `Spider-Man: Into the Spider-Verse` vs `Millennium Actress`
- `p1_44` `Oppenheimer` vs `In the Mood for Love`
- `p1_50` `John Wick` vs `Perfect Days`

### Keep But Review Later

這些還能用，但如果要提高 bridge-auteur 密度，可以晚點再微調：

- `p1_04` `Frozen` vs `Perfect Blue`
- `p1_20` `Monsters, Inc.` vs `The Lobster`
- `p1_30` `Avatar: The Way of Water` vs `Decision to Leave`
- `p1_47` `Amelie` vs `Parasite`
- `p1_57` `Casino Royale` vs `Triangle of Sadness`

### First Replacement Candidates

這批是下一輪最值得拿來換 bridge-auteur anchor 的位置：

- `p1_22` `Edge of Tomorrow` vs `Cinema Paradiso`
  理由：`fast_vs_slow` 可讀性有，但年代、懷舊、溫度混進來太多。
- `p1_23` `Mission: Impossible - Rogue Nation` vs `Still Walking`
  理由：節奏對比成立，但也混到動作類型 vs 家庭寫實。
- `p1_31` `Guardians of the Galaxy` vs `The Intouchables`
  理由：`spectacle_vs_intimate` 可以更精準，不必靠 tone 友善度撐。
- `p1_32` `Titanic` vs `The Departed`
  理由：右側不夠「親密小品」，比較像另一種高張力商業片。
- `p1_39` `The Big Lebowski` vs `WALL·E`
  理由：`cynical_vs_sincere` 的意圖清楚，但兩邊過度 icon 化。
- `p1_59` `American Psycho` vs `Green Book`
  理由：過於 moralized，且右側的 sincere signal 不夠 cinephile。

## Candidate Pair Workshop

以下不是最終答案，而是下一輪替換時優先試排的 pair 方向。

### Mainstream vs Independent

優先把「大眾入口」旁邊補成「bridge-auteur 入口」：

- `Her` vs `Paris, Texas`
- `Oppenheimer` vs `Phantom Thread`
- `La La Land` vs `Inside Llewyn Davis`
- `Top Gun: Maverick` vs `Fargo`

目標：

- 不直接跳到最硬的影展片
- 讓使用者能表達自己偏愛更作者導向、更冷一點、更有餘韻的敘事

### Fast vs Slow

用 Wenders 的漫遊感取代太教科書式的「動作片 vs 溫情片」：

- `Edge of Tomorrow` vs `Paris, Texas`
- `Bullet Train` vs `Perfect Days`
- `Mad Max: Fury Road` vs `Wings of Desire`

目標：

- 測「耐心 / 凝視 / 漫遊接受度」
- 不是只測喜不喜歡動作片

### Spectacle vs Intimate

這裡很適合放 PTA 或 Wenders：

- `Avatar: The Way of Water` vs `Phantom Thread`
- `Guardians of the Galaxy` vs `Paris, Texas`
- `Pacific Rim` vs `Perfect Days`

目標：

- 讓 intimate 真的回到人物細節、情緒壓力、凝視
- 避免右側只是「比較溫暖的商業片」

### Cynical vs Sincere

這是 Coen Brothers 最適合介入的維度之一：

- `The Big Lebowski` vs `Perfect Days`
- `American Psycho` vs `Inside Llewyn Davis`
- `Fight Club` vs `A Serious Man`

目標：

- 把 cynical 從單純冷酷或暴力，拉回黑色幽默、荒謬感、存在不安
- 把 sincere 從勵志正能量，拉回較成熟的溫柔與脆弱

### Ensemble vs Solo

PTA 在這裡可以當結構型 anchor：

- `Boogie Nights` vs `Paris, Texas`
- `Magnolia` vs `Perfect Days`
- `City of God` vs `Phantom Thread`

目標：

- 更清楚地測「群像關係網」和「單人內在沉浸」
- 不要只靠生存困境或密室創傷做對照

## Proposed Next Pass

下一輪實作先不要全面大洗牌，先做小步替換：

1. 先從 `First Replacement Candidates` 中選 `4-6` 組換掉
2. 至少塞進：
   - `1` 組 Wenders
   - `1` 組 PTA
   - `1-2` 組 Coen Brothers
3. 改完後重新檢查：
   - 核心三軸 coverage 還在
   - 無重複 TMDB ID
   - 補齊 `phase1_pair_reviews.json`

## Follow-up For Movie Pool

當 `phase1_pairs` 先補完後，`movie_pool` 與 taxonomy 的下一波應優先支援這些 signal：

- `artHouseBridge`
- `festivalCircuit`
- `urbanLoneliness`
- `driftCinema`
- `blackComedy`
- `americanAuteur`
- `moralAnxiety`

這些名稱不一定是最終 tag 名稱，但方向應該對應到這次 bridge-auteur 補強，而不是只再加更多泛用 style tag。
