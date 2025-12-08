// Mock CSV persistence utility (localStorage-backed). Use exportCsv() to download.
const CSV_KEY = 'mockCsv';
const DEFAULT_CSV = `batch_id,product_id,item,final_grade,boxes,price,source,quality_data,note,updated_at
A-201,201,"高麗菜","A",18,"NT$460","FA-0921","{""compactness"":""firm"",""avg_weight"":2.1,""leaf_condition"":""excellent""}","初始資料","2024-08-18T09:10:00Z"
B-101,101,"蘋果","A",20,"NT$720","FA-0921","{""brix"":14.5,""color_coverage"":90,""size_count"":""5A""}","初始資料","2024-08-18T10:05:00Z"
C-305,305,"筊白筍","B",15,"NT$390","FA-1102","{""length_cm"":20,""flesh_color"":""white"",""fibrosity"":""tender""}","初始資料","2024-08-18T10:40:00Z"
D-201,201,"高麗菜","A",16,"NT$455","FA-1102","{""compactness"":""firm"",""trim_status"":""clean""}","初始資料","2024-08-18T11:05:00Z"
E-101,101,"蘋果","B",18,"NT$650","FA-2201","{""brix"":13.8,""color_coverage"":80,""size_count"":""6A""}","初始資料","2024-08-18T11:30:00Z"
F-305,305,"筊白筍","A",12,"NT$430","FA-2201","{""shell_status"":""shelled"",""length_cm"":19}","初始資料","2024-08-18T11:55:00Z"
G-201,201,"高麗菜","C",14,"NT$320","FA-3301","{""compactness"":""loose"",""defects"":[""裂痕""]}","初始資料","2024-08-18T12:10:00Z"
H-101,101,"蘋果","A",24,"NT$740","FA-3301","{""brix"":15.0,"""color_coverage"":92,""size_count"":""5A""}","初始資料","2024-08-18T12:40:00Z"
I-305,305,"筊白筍","B",10,"NT$360","FA-4401","{""fibrosity"":""normal"",""length_cm"":17}","初始資料","2024-08-18T13:00:00Z"
J-101,101,"蘋果","C",14,"NT$540","FA-5501","{""russeting"":true,""brix"":12.8}","初始資料","2024-08-18T13:20:00Z"`;

function ensureCsv() {
  if (!localStorage.getItem(CSV_KEY)) {
    localStorage.setItem(CSV_KEY, DEFAULT_CSV);
  }
}

function toCsvValue(val) {
  const v = val === undefined || val === null ? '' : String(val);
  return `"${v.replace(/"/g, '""')}"`;
}

function appendCsvRow(row) {
  ensureCsv();
  const now = new Date().toISOString();
  const payload = {
    batch_id: row.batch_id || ('TMP-' + now.slice(11,19).replace(/:/g,'')),
    product_id: row.product_id || '',
    item: row.item || '',
    final_grade: row.final_grade || '',
    boxes: row.boxes || '',
    price: row.price || '',
    source: row.source || '',
    quality_data: typeof row.quality_data === 'string' ? row.quality_data : JSON.stringify(row.quality_data || {}),
    note: row.note || '',
    updated_at: now
  };
  const line = [
    payload.batch_id,
    payload.product_id,
    payload.item,
    payload.final_grade,
    payload.boxes,
    payload.price,
    payload.source,
    payload.quality_data,
    payload.note,
    payload.updated_at
  ].map(toCsvValue).join(',');
  const csv = localStorage.getItem(CSV_KEY).trim() + '\n' + line;
  localStorage.setItem(CSV_KEY, csv);
}

function exportCsv() {
  ensureCsv();
  const blob = new Blob([localStorage.getItem(CSV_KEY)], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'data.csv';
  a.click();
  URL.revokeObjectURL(url);
}

function getCsvText() {
  ensureCsv();
  return localStorage.getItem(CSV_KEY);
}

function splitCsvLine(line) {
  const cells = [];
  let cur = '', inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; continue; }
    if (ch === '"') { inQuotes = !inQuotes; continue; }
    if (ch === ',' && !inQuotes) { cells.push(cur); cur = ''; continue; }
    cur += ch;
  }
  cells.push(cur);
  return cells;
}

function getRows() {
  ensureCsv();
  const text = localStorage.getItem(CSV_KEY) || '';
  const lines = text.trim().split('\n').filter(Boolean);
  if (lines.length < 2) return [];
  const headers = splitCsvLine(lines[0]);
  return lines.slice(1).map(line => {
    const values = splitCsvLine(line);
    const obj = {};
    headers.forEach((h, idx) => obj[h] = values[idx] || '');
    return obj;
  });
}

window.MockDB = { ensureCsv, appendCsvRow, exportCsv, getCsvText, getRows };
ensureCsv();
