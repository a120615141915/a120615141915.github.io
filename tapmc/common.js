(function () {
  const STORAGE_KEYS = {
    rows: 'tapmc_rows',
    logs: 'tapmc_logs',
    rowsCsv: 'tapmc_rows_csv',
    logsCsv: 'tapmc_logs_csv',
    seededAt: 'tapmc_seeded_at',
    defaultId: 'tapmc_default_id'
  };

  const DEFAULT_SEED_CSV = `
row_id,trip_id,batch_id,product_id,item,source,producer,boxes,quantity,price,currency,quality_data,ai_suggestions,final_grade,start_price,status,note,created_at,created_by,updated_at,updated_by
r-20251208-0001,trip-20251208-0830-DRV001,20251208083000-DRV,101,蘋果,BigTreeFarm,張老闆,5,5,0,TWD,{},, , ,created,批次1,2025-12-08T08:30:00+08:00,DRV:driver01,2025-12-08T08:30:00+08:00,DRV:driver01
r-20251208-0002,trip-20251208-0830-DRV001,20251208083005-DRV,101,蘋果,BigTreeFarm,張老闆,4,4,0,TWD,{},, , ,created,批次2,2025-12-08T08:30:05+08:00,DRV:driver01,2025-12-08T08:30:05+08:00,DRV:driver01
r-20251208-0003,trip-20251208-0830-DRV001,20251208083010-DRV,201,高麗菜,ColdRidgeFarm,李老闆,5,5,0,TWD,{},, , ,created,批次3,2025-12-08T08:30:10+08:00,DRV:driver01,2025-12-08T08:30:10+08:00,DRV:driver01
r-20251208-0004,trip-20251208-0830-DRV001,20251208083015-DRV,101,蘋果,GreenValley,吳老闆,8,8,0,TWD,{},, , ,created,批次4,2025-12-08T08:30:15+08:00,DRV:driver01,2025-12-08T08:30:15+08:00,DRV:driver01
r-20251208-0005,trip-20251208-0830-DRV001,20251208083020-DRV,201,高麗菜,LakeSideFarm,何老闆,5,5,0,TWD,{},, , ,created,批次5,2025-12-08T08:30:20+08:00,DRV:driver01,2025-12-08T08:30:20+08:00,DRV:driver01
r-20251208-0006,trip-20251208-0830-DRV001,20251208083025-DRV,201,高麗菜,BigTreeFarm,張老闆,12,12,0,TWD,{},, , ,created,批次6,2025-12-08T08:30:25+08:00,DRV:driver01,2025-12-08T08:30:25+08:00,DRV:driver01
`.trim();

  // Product schema per spec
  const PRODUCT_SCHEMAS = {
    '101': {
      name: '蘋果',
      fields: {
        brix: { label: '糖度 (°Brix)', type: 'number', min: 0, max: 20, step: 0.1 },
        color_coverage: { label: '著色覆蓋 (%)', type: 'number', min: 0, max: 100, step: 1 },
        size_count: { label: '顆粒數/箱', type: 'integer', min: 1, max: 100, step: 1 },
        russeting: { label: '果銹程度', type: 'enum', options: ['none', 'light', 'moderate', 'heavy'] },
        crispness_score: { label: '脆度評分 (0-10)', type: 'number', min: 0, max: 10, step: 0.1 }
      }
    },
    '201': {
      name: '高麗菜',
      fields: {
        compactness: { label: '結球緊實度 (%)', type: 'number', min: 0, max: 100, step: 1 },
        avg_weight: { label: '平均重量 (g)', type: 'number', min: 200, max: 2000, step: 10 },
        leaf_condition: { label: '葉況', type: 'enum', options: ['good', 'damaged', 'wilted'] },
        trim_status: { label: '修葉狀態', type: 'enum', options: ['trimmed', 'untrimmed'] },
        defects: { label: '瑕疵顆數', type: 'integer', min: 0, max: 20, step: 1 }
      }
    },
    '305': {
      name: '筊白筍',
      fields: {
        flesh_color: { label: '肉色', type: 'enum', options: ['white', 'light_brown', 'brown'] },
        black_heart: { label: '黑心', type: 'boolean' },
        shell_status: { label: '外皮完整度', type: 'enum', options: ['intact', 'cracked'] },
        fibrosity: { label: '纖維感 (0-10)', type: 'number', min: 0, max: 10, step: 0.1 },
        length_cm: { label: '長度 (cm)', type: 'number', min: 5, max: 50, step: 0.5 }
      }
    }
  };

  function toOffsetIso(date = new Date(), offsetMinutes = 480) {
    const utc = date.getTime() + date.getTimezoneOffset() * 60000;
    const target = new Date(utc + offsetMinutes * 60000);
    const iso = target.toISOString().replace('Z', '');
    const sign = offsetMinutes >= 0 ? '+' : '-';
    const abs = Math.abs(offsetMinutes);
    const hh = String(Math.floor(abs / 60)).padStart(2, '0');
    const mm = String(abs % 60).padStart(2, '0');
    return `${iso}${sign}${hh}:${mm}`;
  }

  function timestamp14(date = new Date(), offsetMinutes = 480) {
    const pad = (n, len = 2) => String(n).padStart(len, '0');
    const utc = date.getTime() + date.getTimezoneOffset() * 60000;
    const target = new Date(utc + offsetMinutes * 60000);
    const y = target.getFullYear();
    const m = pad(target.getMonth() + 1);
    const d = pad(target.getDate());
    const hh = pad(target.getHours());
    const mm = pad(target.getMinutes());
    const ss = pad(target.getSeconds());
    return `${y}${m}${d}${hh}${mm}${ss}`;
  }

  function parseCsv(text) {
    if (!text) return [];
    const lines = text.trim().split(/\r?\n/).filter(Boolean);
    if (!lines.length) return [];
    const header = lines.shift().split(',');
    return lines.map((line) => {
      const cells = line.split(',').map((c) => c.trim());
      const row = {};
      header.forEach((h, i) => { row[h] = cells[i] ?? ''; });
      row.boxes = Number(row.boxes || 0);
      row.quantity = Number(row.quantity || 0);
      row.price = Number(row.price || 0);
      try { row.quality_data = row.quality_data ? JSON.parse(row.quality_data) : {}; } catch { row.quality_data = {}; }
      try { row.ai_suggestions = row.ai_suggestions ? JSON.parse(row.ai_suggestions) : null; } catch { row.ai_suggestions = null; }
      return row;
    });
  }

  const LOG_HEADERS = ['log_id', 'role', 'actor_id', 'action', 'row_id', 'diff', 'ts'];

  function parseLogsCsv(text) {
    if (!text) return [];
    const lines = text.trim().split(/\r?\n/).filter(Boolean);
    if (!lines.length) return [];
    lines.shift(); // drop header
    return lines.map((line) => {
      const cells = line.split(',').map((c) => c.trim());
      const [log_id, role, actor_id, action, row_id, diff, ts] = cells;
      return {
        log_id,
        role,
        actor_id,
        action,
        row_id,
        diff: diff ? JSON.parse(diff) : undefined,
        ts
      };
    });
  }

  function stringifyLogsCsv(logs) {
    const lines = logs.map((l) => [
      l.log_id || '',
      l.role || '',
      l.actor_id || '',
      l.action || '',
      l.row_id || '',
      l.diff ? JSON.stringify(l.diff) : '',
      l.ts || ''
    ].join(','));
    return [LOG_HEADERS.join(','), ...lines].join('\n');
  }

  function stringifyCsv(rows) {
    const header = ['row_id', 'trip_id', 'batch_id', 'product_id', 'item', 'source', 'producer', 'boxes', 'quantity', 'price', 'currency', 'quality_data', 'ai_suggestions', 'final_grade', 'start_price', 'status', 'note', 'created_at', 'created_by', 'updated_at', 'updated_by'];
    const lines = rows.map((row) => {
      return header.map((key) => {
        if (key === 'quality_data' || key === 'ai_suggestions') {
          return JSON.stringify(row[key] ?? {});
        }
        return row[key] ?? '';
      }).join(',');
    });
    return [header.join(','), ...lines].join('\n');
  }

  function loadRows() {
    const rawCsv = localStorage.getItem(STORAGE_KEYS.rowsCsv);
    if (rawCsv) {
      try {
        const parsed = parseCsv(rawCsv);
        if (parsed.length) return parsed;
      } catch {}
    }
    const raw = localStorage.getItem(STORAGE_KEYS.rows);
    if (!raw) return [];
    try { return JSON.parse(raw); } catch { return []; }
  }

  function saveRows(rows) {
    localStorage.setItem(STORAGE_KEYS.rows, JSON.stringify(rows));
    localStorage.setItem(STORAGE_KEYS.rowsCsv, stringifyCsv(rows));
  }

  function loadLogs() {
    const rawCsv = localStorage.getItem(STORAGE_KEYS.logsCsv);
    if (rawCsv) {
      try {
        const parsed = parseLogsCsv(rawCsv);
        if (parsed.length) return parsed;
      } catch {}
    }
    const raw = localStorage.getItem(STORAGE_KEYS.logs);
    if (!raw) return [];
    try { return JSON.parse(raw); } catch { return []; }
  }

  function saveLogs(logs) {
    localStorage.setItem(STORAGE_KEYS.logs, JSON.stringify(logs));
    localStorage.setItem(STORAGE_KEYS.logsCsv, stringifyLogsCsv(logs));
  }

  function genRowId() {
    const ts = timestamp14();
    const rand = Math.floor(Math.random() * 9000 + 1000);
    return `r-${ts}-${rand}`;
  }

  function genBatchId(role, suffixIndex = 0) {
    const base = `${timestamp14()}-${role}`;
    if (suffixIndex > 0) return `${base}-${String(suffixIndex).padStart(2, '0')}`;
    return base;
  }

  function appendLog(logObject) {
    const logs = loadLogs();
    const ts = logObject.ts || toOffsetIso();
    const log = {
      log_id: logObject.log_id || `l-${timestamp14()}-${Math.floor(Math.random() * 9000 + 1000)}`,
      role: logObject.role,
      actor_id: logObject.actor_id,
      action: logObject.action,
      row_id: logObject.row_id,
      diff: logObject.diff,
      ts
    };
    logs.push(log);
    saveLogs(logs);
    return log;
  }

  function ensureSeeded(seedCsv) {
    const rows = loadRows();
    if (rows.length > 0) return rows;
    return initFromCSV(seedCsv || DEFAULT_SEED_CSV);
  }

  function initFromCSV(csvText) {
    const rows = parseCsv(csvText);
    saveRows(rows);
    saveLogs([]);
    localStorage.setItem(STORAGE_KEYS.seededAt, toOffsetIso());
    return rows;
  }

  function appendCsvRow(rowObject) {
    if (!rowObject.created_by) throw new Error('created_by is required');
    const rows = loadRows();
    const row = { ...rowObject };
    row.row_id = row.row_id || genRowId();
    row.batch_id = row.batch_id || genBatchId((row.created_by.split(':')[0]) || 'DRV');
    const now = toOffsetIso();
    row.created_at = row.created_at || now;
    row.updated_at = row.updated_at || now;
    row.updated_by = row.updated_by || row.created_by;
    row.quality_data = row.quality_data || {};
    row.ai_suggestions = row.ai_suggestions || null;
    row.status = row.status || 'created';
    rows.push(row);
    saveRows(rows);
    return row;
  }

  function updateRow(row_id, patch) {
    const rows = loadRows();
    const idx = rows.findIndex((r) => r.row_id === row_id);
    if (idx === -1) throw new Error('Row not found');
    const now = toOffsetIso();
    const updated = {
      ...rows[idx],
      ...patch,
      updated_at: patch.updated_at || now
    };
    rows[idx] = updated;
    saveRows(rows);
    return updated;
  }

  function deleteRow(row_id) {
    const rows = loadRows();
    const idx = rows.findIndex((r) => r.row_id === row_id);
    if (idx === -1) return false;
    rows.splice(idx, 1);
    saveRows(rows);
    return true;
  }

  function getRows(filters = {}) {
    const rows = loadRows();
    return rows.filter((r) => {
      if (filters.status) {
        const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
        if (!statuses.includes(r.status)) return false;
      }
      if (filters.trip_id && r.trip_id !== filters.trip_id) return false;
      if (filters.product_id && String(r.product_id) !== String(filters.product_id)) return false;
      if (filters.source && r.source !== filters.source) return false;
      if (filters.text) {
        const t = filters.text.toLowerCase();
        const hay = `${r.item} ${r.source} ${r.producer} ${r.batch_id}`.toLowerCase();
        if (!hay.includes(t)) return false;
      }
      if (filters.from) {
        const ts = Date.parse(r.created_at);
        if (!isNaN(ts) && ts < Date.parse(filters.from)) return false;
      }
      if (filters.to) {
        const ts = Date.parse(r.created_at);
        if (!isNaN(ts) && ts > Date.parse(filters.to)) return false;
      }
      return true;
    });
  }

  function exportCsv(filename = 'data.csv') {
    const rows = loadRows();
    const csv = stringifyCsv(rows);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    return csv;
  }

  function exportLogsCsv(filename = 'logs.csv') {
    const logs = loadLogs();
    const csv = stringifyLogsCsv(logs);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    return csv;
  }

  function reset(seedCsv = DEFAULT_SEED_CSV) {
    localStorage.removeItem(STORAGE_KEYS.rows);
    localStorage.removeItem(STORAGE_KEYS.logs);
    localStorage.removeItem(STORAGE_KEYS.seededAt);
    return initFromCSV(seedCsv);
  }

  function getTrips() {
    const rows = loadRows();
    const map = {};
    rows.forEach((r) => {
      if (!map[r.trip_id]) map[r.trip_id] = { trip_id: r.trip_id, count: 0, statuses: {} };
      map[r.trip_id].count += 1;
      map[r.trip_id].statuses[r.status] = (map[r.trip_id].statuses[r.status] || 0) + 1;
    });
    return Object.values(map);
  }

  function getLogs(filters = {}) {
    const logs = loadLogs();
    return logs.filter((l) => {
      if (filters.role && l.role !== filters.role) return false;
      if (filters.actor_id && l.actor_id !== filters.actor_id) return false;
      if (filters.row_id && l.row_id !== filters.row_id) return false;
      return true;
    });
  }

  function setDefaultId(id) {
    localStorage.setItem(STORAGE_KEYS.defaultId, id || '');
  }

  function getDefaultId() {
    return localStorage.getItem(STORAGE_KEYS.defaultId) || '';
  }

  function clamp(val, min, max) {
    return Math.min(Math.max(val, min), max);
  }

  function randomFromRange(min, max) {
    return min + Math.random() * (max - min);
  }

  function decideGrade(predictions, productId) {
    let score = 0.5;
    if (productId === '101') {
      score = ((predictions.brix || 0) / 20 + (predictions.crispness_score || 0) / 10 + (predictions.color_coverage || 0) / 100) / 3;
    } else if (productId === '201') {
      score = ((predictions.compactness || 0) / 100 + 1 - (predictions.defects || 0) / 15) / 2;
    } else {
      score = 0.6 - (predictions.black_heart ? 0.3 : 0) + ((predictions.length_cm || 0) / 50) * 0.2;
    }
    if (score >= 0.75) return 'A';
    if (score >= 0.55) return 'B';
    return 'C';
  }

  const MockAI = {
    predict(productId, qualityData = {}, actorTag) {
      const schema = PRODUCT_SCHEMAS[String(productId)] || {};
      const predictions = {};
      const confidences = {};
      if (schema.fields) {
        Object.entries(schema.fields).forEach(([key, meta]) => {
          if (meta.type === 'enum') {
            const choice = meta.options[Math.floor(Math.random() * meta.options.length)];
            predictions[key] = choice;
          } else if (meta.type === 'boolean') {
            predictions[key] = Math.random() > 0.5;
          } else if (meta.type === 'integer') {
            const val = Math.round(randomFromRange(meta.min, meta.max));
            predictions[key] = clamp(val, meta.min, meta.max);
          } else {
            const val = randomFromRange(meta.min, meta.max);
            predictions[key] = Number(clamp(val, meta.min, meta.max).toFixed(2));
          }
          confidences[key] = Number((0.6 + Math.random() * 0.35).toFixed(2));
        });
      }
      const suggested_final_grade = decideGrade(predictions, String(productId));
      const basePrice = productId === '101' ? 1200 : productId === '201' ? 900 : 700;
      const qualityFactor = suggested_final_grade === 'A' ? 1 : suggested_final_grade === 'B' ? 0.85 : 0.7;
      const suggested_start_price = Math.round(basePrice * qualityFactor);
      return {
        model: 'mock-normal-v1',
        predictions,
        confidences,
        suggested_final_grade,
        suggested_start_price,
        ai_generated_at: toOffsetIso(),
        ai_generated_by: actorTag ? `TLY:${actorTag}` : undefined
      };
    }
  };

  function toast(message, tone = 'ok') {
    const el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = `<div style="font-weight:700;margin-bottom:4px;">${message}</div><div class="small">${toOffsetIso()}</div>`;
    el.style.borderColor = tone === 'bad' ? 'rgba(248,113,113,0.6)' : tone === 'warn' ? 'rgba(255,176,32,0.6)' : 'rgba(24,169,153,0.6)';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2600);
  }

  function statusBadge(status) {
    return `<span class="status ${status}">${status}</span>`;
  }

  window.MockDB = {
    ensureSeeded,
    initFromCSV,
    getRows,
    appendCsvRow,
    updateRow,
    deleteRow,
    exportCsv,
    reset,
    getTrips,
    appendLog,
    getLogs,
    setDefaultId,
    getDefaultId,
    exportLogsCsv
  };
  window.MockAI = MockAI;
  window.PRODUCT_SCHEMAS = PRODUCT_SCHEMAS;
  window.tapmcUtils = {
    toOffsetIso,
    timestamp14,
    genBatchId,
    statusBadge,
    toast
  };

  MockDB.ensureSeeded();
})();
