# UI Workstream

> Last updated: 2026-03-30 (Phase 3 complete)
> Scope: site-wide design system, typography, layout upgrades across all product surfaces.

## Purpose

這份文件追蹤全站 UI/UX 升級的活躍工作。

設計系統背景、診斷說明與完整規格請看：

- `docs/proposals/site-wide-ui-upgrade.md`

## Current State

### Completed

- **Phase 1 — Foundation tokens** (2026-03-30)
  - `frontend/app/globals.css` 已建立 `--text-xs` 到 `--text-2xl`、`--leading-*`、`--surface-*` 等共用變數。

- **Phase 2 — Hardcoded type cleanup** (2026-03-30)
  - 高流量頁面的 `0.6*rem` / `0.7*rem` meta/label 已替換為 global tokens。
  - 已涵蓋：auth、header/footer、ticket、matches、theaters、dna、profile、notifications、sequencing、admin charts。

- **Phase 3 — Theaters layout pass** (2026-03-30)
  - Tabbed library detail panels。
  - Overview shelf tabs + carousel controls。
  - Collapsible list detail + collapsible replies + summary chips。
  - 此模組的 scan-cost reduction 視為完成，不建議再持續細修。

## Active Follow-Ups

### Phase 3 — Remaining Modules

- [x] **Ticket** (2026-03-30) — `page.module.css` 3 處、`TicketCard.module.css` 3 處 hardcoded 字級已全部替換為 token；補上 `line-clamp` compatibility 修正。
- [x] **Admin** (2026-03-30) — `page.module.css` 10 處 hardcoded 字級（`0.65rem`–`0.8rem`, `1.4rem`）全部替換為 token。Charts 元件（MiniChart、DonutChart、StackedBar、Tooltip）已使用 `var(--text-xs)` 無需修改。

> **Phase 3 全部完成。** 如未來有新模組需要追加，在此補記。

### Design System Maintenance

- [ ] 確認各 module 沒有再新增 hardcoded 字級（低於 `--text-xs`）。
- [ ] 未來新頁面應從 `--surface-*` 與 `--text-*` tokens 起步，不允許從 `#000` 或 `0.6rem` 直接寫死。

## Priority Order

1. Ticket 第二輪佈局微調。
2. Admin chart 對齊。
3. 之後再視 product 需求決定其他模組是否需要進一步 layout 升級。

## Related Files

- `frontend/app/globals.css` — design token 定義
- `docs/proposals/site-wide-ui-upgrade.md` — 完整診斷與設計系統規格
