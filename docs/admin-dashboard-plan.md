# Admin Dashboard Improvement Plan

## Overview

4 bug fixes + 8 chart improvements for the admin dashboard.

**Files affected:**
- `frontend/app/(main)/admin/page.tsx` (324 → ~305 lines)
- `frontend/app/(main)/admin/page.module.css` (282 → ~260 lines)
- `backend/app/routers/admin.py` (377 → ~400 lines)
- `frontend/lib/i18n.tsx` (new keys)
- New: `frontend/app/(main)/admin/charts/` directory

---

## Phase 1: Bug Fixes ✅

- [x] **1.1** FunnelBar zero-width — `count === 0 ? 0 : Math.max(pct, 8)`
- [x] **1.2** Accept rate denominator — `accepted / (accepted + declined)`
- [x] **1.3** useEffect dep — `[]` instead of `[t]`
- [x] **1.4** AI pair estimation — use `AiTokenLog` count via `token_by_type`

## Phase 2: Chart Infrastructure ✅

- [x] **2.1** `charts/Tooltip.tsx` — glassmorphism tooltip
- [x] **2.2** `charts/MiniChart.tsx` — bar chart with tooltip + X/Y axes
- [x] **2.3** `charts/DonutChart.tsx` — SVG donut for archetype distribution
- [x] **2.4** `charts/StackedBar.tsx` — horizontal stacked bar for match status

## Phase 3: Frontend Integration ✅

- [x] **3.1** FunnelBar conversion rate percentages (step-to-step %)
- [x] **3.2** Replace archetype table → DonutChart
- [x] **3.3** Replace match status table → StackedBar
- [x] **3.4** Replace inline MiniChart → extracted component

## Phase 4: Date Range & Trends ✅

- [x] **4.1** Date range selector UI (7d / 30d / 90d)
- [x] **4.2** Backend trend data (week-over-week % change)
- [x] **4.3** StatCard trend indicators (↑↓ arrows with %)

## Phase 5: i18n ✅

- [x] **5.1** Added: `daysSuffix`, `dailyMatches`; updated: removed hardcoded "(30d)" from dailyRegistrations/dailyDnaBuilds

---

## Architecture

```
frontend/app/(main)/admin/
├── page.tsx              (main page, slimmed down)
├── page.module.css
└── charts/
    ├── Tooltip.tsx       (shared glassmorphism tooltip)
    ├── Tooltip.module.css
    ├── MiniChart.tsx     (bar chart + axes + tooltip)
    ├── MiniChart.module.css
    ├── DonutChart.tsx    (SVG donut + legend)
    ├── DonutChart.module.css
    ├── StackedBar.tsx    (horizontal stacked bar + legend)
    └── StackedBar.module.css
```

## Verification

- TypeScript: ✅ zero errors
- Backend syntax: ✅ py_compile passed
- Build: ✅ compiled successfully (pre-existing lint warning in AIReading.test.tsx unrelated)
