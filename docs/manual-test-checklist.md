# Manual Test Checklist

> Last updated: 2026-03-30
> 每次 DNA 系統、测序流程、或配對邏輯有重大改動後，應手動跑一遍以下流程。
> 快速驗證可只跑「核心路徑」；完整驗證跑全部。

## 核心路徑（每次部署後）

### A. 入口與帳號

- [ ] 首頁正常載入，CTA 文字清楚
- [ ] 首頁新用戶 CTA 導向 `/register`，不是壞掉或空白頁
- [ ] `/register` 頁可正常提交註冊並收到 magic link 信件
- [ ] 若營運切回 waitlist 模式，送出 waitlist email → 顯示成功訊息，沒有錯誤頁
- [ ] Magic link 可成功驗證並進入預期頁面（依 `next` / `next_path` 而定）
- [ ] 登入（已存在帳號）→ 收到 magic link → 正常登入
- [ ] 管理員帳號登入後 → 直接進入 `/admin`，不回首頁
- [ ] 登出後重新整理，需重新登入

### B. 種子電影搜尋

- [ ] 輸入中文片名（如「飛屋環遊記」）→ 出現正確結果
- [ ] 輸入英文片名（如「Paris, Texas」）→ 出現正確結果
- [ ] 輸入年份縮小結果（如「Fargo 1996」）→ 結果排序正確
- [ ] 輸入不存在的片名 → 顯示空結果引導文字，不顯示錯誤頁
- [ ] 選定種子電影後 → 確認卡片正確顯示所選片名

### C. 測序流程

- [ ] 進入測序 → 第一組比對（Phase 1）正常顯示兩張海報
- [ ] 選擇左邊 / 右邊 → 自動進入下一輪
- [ ] 點擊「換一組」(reroll) → 替換當前比對，不計分
- [ ] 點擊「跳過」(skip) → 記錄弱負向，進入下一輪
- [ ] Phase 1 結束（第 8 輪）→ Phase 2 正常切換（AI pair 生成）
- [ ] Phase 2 的 pair 不重複出現已看過的電影
- [ ] Phase 3 輪次（第 19 輪起）正常繼續

### D. DNA 結果

- [ ] 完成 30 輪後 → 進入測序完成畫面
- [ ] 點擊「查看結果」→ DNA 結果頁正常載入
- [ ] 結果頁顯示：archetype 名稱、tag cloud、personality reading 文字
- [ ] Personality reading 為繁體中文，無明顯截斷或亂碼
- [ ] 票券視覺正常顯示（ticket style 與 archetype 對應）
- [ ] 「可以重測」或「無法重測」的 CTA 狀態與entitlement 一致

### E. 配對探索

- [ ] 完成 DNA 後 → 配對頁可看到候選對象列表（或空狀態引導）
- [ ] 空狀態顯示引導文字，非空白頁面
- [ ] 點擊候選對象 → 顯示共同偏好資訊
- [ ] 發送邀請 → 對方收到邀請信件
- [ ] 接受邀請後 → 顯示 accepted match ticket deep link 與聯絡資訊

---

## 完整路徑（大版本改動後）

### F. 測序中斷與恢復

- [ ] 做到第 10 輪後關閉頁面，重新開啟 → 出現「繼續測序」checkpoint
- [ ] 確認恢復後接續正確的輪次（不從頭開始）

### G. Dislike Both 互動

- [ ] 展開次層操作 → 可看到「兩部都不喜歡」按鈕
- [ ] 點擊後 → 進入下一輪，不強迫選邊

### H. 重測流程

- [ ] 有免費重測額度時 → 點擊「重測」→ 進入新的測序 session
- [ ] 重測後 DNA 結果更新為新版本
- [ ] 舊版本結果可透過 DNA history 查看（如有實作）

### I. 放映廳

- [ ] 進入放映廳列表 → 顯示已加入的廳
- [ ] 進入廳內 → 可看到片單與成員
- [ ] 新增重複電影到同一片單 → 回傳衝突提示，不應重複加入
- [ ] 新增片單 → 片單出現在列表中
- [ ] 新增電影到片單 → 出現在片單內
- [ ] 新增回覆到片單 → 回覆可展開收合
- [ ] 廳內活動動態正常顯示

### J. 通知系統

- [ ] 收到邀請後 → 通知 bell 出現未讀標示
- [ ] 點擊通知 → 跳到對應頁面
- [ ] 接受邀請後 → 通知 bell 更新
- [ ] 放映廳自動分派通知失敗時，不影響 auto-assign 主流程

### K. 手機版

- [ ] 390px 寬度下首頁、登入、註冊、定序、DNA、配對、放映廳無橫向溢出
- [ ] 手機版 header 選單可正常開啟與關閉
- [ ] 未登入直接進 `/sequencing`、`/dna`、`/matches`、`/theaters` → 會導向 `/login?next=...`，不會卡在 Loading

---

## 測試帳號建議

建立至少兩個測試帳號以驗證配對相關流程：

- `tester_a@example.com`：測序完成，有 DNA
- `tester_b@example.com`：測序完成，且與 A 有配對條件

如果需要強制建立配對，可透過 admin 後台或直接 DB 操作。

---

## DNA 資料品質抽查（taxonomy 或 pool 改動後）

在以下情況需額外手動確認 DNA 結果的品質：

- 新增 tag 到 `tag_taxonomy.json`
- 大量替換 `phase1_pairs.json` 的 pair
- 新增超過 20 部電影到 `movie_pool.json`

確認項目：

- [ ] 使用新批次 pair 完成一輪測序，確認 archetype 分配合理（不極端偏一個 archetype）
- [ ] Personality reading 中提及的 tag 與 sequencing 選擇方向一致
- [ ] 跑 `npm run validate:movie-pool` 與 `npm run validate:phase1-pairs` 無錯誤
- [ ] 跑 `npm run test:backend:unit` 全部通過
