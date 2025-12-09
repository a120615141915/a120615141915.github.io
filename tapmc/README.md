# 拍賣系統 MVP 前端 Demo

本專案提供多角色前端頁面與最小資料流程示意，包含司機、理貨員、裁價員、拍賣台、買家查詢與總經理儀表板。所有頁面為純前端 HTML/CSS/JS，可直接以瀏覽器開啟。`storage.js` 內含 localStorage 模擬資料庫，`data.csv` 為預載的 10 筆範例資料。

## 角色與頁面
- 司機（`driver.html`）：批次多品項登錄，來源與 ETA，回填進場時段。送出寫入 CSV 模擬庫。
- 理貨員（`tally.html`）：先看貨品總表，搜尋/點選批次帶入表單，影像上傳與 AI 推斷可編輯，送出寫入 CSV。
- 裁價員（`grader.html`）：貨品總表選批次後，依 `product_id` 動態生成分級欄位（蘋果/高麗菜/筊白筍 schema），Log 紀錄編輯，送出寫入 CSV。
- 拍賣台（`auction.html`）：大螢幕批次展示，顯示關鍵參數、品項、品級、起拍價，支援快捷鍵/條碼切換。
- 買家（`buyer.html`）：拍賣預覽與查詢，品項/品級/日期篩選，卡片列表、詳細 modal，模擬即時刷新。
- 總經理儀表板（`dashboard.html`）：進場量、特級比例、平均價、退貨率、商品分佈與批次摘要。
- 首頁（`index.html`）/簡化入口（`init.html`）：角色按鈕導引至各頁。

## 動態分級 Schema（MVP 品項）
- 高麗菜（201）：`compactness`, `avg_weight`, `leaf_condition`, `trim_status`, `defects`
- 蘋果（101）：`brix`, `color_coverage`, `size_count`, `russeting`, `crispness_score`
- 筊白筍（305）：`flesh_color`, `black_heart`, `shell_status`, `fibrosity`, `length_cm`

## 資料流與儲存（Mock）
- 本地 CSV：`data.csv` 提供 10 筆初始資料；`storage.js` 的 `MockDB` 會在 localStorage 中維護同名 CSV 文本。
- 讀取：`MockDB.getRows()` 解析 CSV 為物件列，供總表/清單顯示。
- 寫入：各頁操作呼叫 `MockDB.appendCsvRow()` 追加一行，欄位包含 `batch_id, product_id, item, final_grade, boxes, price, source, quality_data(JSON), note, updated_at`。
- 匯出：首頁 `index.html` 提供「下載 data.csv」按鈕，透過 `MockDB.exportCsv()` 將 localStorage 中的最新內容另存檔案。

## 使用方式
1) 瀏覽器開啟 `index.html`（或 `init.html`）選擇角色頁。
2) 在各頁進行操作（送出/建檔/裁價等），資料會寫入 localStorage 內的 CSV 模擬庫。
3) 回首頁下載最新 `data.csv`；如需重置，清空瀏覽器 localStorage 再重新載入頁面。

## 顏色與 UI 提示
- 下拉選單/輸入框採深色背景以提高辨識度，配合各頁主題色。
- 必填即時驗證、toast 提示、Log 紀錄、快捷鍵（拍賣台）等皆內建於前端。
