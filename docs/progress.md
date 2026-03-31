# Cine Sequence - Progress

> Last updated: 2026-03-31
> Source of truth for current open execution progress.

## Status Legend

- `TODO`: not started
- `IN PROGRESS`: actively being worked on
- `BLOCKED`: cannot proceed until dependency or decision is resolved

## Open Items

| Workstream | Item | Status | Last touched | Notes |
|------------|------|--------|--------------|-------|
| DNA | Seed movie search ranking hardening (phase 2) | TODO | 2026-03-31 | 第一輪（query trimming / NFKC / year-aware ranking）已落地，後續容錯與排序品質待加強。 |
| DNA | `dislike_both` Phase B scoring decision | TODO | 2026-03-31 | 等 Phase A 資料累積後決定是否納入 scoring。 |
| DNA | DNA output schema elevation review | TODO | 2026-03-31 | 評估頁面層輸出欄位是否需要升級成 first-class schema。 |
| DNA/Pricing | pricing-aware sequencing verification | BLOCKED | 2026-03-31 | 受阻於 local test DB setup。 |
| Product | DNA Share Card | TODO | 2026-03-31 | 需在 DNA 穩定後排程。 |
| Product | User feedback survey | TODO | 2026-03-31 | 核心體驗穩定後再導入。 |

## Decision Log

| Date | Decision | Reason |
|------|----------|--------|
| 2026-03-31 | 主線 docs 清除完成項目，只保留 open work | 降低維護成本，避免執行文件被歷史訊息淹沒。 |

## Notes

- 完成歷史與舊驗證紀錄請改查 `docs/archive/` 與 Git commit history。
- 若新項目開始執行，請直接新增到上方 `Open Items` 表格。
