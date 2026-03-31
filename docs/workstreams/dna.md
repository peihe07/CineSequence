# DNA Workstream

> Last updated: 2026-03-30
> Scope: active DNA maintenance, follow-up improvements, and the reference docs that support the sequencing and scoring system.

## Current State

Completed in the last upgrade cycle:

- movie pool tag normalization
- Phase 1 core pair rewrite
- Phase 1 expansion to 60 pairs
- removal of `western_vs_eastern`
- pair review metadata
- contradiction-aware DNA consistency weighting
- Phase 2-3 session-seeded randomness
- archetype overlap tuning
- structured movie pool review metadata

This means the earlier cinephile upgrade is no longer an active execution plan. It is now reference history.

## Active Follow-Ups

> 優先順序請看 `docs/roadmap.md` Phase 3-4。以下只記錄 DNA 系統層的技術細節。

### Backend

- [ ] 穩定 seed movie search ranking 容錯視窗：目前已完成第一輪（query trimming、NFKC 正規化、year-aware ranking），加強階段可繼續迭代。
- [ ] `dislike_both` Phase B scoring 決策：等 Phase A 營運資料累積後再評估要用 dimension-level 負向、movie-level 負向、還是僅 diagnostics。
- [ ] `seen_one_side` Phase A：新增 `seen_left_only` / `seen_right_only` decision_type，前端放入 expanded action area，DNA builder 先忽略，routing / analytics 先吃。（詳見 `docs/proposals/seen-one-side-mechanic.md`）
- [ ] Match threshold per-user：`User` 新增 `match_threshold` 欄位（預設 0.85），profile API 開放讀寫，`matcher.py` 改用 per-user 值，前端提供 75–95% 調整 UI。
- [ ] 評估新 DNA 結果欄位是否應成為 first-class schema output（目前部分頁面層輸出）。
- [ ] pricing-aware sequencing 行為驗證：目前被 blocked 於 local test DB 設定。

### Character Mirror

- [x] `character_profiles.json` dataset（83 個角色）：**DONE** 2026-03-31，涵蓋 7 種心理框架與亞洲、歐洲、美國、動畫多地區分布。（詳見 `docs/proposals/character-mirror.md`）
- [ ] `character_mirror.py` resonance engine：等 DNA 穩定 + dataset 完成後實作。
- [ ] `character_mirror.txt` Gemini prompt + result page UI：等 engine 完成後接手。

### Deferred System Changes

- [ ] Archetype 擴充到 16 型
- [ ] Quadrant 從 3 軸升到 5 軸
- [ ] `americanAuteur` tag（等 `artHouseBridge` 實際分布確認後再評估）

這兩項待機：需等現有訊號品質充分穩定前再評估 QA 與 backfill 成本。

## Priority Order

1. 提升使用者测序入口 UX（詳見 roadmap Phase 3）。
2. 保持 search quality 與 signal quality 穩定。
3. 等現有系統有足夠實際使用紀錄後，再重新評估 DNA 模型設計。

## Reference Docs

- `docs/dna-system-design.md`
- `docs/movie-pool-changelog.md`
- `docs/manual-review-metadata-process.md`
- `docs/progress.md`
- `docs/archive/cinephile-upgrade-plan.md`
