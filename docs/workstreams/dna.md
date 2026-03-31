# DNA Workstream

> Last updated: 2026-03-31
> Scope: active DNA maintenance, follow-up improvements, and the reference docs that support the sequencing and scoring system.

## Active Follow-Ups

> 優先順序請看 `docs/roadmap.md` Phase 4。以下只記錄 DNA 系統層的技術細節。

### Backend

- [ ] 穩定 seed movie search ranking 容錯視窗：目前已完成第一輪（query trimming、NFKC 正規化、year-aware ranking），加強階段可繼續迭代。
- [ ] `dislike_both` Phase B scoring 決策：等 Phase A 營運資料累積後再評估要用 dimension-level 負向、movie-level 負向、還是僅 diagnostics。
- [ ] 評估新 DNA 結果欄位是否應成為 first-class schema output（目前部分頁面層輸出）。
- [ ] pricing-aware sequencing 行為驗證：目前被 blocked 於 local test DB 設定。

### Character Mirror

- [ ] Character dilemma rounds（sequencing Phase 3 插入 2-3 題角色情境題）是否納入主線。
- [ ] Character mirror 後續版本是否加入 retest evolution 對照。

### Deferred System Changes

- [ ] Archetype 擴充到 16 型
- [ ] Quadrant 從 3 軸升到 5 軸
- [ ] `americanAuteur` tag（等 `artHouseBridge` 實際分布確認後再評估）

這些項目維持待機：需等現有訊號品質充分穩定前再評估 QA 與 backfill 成本。

## Priority Order

1. 保持 search quality 與 signal quality 穩定。
2. 等現有系統有足夠實際使用紀錄後，再評估 scoring 與 Character Mirror 下一階段。
3. 最後才進行大規模 DNA 模型改造。

## Reference Docs

- `docs/dna-system-design.md`
- `docs/movie-pool-changelog.md`
- `docs/manual-review-metadata-process.md`
- `docs/progress.md`
- `docs/archive/cinephile-upgrade-plan.md`
