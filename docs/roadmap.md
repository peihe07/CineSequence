# Cine Sequence — Execution Plan

> Last updated: 2026-04-02

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

### Phase 4 — Relaunch Monetization

ECPay 金流審核中，審核通過後立即執行。

| Item | Scope | Status |
|------|-------|--------|
| Relaunch reset migration | Reset all users/sessions/DNA | TODO |
| Extension 改為 10 rounds | Backend session logic | TODO |
| Free retest credits 歸零 | Backend entitlement logic | TODO |
| ECPay integration | Payment endpoint + callback | Blocked (pending approval) |
| Frontend payment wall | Retest/extend/invite blocked UI | TODO |
| Match invite unlock (NT$99) | Backend invite credits + unlock | TODO |
| Match message board | Async board for accepted matches (free) | TODO |

### Phase 5 — Growth

| Item | Scope | Status |
|------|-------|--------|
| DNA Share Card (premium NT$39-59) | Image generation + social sharing | TODO |
| User feedback survey | DNA result page | TODO |

## 待辦區

以下項目保留，但不排進目前的主線執行。

### 產品待辦

- Theater real-time updates
- Theater detail refactor
- Limited ticket styles

### 變現待辦（需要更大使用者基數）

- Festival sequencing pack (NT$79-149)
- Director theme pack (NT$79)
- Duo comparison report (NT$69)
- Annual review report (NT$79)
- Group sequencing (NT$199/group)
- Match monthly subscription tier (when DAU > 5,000)

### 架構性待辦

- Archetype 擴充到 16 型
- Quadrant 從 3 軸升到 5 軸
- Fix dead tags: artHouseBridge, moralAnxiety, urbanLoneliness

## 暫不執行

以下不是「永遠不做」，而是目前不建議排進近期迭代。

1. Archetype 方案 B（16 型）/ 方案 C（5 軸）
2. Festival 系列功能
3. Movie pool / tag 擴充（現有 372 部 + 35 tags 足夠）

理由：

- 變現優先，先驗證付費轉換率
- Pool/tag 擴充是有付費使用者之後的事
- 使用者回報的問題（配對重複、兩難選擇）是演算法問題，不是資料量問題

## 驗證規則

每一階段完成後至少做這些檢查：

1. 跑對應單元測試
2. 補一份最小手動驗證清單（见 `docs/manual-test-checklist.md`）
3. 記錄是否影響既有 DNA 結果的 backfill 需求

建議最低驗證：

- `movie_pool` tag 驗證腳本
- `backend/tests/unit/test_dna_builder.py`
- 至少一輪實際 sequencing 手動測試（核心路徑）
