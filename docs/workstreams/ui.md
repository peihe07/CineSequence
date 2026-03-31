# UI Workstream

> Last updated: 2026-03-31
> Scope: site-wide design system, typography, layout upgrades across all product surfaces.

## Purpose

這份文件追蹤全站 UI/UX 升級的活躍工作。

設計系統背景、診斷說明與完整規格請看：

- `docs/proposals/site-wide-ui-upgrade.md`

## Current State

- 既有 Phase 1-3 已完成，完成項已自本文件清除。
- 目前僅保留 ongoing maintenance。

## Active Follow-Ups

### Design System Maintenance

- [ ] 確認各 module 沒有再新增 hardcoded 字級（低於 `--text-xs`）。
- [ ] 未來新頁面應從 `--surface-*` 與 `--text-*` tokens 起步，不允許從 `#000` 或 `0.6rem` 直接寫死。

## Priority Order

1. 先做全站 hardcoded 字級回歸檢查。
2. 再補充 token lint / checklist 流程，避免後續回退。

## Related Files

- `frontend/app/globals.css` — design token 定義
- `docs/proposals/site-wide-ui-upgrade.md` — 完整診斷與設計系統規格
