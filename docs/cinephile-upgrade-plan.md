# 選片池非主流化 + Archetype 體系升級計畫

## Context

目標受眾是影迷，但目前選片池、配對設計、原型系統三層都偏主流/英美。這份計畫涵蓋所有已識別的問題、已完成的修改、以及待決定的升級方案。

---

## 問題診斷

### 問題 1：選片池偏英美主流

**現狀**：324 部片中 US 佔 190 部（59%），非英語系只佔 41%。
**具體不足**：
- 台灣新電影只有楊德昌、李安、侯孝賢少量代表，蔡明亮完全缺席
- 王家衛只有《花樣年華》《重慶森林》，缺《春光乍洩》《墮落天使》
- 亞洲影展系統缺口大：洪常秀、阿乙查邦、賈樟柯、畢贛全部缺席
- 動畫影迷向嚴重不足：今敏（Perfect Blue, Millennium Actress, Paprika）、《輝夜姬物語》、《乙奇乙星球》全缺
- 歐陸作者經典缺口：柏格曼《乙假面》、Agnes Varda《Cleo from 5 to 7》、Claire Denis《Beau Travail》、乙克曼《Jeanne Dielman》
- 伊朗只有《乙離》，缺乙洛斯塔米《Close-Up》《Taste of Cherry》
- 非洲、拉美、東南亞幾乎空白

### 問題 2：Phase 1 配對太教科書

**現狀**：Phase 1 的 40 組配對中，前 6 組（mainstream_vs_independent 維度）全是「大片 vs 獨立片」的二分法。
**具體問題**：
- Dark Knight vs Moonlight、Infinity War vs Lady Bird — 辨識快，但太直白
- 完全沒有非英語片出現在 Phase 1，地區多樣性全靠後段 Phase 2-3 的 candidate filter 補救
- 影迷從第一題就會覺得「這個平台不太懂我」

**建議方向**：
- Phase 1 就該出現濱口、洪常秀、王家衛、楊德昌、黑澤明、阿乙查邦、今敏這種座標
- 配對不只是「大片 vs 小片」，要有「類型片高峰 vs 作者電影」、「敘事快感 vs 凝視的力量」這種有品味深度的對比

### 問題 3：Tag mapping 斷層（關鍵缺陷）

**現狀**：新加的 41 部片使用了 `auteur`、`slowCinema`、`urbanDread`、`wuxia` 等 tag，但 scoring engine 只看 `tag_taxonomy.json` 裡的 30 個 tag（透過 `TAG_INDEX`）。
**後果**：這些新片的 tag **完全不會參與計分**，等於白加。

### 問題 4：12 型原型重疊與覆蓋盲區

**重疊問題**：
- dark_poet 和 lone_wolf 共享 antiHero + darkTone，難以區分
- dream_weaver 和 chaos_theorist 共享 experimental
- adrenaline_junkie 的 nostalgic tag 不合理

**覆蓋盲區**：
- 恐怖片愛好者（horror/cult）沒有專屬原型
- 喜劇/黑色幽默偏好者缺失（satirical 只在 quiet_observer 和 chaos_theorist 出現）
- 動畫迷缺失（Animation genre 只在 chaos_theorist 和 dream_weaver）
- 年代戲/古典品味缺失（nostalgic 只在 adrenaline_junkie 和 world_wanderer）

### 問題 5：Quadrant 軸線可能不夠精細

**現狀**：只有 3 軸（mainstream↔independent、rational↔emotional、light↔dark）。
**不足**：
- 無法區分「喜歡老片」vs「喜歡新片」（classic↔contemporary）
- 無法區分「看類型片但有品味」vs「只看作者電影」（genre↔auteur）
- 3 軸的 quadrant 空間只有 8 個象限，要塞 12-16 個 archetype 有點擁擠

---

## 已完成

### movie_pool.json — 新增 41 部非主流片

US 佔比 59% → 52%，非英語系 41% → 48%。新增片單：

**台灣/華語作者**：
- 蔡明亮：Rebels of the Neon God、Vive L'Amour（+ 已有的 Yi Yi 等楊德昌片）
- 侯孝賢：Terrorizers、The Assassin、Flowers of Shanghai、A Time to Live a Time to Die、Goodbye South Goodbye
- 賈樟柯：Still Life、A Touch of Sin
- 畢贛：Long Day's Journey Into Night

**王家衛補完**：Happy Together、Fallen Angels

**亞洲影展**：
- 阿乙查邦：Uncle Boonmee、Tropical Malady
- 洪常秀：Right Now Wrong Then、On the Beach at Night Alone
- 韓國：Burning、The Wailing

**動畫影迷向**：
- 今敏：Perfect Blue、Millennium Actress、Paprika
- 高畑勳：The Tale of the Princess Kaguya
- 大友克洋：Akira
- 押井守：Ghost in the Shell
- Rene Laloux：Fantastic Planet

**歐陸作者/形式感**：
- 柏格曼：Persona
- Claire Denis：Beau Travail
- Agnes Varda：Cleo from 5 to 7（已存在）
- 乙克曼：Jeanne Dielman
- 塔可夫斯基：Mirror（+ 已有 Stalker, Solaris）
- 乙洛斯塔米：Close-Up、Taste of Cherry、Certified Copy
- Haneke：Cache、The White Ribbon
- Carax：Holy Motors
- Tarr Bela：Satantango
- Klimov：Come and See

**日本補強**：Woman in the Dunes

**非洲/拉美**：Timbuktu（茅利塔尼亞）、Embrace of the Serpent（哥倫比亞）

### phase1_pairs.json — 前 6 組配對升級

- p1_01: Dark Knight vs **Burning**（類型片 vs 作者電影）
- p1_02: Pulp Fiction vs **The Assassin**（敘事快感 vs 凝視）
- p1_03: Avatar vs **Still Life**（世界觀建構 vs 廢墟詩學）
- p1_04: Frozen vs **Perfect Blue**（闔家歡動畫 vs 影迷向動畫）
- p1_05: **Lady Bird vs Vive L'Amour**（郊區寫實 vs 都市孤寂，兩邊都非主流）
- p1_06: Inside Out vs Aftersun（保留，改了 label 文案）

---

## 實行計畫

### 已選擇方案

這份文件不再保留多方案平行推進。現階段只採用下列做法：

1. 先修 `movie_pool` tag mapping
2. 先重做 Phase 1 核心 pair
3. archetype 只做方案 A 微調
4. 16 型擴充與 5 軸改造一律移到待辦

### Sprint 1 — 修正可直接污染計分的問題

#### 1. 修正新片 tag mapping

把所有新片的 tag 重新映射到現有 30 個 taxonomy tag。對照表保留如下：

| 新 tag（需刪除） | 映射到的 taxonomy tag |
|---|---|
| auteur | experimental, slowburn |
| slowCinema | slowburn |
| urbanDread | darkTone, existential |
| wuxia | visualFeast, revenge |
| neonNoir | darkTone, visualFeast |
| queerCinema | socialCritique |
| isolation | solo, existential |
| dreamLogic | mindfuck, experimental |
| spiritual | philosophical, existential |
| folkHorror | darkTone, cult |
| minimalist | slowburn, dialogue |
| metaNarrative | experimental, satirical |
| docufiction | trueStory, experimental |
| surreal | experimental, absurdist |
| feminist | socialCritique |
| warFilm | survival, darkTone |
| classicMasterpiece | 刪除 |
| samurai | revenge, darkTone |
| cyberpunk | dystopia, philosophical |
| folklore | nostalgic |
| anime | 刪除 |
| scifi | philosophical, dystopia |
| roadMovie | existential |
| familyDrama | tearjerker |
| periodPiece | nostalgic |
| horror | darkTone, psychoThriller |
| romance | romanticCore |
| youth | comingOfAge |

完成條件：

- `movie_pool.json` 不再出現 taxonomy 外 tag
- 補一個驗證腳本或測試，避免之後再斷裂

#### 2. 重做 Phase 1 核心維度

先處理這三組：

- `mainstream_vs_independent`
- `rational_vs_emotional`
- `light_vs_dark`

原則：

- 儘量避免用 Hollywood vs world cinema 充當 taste signal
- 儘量避免 romance vs sci-fi、family vs horror 這種偷懶對比
- pair 應該主要只測一個變項

#### 3. 擴充 Phase 1 pair 數量 + 隨機抽樣機制

在核心維度重做後，直接把總 pair 數從 40 擴到 60-80。不要先修 40 再晚點重擴。

**關鍵補充：隨機抽樣**

目前 Phase 1 是固定順序播放前 N 組，導致不同用戶（甚至同一用戶重測）看到幾乎相同的配對組合。擴到 80 組但不改播放邏輯等於白擴。

做法：
- 從 80 組 pool 中，依維度分層隨機抽 7 組（每個核心維度至少 1 組）
- `session_seed` 應基於 `user_id + session_version` 產生足夠的 entropy，確保不同用戶和重測拿到不同子集
- 保留確定性（同一 session 刷新不變），但跨 session 要有差異

#### 4. 移除或重構 western_vs_eastern 維度

原本放在待辦，但這個維度是「兩爛選一」問題的主要來源，應在 Sprint 1 一併處理。

問題：
- Godfather vs Seven Samurai、Gladiator vs Your Name — 測的是「你比較熟哪邊文化圈」而不是品味偏好
- 影迷對兩邊都有涉獵時，選擇不代表偏好，只代表當下心情
- 容易產生 confound：語言熟悉度、文化親近感都會干擾 taste signal

做法：
- 刪除現有 p1_28~p1_30 三組 western_vs_eastern pair
- 如果要保留「地區多樣性」信號，改用更精細的對比（例如同類型跨地區：Crime 類 Sicario vs The Wailing，而非文明對決式配對）
- 或完全移除此維度，讓 Phase 2-3 的 candidate filter 自然補足地區多樣性

### Sprint 2 — 提高 DNA 穩定度

#### 1. Archetype 方案 A 微調

只做低風險微調，不做體系擴張。

| 原型 | 現狀問題 | 調整方式 |
|---|---|---|
| dark_poet | 和 lone_wolf 共享 antiHero+darkTone | 移除 darkTone，強調 cult+violentAesthetic+psychoThriller |
| lone_wolf | 和 dark_poet 重疊 | 保留 darkTone+antiHero+solo，移除 revenge 給 adrenaline_junkie |
| chaos_theorist | 可吸收恐怖/cult | 加入 psychoThriller，保留 experimental+absurdist |
| quiet_observer | 缺古典品味 | 加入 nostalgic |
| dream_weaver | 和 chaos_theorist 共享 experimental | 移除 experimental，強調 visualFeast+nostalgic+comingOfAge |
| adrenaline_junkie | nostalgic 不合理 | 移除 nostalgic，加入 revenge |

#### 2. DNA consistency weighting

降低 contradicted tags 對最終 DNA 的影響，先提升重測穩定度，再談更大幅度體系升級。

#### 3. Phase 2-3 candidate randomness

讓 fresh users 不會一直落在相同 candidate pool。

### Sprint 3 — 文件與驗證補齊

#### 1. 補 DNA / movie pool 文件

- `dna-system-design.md`
- `movie-pool-changelog.md`

#### 2. 補人工 review metadata

至少要能記錄：

- `confidence`
- `confounds`
- `why_valid`
- `replacement_needed`

## 待辦

以下保留，但不排進近期執行。

### Archetype / 系統升級待辦

- 方案 B：擴展到 16 型
- 方案 C：3 軸升 5 軸

理由：

- 需要較大 QA 與 backfill 成本
- 目前最大問題仍是輸入品質與現有計分穩定度

### Phase 1 延伸待辦

- `western_vs_eastern` 全面重構或移除
- `classic_contemporary` 新 dimension
- `genre_auteur` 新 dimension

### 前端 / 視覺待辦

- 新 archetype ticket style（如 `horror`、`anime`）
- DNA share card 延伸視覺整合

## 驗證方式

1. 驗證所有 `movie_pool` tag 都在 taxonomy 內
2. 跑 `backend/tests/unit/test_dna_builder.py`
3. 手動跑一輪 sequencing，確認：
   - 新片會進入 candidate pool
   - 核心維度的 pair 不再有明顯 confound
