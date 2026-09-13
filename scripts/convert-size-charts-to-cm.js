// One-time conversion. Keep the snapshot: it prevents repeat conversions and
// provides the original records for recovery. Run without --apply to preview.
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
require("dotenv").config({ path: path.join(__dirname, "../.env"), quiet: true });
const { supabaseAdmin } = require("../src/config/supabase");
const snapshotPath = path.join(__dirname, "../supabase/backups/size-charts-before-cm.json");

function convertRows(chart) {
  return chart.rows.map((row) => {
    const result = { ...row };
    for (const column of chart.columns.slice(1)) {
      if (column.key === "size") continue;
      const value = row[column.key];
      if (value == null || String(value).trim() === "") continue;
      const number = Number(value);
      if (!Number.isFinite(number)) throw new Error(`Non-numeric measurement in ${chart.name}: ${column.key}`);
      const cm = Number((number * 2.54).toFixed(2));
      result[column.key] = typeof value === "string" ? String(cm) : cm;
    }
    return result;
  });
}

async function main() {
  const { data: current, error } = await supabaseAdmin.from("size_chart_templates").select("*");
  if (error) throw error;
  if (!fs.existsSync(snapshotPath)) {
    fs.mkdirSync(path.dirname(snapshotPath), { recursive: true });
    fs.writeFileSync(snapshotPath, JSON.stringify(current, null, 2), { flag: "wx" });
  }
  const original = JSON.parse(fs.readFileSync(snapshotPath, "utf8"));
  const plan = original.map((chart) => {
    const live = current.find((entry) => entry.id === chart.id);
    assert.ok(live, `Missing chart: ${chart.name}`);
    const rows = convertRows(chart);
    const alreadyConverted = JSON.stringify(live.rows) === JSON.stringify(rows);
    if (!alreadyConverted) {
      assert.deepEqual(live.rows, chart.rows, `Measurements changed since backup: ${chart.name}`);
      assert.deepEqual(live.columns, chart.columns, `Columns changed since backup: ${chart.name}`);
    }
    return { chart, live, rows, alreadyConverted };
  });
  for (const { chart, live, rows, alreadyConverted } of plan) {
    if (alreadyConverted) { console.log(`Already converted: ${chart.name}`); continue; }
    if (!process.argv.includes("--apply")) { console.log(`Convert: ${chart.name} (${rows.length} sizes)`); continue; }
    const { data, error: writeError } = await supabaseAdmin.from("size_chart_templates")
      .update({ rows, updated_at: new Date().toISOString() })
      .eq("id", chart.id).eq("updated_at", live.updated_at).select("*").single();
    if (writeError) throw writeError;
    assert.deepEqual(data.rows, rows);
    assert.deepEqual(data.columns, chart.columns);
    assert.deepEqual(data.rows.map((row) => row.size), chart.rows.map((row) => row.size));
    console.log(`Converted and verified: ${chart.name} (${rows.length} sizes)`);
  }
}

if (require.main === module) main().catch((error) => { console.error(error.message); process.exitCode = 1; });
module.exports = { convertRows };
