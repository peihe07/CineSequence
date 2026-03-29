# Cine Sequence — Execution Plan

> Last updated: 2026-03-29

這份文件只保留兩類內容：

- `實行計畫`：現在應該做，而且能直接執行的項目
- `待辦區`：值得保留，但目前不排進主線的項目

原則：

1. 先修會污染 DNA 結果的問題
2. 再修會明顯勸退新使用者的 UX
3. 最後才做擴張功能、節慶企劃、變現

## 實行計畫

### Phase 1 — 修正 DNA 輸入品質

這一階段的目標是先讓使用者做的題、系統吃的 tag、DNA 算分三者對得上。

| Item | Why now | Scope | Status |
|------|---------|-------|--------|
| Movie pool tag mapping 修正 | 現有新片 tag 有斷層，部分片實際上不參與計分 | `backend/app/data/movie_pool.json` + 驗證腳本 | TODO |
| Phase 1 核心 pair 重做 | 核心三軸有明顯 confound，會直接污染 quadrant | `phase1_pairs.json` 核心維度 | TODO |
| Phase 1 pair 擴充到 60-80 組 | 目前題組太少，跨用戶重複度太高 | `phase1_pairs.json` | TODO |
| Western vs Eastern 降權或移除 | 目前太容易變成文化距離，不像品味訊號 | `phase1_pairs.json` + scoring 權重 | TODO |
| Pair review metadata | 讓後續題組調整有明確審核欄位 | docs 或 pair metadata 欄位 | TODO |

完成定義：

1. 所有 `movie_pool` tag 都落在現有 taxonomy 內
2. `phase1_pairs` 的三個核心維度完成第一輪替換
3. 題組數量足以降低重複出題

### Phase 2 — 提高 DNA 穩定度

這一階段的目標是讓重測結果不要飄太大，也避免新使用者都吃到同一種探索路徑。

| Item | Why now | Scope | Status |
|------|---------|-------|--------|
| DNA consistency weighting | retest instability 已是明確問題 | `backend/app/services/dna_builder.py` | TODO |
| Phase 2-3 candidate randomness | 新使用者 candidate pool 過度一致 | `_select_candidates` | TODO |
| Archetype 方案 A 微調 | 現有 12 型有重疊，但還不值得大改體系 | `archetypes.json` + builder tests | TODO |

不納入這階段的：

- Archetype 16 型擴充
- 5 軸 quadrant 改造

理由：這兩者都會擴大 QA 與 backfill 成本，應等前兩階段完成後再評估。

### Phase 3 — 降低新用戶流失

當 DNA 輸入與計分可信度提升後，再處理最直接的 UX 流失點。

| Item | Why now | Scope | Status |
|------|---------|-------|--------|
| Match empty state | 0 候選時不能讓使用者看到空畫面 | matches page | TODO |
| Sequencing resume UX | 中斷回來沒有承接，容易流失 | sequencing entry / progress UI | TODO |
| "Dislike both" mechanic | 使用者現在常在兩片都不喜歡時被迫選邊 | sequencing interaction + backend skip semantics | TODO |
| Skip/Reroll UX hint | 使用者不理解 skip / reroll 的訊號意義 | onboarding / tooltip | TODO |
| Seed movie search UX | 影迷片名搜尋容錯要持續優化 | seed search | IN PROGRESS |

### Phase 4 — 成長與分享

只有在前面三階段完成後，這一層才值得投入。

| Item | Why now | Scope | Status |
|------|---------|-------|--------|
| DNA Share Card | 這是成長槓桿，但前提是 DNA 結果已較穩 | DNA result / image generation | TODO |
| User feedback survey | 等核心體驗較穩後再收 feedback 比較有價值 | DNA result page | TODO |

## 待辦區

以下項目保留，但不排進目前的主線執行。

### 產品待辦

- Theater real-time updates
- Theater detail refactor
- Seasonal retest limits
- Limited ticket styles
- Director monthly theme

### Festival / 內容待辦

- Festival lineup import
- Festival mini sequencing
- Festival theaters

### 變現待辦

- Payment integration
- Sponsor unlock 拆分策略

### 架構性待辦

- Archetype 擴充到 16 型
- Quadrant 從 3 軸升到 5 軸
- DNA system design 文件完整化
- Movie pool changelog 文件整理

## 暫不執行

以下不是「永遠不做」，而是目前不建議排進近期迭代。

1. Archetype 方案 B（16 型）
2. Archetype 方案 C（5 軸）
3. Festival 系列功能
4. Payment integration

理由：

- 依賴前面資料與測序品質先穩定
- 需要較大 backfill / 前端重構 / QA 成本
- 現階段不是主要勸退點

## 驗證規則

每一階段完成後至少做這些檢查：

1. 跑對應單元測試
2. 補一份最小手動驗證清單
3. 記錄是否影響既有 DNA 結果的 backfill 需求

建議最低驗證：

- `movie_pool` tag 驗證腳本
- `backend/tests/unit/test_dna_builder.py`
- 至少一輪實際 sequencing 手動測試
