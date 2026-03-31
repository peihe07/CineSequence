# Cine Sequence — Execution Plan

> Last updated: 2026-03-31

目前活躍主線細節請搭配：

- `docs/workstreams/dna.md`
- `docs/workstreams/theaters.md`
- `docs/workstreams/pricing.md`
- `docs/workstreams/ui.md`

這份文件只保留兩類內容：

- `實行計畫`：現在應該做，而且能直接執行的項目
- `待辦區`：值得保留，但目前不排進主線的項目

原則：

1. 先修會污染 DNA 結果的問題
2. 再修會明顯勸退新使用者的 UX
3. 最後才做擴張功能、節慶企劃、變現

> **狀態追蹤說明**：Item-level 執行歷史、驗證記錄、決策記錄請看 `docs/progress.md`。

## 實行計畫

### Phase 1-3（已清除完成項）

- 既有 Phase 1-3 項目已完成並自本文件清除。
- 若需查看完成歷史，請參考 `docs/progress.md` 與 `docs/archive/`。

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
- Sequencing entitlement rollout
- Sponsor unlock 拆分策略

### 架構性待辦

- Archetype 擴充到 16 型
- Quadrant 從 3 軸升到 5 軸

## 暫不執行

以下不是「永遠不做」，而是目前不建議排進近期迭代。

1. Archetype 方案 B（16 型）
2. Archetype 方案 C（5 軸）
3. Festival 系列功能
4. Payment integration / sponsor unlock

理由：

- 依賴前面資料與測序品質先穩定
- 需要較大 backfill / 前端重構 / QA 成本
- 現階段不是主要勸退點

## 驗證規則

每一階段完成後至少做這些檢查：

1. 跑對應單元測試
2. 補一份最小手動驗證清單（见 `docs/manual-test-checklist.md`）
3. 記錄是否影響既有 DNA 結果的 backfill 需求

建議最低驗證：

- `movie_pool` tag 驗證腳本
- `backend/tests/unit/test_dna_builder.py`
- 至少一輪實際 sequencing 手動測試（核心路徑）
