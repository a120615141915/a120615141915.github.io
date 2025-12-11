# 拍賣系統 MVP 前端 Demo — 完整 PRD（含 User ID 支援）

> 版本：v1.0 — 單人 Demo（單一使用者操作，不處理並發）
> 時區：Asia/Taipei (+08:00)
> 注意：每個角色頁面均新增一個 **User ID**（文字輸入框），代表當前操作者。所有寫入／更新／log 操作必須帶入該 ID（格式在欄位中以 `ROLE:ID` 保存，例如 `DRV:driver01`）。

---

# 目標與背景（Goal & Background）

本專案為拍賣系統前端 MVP Demo：提供多角色前端頁面（Driver、Tally、Grader、Auction、Buyer、Dashboard、Index）與最小資料流程示意。所有資料以瀏覽器端 `MockDB`（localStorage 中的 CSV 文本）為單一事實來源。Demo 假設單人操作、影像為 mock、AI 為前端模擬。每個角色頁面需能指定 User ID，以模擬同一角色下不同使用者操作並在資料與 Log 中可追溯。

---

# 主要限制（MVP 範圍）

* 單人 Demo：不考慮多工/鎖定/衝突。
* 影像：僅 mock（URL 或內建示意圖），不儲存實檔。
* AI：在 Tally Submit 之後由前端 `MockAI.predict()` 同步產生建議並寫回該筆 batch（ai_suggestions）；Tally 本身不直接做 AI 判斷。
* 資料單位：以 `batch` 為原子單位（row），司機可建立 `trip`（車次）並於一個來源下一次上傳多筆 batch。
* 每個頁面必須顯示並要求填入該頁面的 `User ID`（若未填則阻止會變更資料的操作）。

---

# 全域定義 / 命名規則

* 時間格式：ISO 8601（例：`2025-12-08T08:30:00+08:00`，Asia/Taipei）。
* `batch_id`：`yyyyMMddHHmmss-ROLE`（示例：`20251208083000-DRV`）。若同秒多筆允許 `-01` 的後綴（regex `^\d{14}-[A-Z]{3}(-\d{2})?$`）。
* 角色縮寫：

  * Driver = `DRV`
  * Tally = `TLY`
  * Grader = `GRD`
  * Auction = `AUC`
  * Buyer = `BUY`
  * GM / Dashboard = `GM`
* `created_by` / `updated_by` 欄位值為 `ROLE:ID`（例：`DRV:driver01`）。
* Log 欄 `role` 與 `actor_id`（actor_id = UI 填入的 ID）。

---

# CSV Header（建議）

```
row_id,trip_id,batch_id,product_id,item,source,producer,boxes,quantity,price,currency,quality_data,ai_suggestions,final_grade,start_price,status,note,created_at,created_by,updated_at,updated_by
```

---

# MockDB API（前端 stub 建議）

```js
MockDB = {
  initFromCSV(csvText),            // seed data if localStorage empty
  getRows(filters = {}),          // returns Array<RowObject>; supports status, trip_id, product_id, date range, etc.
  appendCsvRow(rowObject),        // rowObject MUST include created_by (e.g., "DRV:driver01"); returns created row with row_id
  updateRow(row_id, patch),       // patch MAY include updated_by (e.g., "GRD:grader01"); returns updated row
  exportCsv(filename?),           // triggers download of current CSV
  reset(),                        // clear localStorage and reseed from data.csv
  getTrips(),                     // return list of trips & simple summary
  appendLog(logObject),           // logObject must include {role, actor_id, action, row_id?, diff?, ts}
  getLogs(filters)                // returns logs
}
```

> 實作建議：在每個 append/update 前端都把 `created_by`/`updated_by` 塞入 rowObject。所有 DB 寫入同時呼叫 `MockDB.appendLog()` 表示操作者與時間。

---

# MockAI 規範（Tally Submit 後觸發）

* 觸發時機：**Tally** 在 Submit 後同步觸發 `MockAI.predict(product_id, quality_data)`（前端函式）。
* 輸出 shape：

```json
{
  "model":"mock-normal-v1",
  "predictions": { /* field->value */ },
  "confidences": { /* field->0-1 */ },
  "suggested_final_grade":"A",
  "suggested_start_price": 1200,
  "ai_generated_at":"2025-12-08T08:35:00+08:00",
  "ai_generated_by":"TLY:<tally_id>" // optional but recommended
}
```

* 生成策略（數值欄）：在 schema 的 [min,max] 內用常態分佈抽樣（mean=(min+max)/2, sd=(max-min)/6），clamp 到範圍；confidence 以距離 mean 的函數或隨機 0.6–0.95。

---

# Data Model: 商品 schema（MVP）

* 蘋果（101）

  * `brix` number 0–20 (°Brix)
  * `color_coverage` number 0–100 (%)
  * `size_count` integer 1–200
  * `russeting` enum `none|light|moderate|heavy`
  * `crispness_score` number 0–10
* 高麗菜（201）

  * `compactness` number 0–100
  * `avg_weight` number 200–2000 (grams)
  * `leaf_condition` enum `good|damaged|wilted`
  * `trim_status` enum `trimmed|untrimmed`
  * `defects` integer 0–20
* 筊白筍（305）

  * `flesh_color` enum `white|light_brown|brown`
  * `black_heart` boolean
  * `shell_status` enum `intact|cracked`
  * `fibrosity` number 0–10
  * `length_cm` number 5–50

---

# 範例 seed（6 筆）

（可直接貼入 `data.csv` 或用在 `MockDB.initFromCSV`）

Header 同上。下面為 6 筆範例（created_by/updated_by 樣板使用 `DRV:driver01`）：

```
row_id,trip_id,batch_id,product_id,item,source,producer,boxes,quantity,price,currency,quality_data,ai_suggestions,final_grade,start_price,status,note,created_at,created_by,updated_at,updated_by
r-20251208-0001,trip-20251208-0830-DRV001,20251208083000-DRV,101,蘋果,大樹農會,張XX,5,5,0,TWD,{},, , ,created,貨物1,2025-12-08T08:30:00+08:00,DRV:driver01,2025-12-08T08:30:00+08:00,DRV:driver01
r-20251208-0002,trip-20251208-0830-DRV001,20251208083005-DRV,101,蘋果,大樹農會,張XX,4,4,0,TWD,{},, , ,created,貨物2,2025-12-08T08:30:05+08:00,DRV:driver01,2025-12-08T08:30:05+08:00,DRV:driver01
r-20251208-0003,trip-20251208-0830-DRV001,20251208083010-DRV,201,高麗菜,埔里農會,陳XX,5,5,0,TWD,{},, , ,created,貨物3,2025-12-08T08:30:10+08:00,DRV:driver01,2025-12-08T08:30:10+08:00,DRV:driver01
r-20251208-0004,trip-20251208-0830-DRV001,20251208083015-DRV,101,蘋果,玉里農會,王XX,8,8,0,TWD,{},, , ,created,貨物4,2025-12-08T08:30:15+08:00,DRV:driver01,2025-12-08T08:30:15+08:00,DRV:driver01
r-20251208-0005,trip-20251208-0830-DRV001,20251208083020-DRV,201,高麗菜,水上農會,李XX,5,5,0,TWD,{},, , ,created,貨物5,2025-12-08T08:30:20+08:00,DRV:driver01,2025-12-08T08:30:20+08:00,DRV:driver01
r-20251208-0006,trip-20251208-0830-DRV001,20251208083025-DRV,201,高麗菜,大樹農會,張XX,12,12,0,TWD,{},, , ,created,貨物6,2025-12-08T08:30:25+08:00,DRV:driver01,2025-12-08T08:30:25+08:00,DRV:driver01
```

---

# 各頁面完整規格（統一格式：Purpose / Main UI / User Flow / Data / Validation & UX / Acceptance Criteria）

---

## 1) Driver — `driver.html`

### Purpose

司機建立/管理車次（trip），以「來源 (source)」為單位一次輸入多筆貨物；trip summary 顯示並可編輯該 trip 下的 batch。

### Main UI

* Header：`Driver ID` (text input, required) + Trip controls（Create / Select）
* Source List（Accordion 卡片）

  * Source 基本資訊（source name, location, default producer）
  * 多列 Item 表格（producer, product_id select, item, boxes, quantity, price, note）
  * Buttons：Add Item, Save Draft, Submit Source（一次送出本來源下所有未送出的 item）
* Trip Summary（側邊）：已建立 batch 列表與編輯/刪除操作
* Toast / Confirm Modal（提交預覽包含 `created_by`）

### User Flow

1. 填寫 `Driver ID`（必填）→ 建立/選擇 Trip（`trip_id` 自動）
2. 在某來源新增多列 item → 編輯必要欄位 → 按 `Submit Source` → 顯示 Confirm Modal（列出將建立的 N 筆摘要與 `created_by`）→ 確認 → 系統為每筆生成 `batch_id` 並依序呼 `MockDB.appendCsvRow()`
3. 每筆新增的 row 會在 trip summary 顯示（可 Edit / Delete），Edit 會呼 `MockDB.updateRow()` 並以 `updated_by = "DRV:<ID>"` 記錄。

### Data / MockDB

* `appendCsvRow(rowObject)` must include `created_by: "DRV:<DriverID>"`.
* `updateRow(row_id, patch)` must include `updated_by: "DRV:<DriverID>"`.
* 每次 append/update 同時 `MockDB.appendLog({role:'DRV', actor_id: '<DriverID>', action:'create_batch'|'update_batch', row_id, diff?, ts})`.

### Validation & UX

* `Driver ID` 必填；若為空禁用 Submit。
* 必填欄位：`product_id`, `item`, `boxes (>0)`.
* Submit Modal 顯示即將建立的 batch_id 預覽（若需要 uniqueness guardian，app 會在生成時確保）。
* 同秒衝突策略：append `-01`、`-02` 或秒數微增（實作細節開發選擇）。

### Acceptance Criteria (Gherkin)

```gherkin
Feature: Driver 建立 trip 並以來源一次新增多筆 batch
  Scenario: Driver 在來源新增多筆並提交
    Given 我為 Driver 並在 driver.html 已輸入 Driver ID = "driver01" 且 trip 已建立
    When 我在來源 "大樹農會" 新增三筆 item 並按 Submit Source 並 Confirm
    Then 應對每筆呼叫 MockDB.appendCsvRow()
    And 每筆 batch 的 batch_id 符合 /^\d{14}-DRV(-\d{2})?$/
    And 每筆 row 的 created_by = "DRV:driver01"
    And trip summary 顯示三筆新 batch 且 status = "created"
```

---

## 2) Tally — `tally.html`

### Purpose

理貨員檢核或代為建立批次；拍照（mock image）並檢查貨品現況，Submit 後觸發 MockAI 產生建議並寫回 `ai_suggestions`。

### Main UI

* Header：`Tally ID`（text input, required） + Search/Filter（trip/source/status）
* Batch List（總表）與 Create Batch（若 Driver 未先建檔）
* Batch Detail Panel：

  * Mock Image 顯示（選擇示意圖）
  * 欄位編輯區：product_id, source, producer, item, boxes, quantity, price, dynamic quality_data fields
  * Buttons：Save Draft、Submit & Trigger AI、Mark as Needs Info
* Toast / AI result indicator（ai_suggestions timestamp）

### User Flow

1. 填寫 `Tally ID` → 搜尋待處理批次（或建立新 batch）
2. 對選中或新建的 batch 拍照（選 mock image）、檢核資料 → 修改不吻合欄位
3. 按 `Submit & Trigger AI`：

   * 若是新建：`MockDB.appendCsvRow()`（include `created_by: "TLY:<ID>"`）
   * 若是更新：`MockDB.updateRow(row_id, patch)`（include `updated_by: "TLY:<ID>"`）
   * 呼叫 `MockAI.predict(product_id, quality_data)`（同步），回傳寫入 `ai_suggestions`（`MockDB.updateRow(...)` 加寫 `ai_suggestions`，並可把 `updated_by` 設為 `TLY:<ID>` 或 `AI` 欄記錄）
   * `MockDB.appendLog({role:'TLY', actor_id:'<ID>', action:'submit_and_trigger_ai', row_id, ts})`

### Data / MockDB

* New batch: `appendCsvRow({..., created_by:"TLY:amy"})`
* Update + AI writeback: `updateRow(row_id, {ai_suggestions: {...}, updated_by:"TLY:amy", status:"ai_suggested"})`
* Log: append both Tally action & AI write action (AI write can carry `ai_generated_by:"TLY:amy"` if desired)

### Validation & UX

* `Tally ID` 必填；若為空則 disable Submit。
* 必填檢核：`source`, `producer`, `product_id`, `boxes`。
* Show ai_suggestions timestamp & model_version in UI after submit.
* 如果新建資料缺重要欄位，允許暫存草稿。

### Acceptance Criteria (Gherkin)

```gherkin
Feature: Tally 建檔與觸發 AI
  Scenario: Tally 建立新 batch 並觸發 AI 建議
    Given 我為 Tally 且在 tally.html 輸入 Tally ID = "amy"
    When 我建立一筆新 batch 並按 Submit & Trigger AI
    Then 應呼叫 MockDB.appendCsvRow() 並 created_by = "TLY:amy"
    And 前端呼叫 MockAI.predict() 並把回傳寫入該 row 的 ai_suggestions
    And 該 row 的 updated_by 包含 "TLY:amy"
    And MockDB.appendLog() 包含 role="TLY" 與 actor_id="amy"
```

---

## 3) Grader — `grader.html`

### Purpose

裁價員檢視由 Tally 建檔並含 AI 建議的批次，核對/修改 AI 建議欄位，最終設定 `final_grade` 與 `start_price` 並標記為 `graded`。

### Main UI

* Header：`Grader ID`（text input, required）+ Filter / Queue（status: ai_suggested,tallied）
* Batch Review Panel：

  * 基本資訊（mock image, source, producer, boxes）
  * AI 建議區（predictions + confidences + suggested_final_grade + suggested_start_price），可 edit
  * Dynamic quality_data fields（prefill from ai_suggestions.predictions）
  * final_grade selector, start_price input
  * Buttons：Save Draft、Finalize (Save & set status=graded)
  * Log panel（顯示歷史操作）

### User Flow

1. 填寫 `Grader ID` → 選一筆 `ai_suggested` batch
2. 預填 AI 建議欄位 → 檢核並修改任意欄位 → 輸入 `start_price` 與 `final_grade`
3. 按 `Finalize`：

   * `MockDB.updateRow(row_id, {quality_data, final_grade, start_price, status:"graded", updated_by:"GRD:<ID>"})`
   * `MockDB.appendLog({role:"GRD", actor_id:"<ID>", action:"grade_finalize", row_id, diff, ts})`

### Data / MockDB

* `updateRow` 必須帶 `updated_by: "GRD:<ID>"`。
* Log 記錄欄位修改差異（diff）與 actor_id。

### Validation & UX

* `Grader ID` 必填以啟動 Finalize。
* final_grade 與 start_price 為必要（Finalize 前）。
* 編輯 AI 建議值時旁示「已修改（修改前: x）」。

### Acceptance Criteria (Gherkin)

```gherkin
Feature: Grader 檢核並設定起標價
  Scenario: Grader 對一筆 ai_suggested 資料核對並 finalize
    Given 系統有 row.status = "ai_suggested" 且 ai_suggestions 存在
    And 我在 grader.html 輸入 Grader ID = "bob"
    When 我修改 predictions 與輸入 start_price 並按 Finalize
    Then MockDB.updateRow() 應被呼叫且 updated_by = "GRD:bob"
    And appendLog() 記錄 role="GRD" 與 actor_id="bob" 以及 diff
    And row.status 變為 "graded"
```

---

## 4) Auction — `auction.html`（拍賣台）

### Purpose

大螢幕輪播展示 `graded` 批次，支援快捷鍵與條碼模式，並可對批次做 Mark Sold / Return 等操作（操作需標記 Operator ID）。

### Main UI

* Header / Overlay：`Auction ID` （Operator ID，text input, optional but required for status changes）
* Fullscreen Carousel（每張卡為一個 batch）
* Controls：Space/→/← (next/prev)、P (pause)、B (barcode mode)、Mark Sold、Mark Returned
* Mini-console：顯示當前 batch index / total、current operator

### User Flow

1. 開啟頁面 → `Auction ID`（可預設） → 頁面載入 `MockDB.getRows({status:'graded'})`
2. 使用快捷鍵切換或自動輪播
3. 若要標記成交 / 退貨，需輸入 `Auction ID` → 按 Mark Sold / Mark Returned → 更新 row (`updateRow(..., {status:'sold'|'returned', updated_by:"AUC:<ID>"})`) 並 append log

### Data / MockDB

* `updateRow(row_id, {status, sold_price?, updated_by:"AUC:<ID>"})`
* `appendLog({role:'AUC', actor_id:'<ID>', action:'mark_sold'|'mark_return', row_id, ts})`

### Validation & UX

* 若未填 Auction ID，禁止做狀態更新（UI 顯示提示）。
* 條碼模式大字體顯示 `batch_id` 並可複製。

### Acceptance Criteria (Gherkin)

```gherkin
Feature: Auction 大螢幕輪播與快捷鍵
  Scenario: 拍賣台切換下一筆並標記成交
    Given 系統有至少一筆 status = "graded"
    And 我在 auction.html 輸入 Auction ID = "auc01"
    When 我按 Space 兩次切換到某筆並按 Mark Sold
    Then 該 row 的 updated_by = "AUC:auc01"
    And MockDB.appendLog() 包含 role="AUC" 與 actor_id="auc01"
    And row.status 變為 "sold"
```

---

## 5) Buyer — `buyer.html`

### Purpose

買家端查詢拍賣品（graded/auctioned/sold），提供篩選、卡片列表與詳細 modal；模擬的買家行為（加入 watchlist、詢價）需要 `Buyer ID` 標示在 log 中。

### Main UI

* Header：`Buyer ID` （text input, optional）
* Filter Bar：product_id, final_grade, date range, keyword
* Card List：item card（thumbnail, final_grade, start_price, boxes, source）
* Detail Modal：全部欄位、history（簡略）、mock image
* Actions：Add to Watchlist、Request Quote（兩項操作會產生 log 並帶 actor_id）

### User Flow

1. 填寫 Buyer ID（可選）→ 篩選列表 → 點開 detail → 發起詢價或加入 watchlist → 產生 log：`appendLog({role:'BUY', actor_id:'<ID>', action:'watch'|'inquiry', row_id, ts})`

### Data / MockDB

* watch/inquiry 存為 log 或暫存資料（`MockDB.appendLog()`）

### Validation & UX

* 在模擬買家操作時，如果 Buyer ID 未填，提示建議填寫以便在 log 追蹤（但可允許匿名 mock 操作）。

### Acceptance Criteria (Gherkin)

```gherkin
Feature: Buyer 查詢與詳細 modal
  Scenario: Buyer 使用篩選並發出詢價
    Given 系統有多筆 graded 或 auctioned 的資料
    And 我在 buyer.html 輸入 Buyer ID = "buyer01"
    When 我篩選 product_id = 101 並對其中一筆發出詢價
    Then MockDB.appendLog() 包含 role="BUY" 與 actor_id="buyer01" 與 action="inquiry"
```

---

## 6) Dashboard (GM) — `dashboard.html`

### Purpose

總經理儀表板，顯示 KPI（進場量、特級比例、平均價、退貨率）、商品分布與 recent batches。所有匯出或報表操作必須記錄 `GM ID`。

### Main UI

* Header：`GM ID`（text input, optional but required for export/report actions）
* KPI Row：進場量、特級比例、平均價、退貨率
* Charts：商品分布、批次趨勢
* Recent Batches Table（快速連結）
* Export / Filters / Time range

### User Flow

1. 打開頁面 → 選時間範圍 → KPI 與 Charts 更新
2. 點 Export → 若有 `GM ID` 則允許並 `MockDB.appendLog({role:'GM', actor_id:'<ID>', action:'export', filters, ts})`，否則提示填寫

### Data / MockDB

* KPI 計算：client-side based on `MockDB.getRows(filters)`
* Export triggers `MockDB.exportCsv()` + `appendLog({role:'GM', actor_id:'<ID>', action:'export'})`

### Validation & UX

* Export / Reset 等破壞性操作需 Confirm。
* 若無資料，KPI 顯示 N/A。

### Acceptance Criteria (Gherkin)

```gherkin
Feature: Dashboard 顯示 KPI 與匯出紀錄
  Scenario: GM 下載 CSV 並記錄 actor
    Given MockDB 有資料
    And 我在 dashboard.html 輸入 GM ID = "gm01"
    When 我按 Export CSV
    Then MockDB.exportCsv() 被呼叫
    And MockDB.appendLog() 包含 role="GM" 與 actor_id="gm01" 並 action="export"
```

---

## 7) Index / Init — `index.html` / `init.html`

### Purpose

專案入口頁，快速導向角色頁面並提供資料工具（Download / Reset / Seed）。

### Main UI

* Global Default ID（optional）：當選擇角色時自動填入各頁的 User ID field（可覆寫）
* Role Buttons
* Data Tools：Download data.csv、Reset demo、Seed from data.csv
* Info：last seed time、localStorage usage

### Data / MockDB

* `reset()` / `initFromCSV()` / `exportCsv()`，且每次操作若有 actor（來自 Default ID 或由使用者輸入）則 append log。

### Acceptance Criteria (Gherkin)

```gherkin
Feature: Index 提供資料工具與入口
  Scenario: Reset 與 Export 記錄 actor
    Given 我在 index.html 設定 Default ID = "dev01"
    When 我按 Reset 並 Confirm
    Then MockDB.reset() 被執行 並 MockDB.appendLog() 記錄 role="GM" 或 "DEV" 與 actor_id="dev01" 與 action="reset"
    When 我按 Download data.csv
    Then MockDB.exportCsv() 被呼叫 並 appendLog() 包含 actor_id 如果有提供
```

---

# Logging 規則（必讀）

每次資料變更或重要操作需呼 `MockDB.appendLog()` 並至少包含：

```json
{
  "log_id": "l-20251208-0001",
  "role": "TLY",
  "actor_id": "amy",
  "action": "submit_and_trigger_ai",
  "row_id": "r-20251208-0002",
  "diff": { /* optional */ },
  "ts": "2025-12-08T08:35:00+08:00"
}
```

* 所有 log 必要欄位：`log_id, role, actor_id, action, ts`。其餘欄位視情況補充。

---

# Acceptance Criteria（整體與安全/非功能註記）

* 每一個 create/update 操作都必須產生或更新 `created_by` / `updated_by` 欄，格式為 `ROLE:ID`，且 `MockDB.appendLog()` 中必含相同的 `role` + `actor_id`。
* 所有 timestamp 必為合法 ISO 8601 並以 +08:00 為時區。
* Tally Submit 必同步產生 AI 建議並寫入 `ai_suggestions`，且由 Tally 的 actor_id 觸發並在 log 中被記錄。
* 單人 Demo：不處理並發與 race condition。UI 可假設操作人是唯一使用者。

---

# Implementation Notes & Developer Tips

* 在每頁將 `User ID` 放在顯眼位置（header），並在整個頁面操作時自動帶入 API 請求。若使用 Index 的 Default ID，頁面載入時可自動填入且可覆寫。
* 建議在 `MockDB.appendCsvRow()` 內自動產生 `row_id`（e.g., `r-{timestamp}-{rand4}`）並填入 `created_at` / `updated_at`。
* AI writeback：`ai_suggestions` 欄為 JSON，內含 `ai_generated_at` 與 `ai_generated_by`（建議寫為 `TLY:amy`，代表誰觸發 AI），同時 `updated_by` 可記 `TLY:amy`。
* Log UI：在每筆 batch detail 顯示 log history（做 demo 說明誰做了什麼）。

