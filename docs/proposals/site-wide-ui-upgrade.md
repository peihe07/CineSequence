# 全站 UI/UX 設計與體驗優化方案 (Site-wide Design Upgrade)

> Status: Phase 1-2 complete, Phase 3 in progress
> Last updated: 2026-03-30

在檢視了包含放映廳 (Theater)、配對 (Match)、基因解析 (DNA)、使用者驗證 (Auth) 以及管理員後台 (Admin) 在內的全局實作後，發現「字體偏小」與「配色太黑」是系統性問題。

本文件旨在確立一套**全局適用的設計標準 (Design System)**，徹底解決可讀性差、視覺疲勞與層次感不足的問題。

---

## 1. 核心診斷：為什麼整體網站會「字體太小、顏色太黑」？

### 1.1 字體過小 (Typography Scale Issue)
全站的 `.module.css` 檔（包括 `Admin`, `Profile`, `TicketCard`, `Sequencing` 等）大量使用了 `0.6rem` (約 9px) 到 `0.75rem` (約 11px) 的 hardcoded 字級。
這在現代高解析度螢幕或手機上，已經低於無障礙閱讀 (Accessibility) 的最低標準。

### 1.2 配色過黑與層次缺失 (Color & Elevation Issue)
在深色模式（Archive Mode / Theater 等）中，背景大量採用 `#0a0b0c` 或 `#000`，且卡片與區塊也缺乏足夠的亮度差。這導致：
- 視覺沒有焦點，所有元件都「糊」在背景裡。
- 次要文字（如 `rgba(255,255,255,0.42)`）在極黑背景下對比度極低，進一步加劇了閱讀困難。

---

## 2. 全局設計系統升級計畫 (Global Design System)

為了根除這些問題，必須在 `globals.css` 中建立嚴格的變數系統，並逐步淘汰各模組中的 hardcoded 數值。

### 2.1 建立標準字級音階 (Typography Scale)
**原則：最小字體不得低於 13px (0.8125rem)。**

建議在 `:root` 新增以下變數：
```css
/* Typography Scale */
--text-xs: 0.8125rem;  /* 13px - Meta, Labels, Tags (取代原有的 0.6rem~0.7rem) */
--text-sm: 0.875rem;   /* 14px - 輔助說明, 次要資訊 */
--text-base: 0.95rem;  /* 15.2px - 一般內文 (取代原有的 0.84rem) */
--text-lg: 1.125rem;   /* 18px - 小標題, 醒目資訊 */
--text-xl: 1.35rem;    /* 21.6px - 區塊標題 */
--text-2xl: 1.75rem;   /* 28px - 頁面大標題 */

/* 行高優化 */
--leading-tight: 1.3;
--leading-base: 1.6;
--leading-relaxed: 1.75;
```

### 2.2 改善深色模式色彩與海拔 (Color & Elevation)
**原則：用「深炭灰」取代「純黑」，用「亮度差」建立層次。**

更新 `:root` 中的 Archive（深色）變數：
```css
/* Base Background */
--archive-bg: #121418;       /* 從 #0a0b0c 提亮至帶有微藍調的深炭灰 */
--archive-bg-alt: #181a20;   /* 次級背景 */

/* Elevation (海拔系統 - 越上層越亮) */
--surface-base: rgba(28, 30, 34, 0.6);   /* Section / 大區塊背景 */
--surface-raised: rgba(36, 39, 44, 0.8); /* Card / 卡片背景 */
--surface-hover: rgba(45, 49, 55, 0.9);  /* Hover 狀態 */

/* Text Readability */
--archive-text: #f0f2f5;                  /* 提高主文字對比純度 */
--archive-text-muted: rgba(255, 255, 255, 0.65); /* 從 0.45 提升至 0.65，確保小字可讀 */
```

---

## 3. 各子系統的具體改造建議

### 3.1 票根與配對模組 (Ticket & Match - `TicketCard`, `TearRitual`)
- **現況：** 票根資訊充滿了 `0.6rem` 到 `0.65rem` 的微小字體，使用者難以看清 DNA 標籤。
- **改善：** 將票根上的 Meta 資料全面升級至 `var(--text-xs)` (13px)。稍微放大票根本身的寬度以容納合理大小的文字。

### 3.2 驗證模組 (Auth - `LoginForm`, `RegisterForm`, `WaitlistForm`)
- **現況：** 表單輸入框的提示文字 (Placeholder/Labels) 太小 (0.64rem)，且黑色背景的 Modal 顯得壓抑。
- **改善：** 輸入框字體提昇至 `var(--text-base)`。Login Modal 的背景從死黑改為 `var(--surface-raised)`，並加入柔和的外發光 (Glow) 取代硬邊框。

### 3.3 後台管理模組 (Admin - `charts/`, `page.module.css`)
- **現況：** 圖表 (Charts) 與數據卡片的標籤字體小到 `0.6rem`，且表面顏色配置較為混亂。
- **改善：** 圖表的 Tooltip 與標籤統一使用 `var(--text-xs)`。套用全局的 `--admin-surface` 變數並提高背景明度，讓數據呈現更清爽專業。

### 3.4 放映廳與策展模組 (Theaters & Sequencing)
- **現況：** 採用了深色主題，但片單呈排版過度依賴垂直堆疊，卡片內的資訊（如標籤）小到難以閱讀。
- **改善：**
  1. 導入 `MovieCarousel` 橫向滑動元件，解決垂直空間浪費。
  2. 套用新的 `--surface-raised` 讓電影卡片浮出背景。
  3. 成員片單改為「海報牆」視覺，將繁雜的 Meta data 隱藏至 Hover 狀態。

---

## 4. 執行計畫 (Roadmap)

此為全站規模的重構，建議依序進行：

**Phase 1: 基礎建設 (Foundation) - DONE**
- 已升級 `frontend/app/globals.css`，建立 typography scale、line-height 與 dark-surface elevation tokens。

**Phase 2: 淘汰 Hardcoded 數值 (Refactoring) - DONE**
- 已完成高流量頁面的 `0.6*rem`, `0.7*rem` meta/label cleanup，並將深色背景逐步替換為全局 surface tokens。
- 已涵蓋 auth、header/footer、ticket、matches、theaters、dna、profile、notifications、sequencing 與 admin chart 的主要閱讀面。

**Phase 3: 模組佈局升級 (Layout Upgrade) - IN PROGRESS**
- 依照先前的 Theater 改善計畫，實作橫向轉盤與分頁切換。
- 檢視 Ticket 與 Admin 圖表的 RWD (響應式) 狀態，確保字體放大後不會跑版。

### Phase 1-2 完成摘要

- `globals.css` 已提供 `--text-xs` 到 `--text-2xl`、`--leading-*`、`--surface-*` 等共用變數。
- 主要深色頁面已從接近純黑的背景改為深炭灰階層。
- 主流程頁面中的 mono label、meta、badge、hint 已不再低於 `--text-xs`。

### Phase 3 當前切入點

- `Theaters` 先行：把 library card 由縱向資訊堆疊改成分頁式 detail panel，降低掃讀成本。
- `Ticket` 後續：針對 enlarged type 後的 spacing 與 RWD 做第二輪佈局微調。
