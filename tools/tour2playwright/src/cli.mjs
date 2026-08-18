#!/usr/bin/env node
// tour2playwright CLI
//
//   node src/cli.mjs generate <export.json>   → write Playwright specs
//   node src/cli.mjs manual   <export.json>   → write Markdown manuals
//   node src/cli.mjs build    <export.json>   → generate → run tests → manuals
//
// (Prefer the npm scripts: `npm run gen -- <f>`, `npm run manual -- <f>`,
//  `npm run build -- <f>`.)
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import "./env.mjs";
import { loadTours } from "./loadTours.mjs";
import { genSpec } from "./genSpec.mjs";
import { genManuals } from "./genManual.mjs";
import { SPECS_DIR, MANUALS_DIR, GENERATED_DIR } from "./names.mjs";

function usage(msg) {
  if (msg) console.error(`Error: ${msg}\n`);
  console.error(
    [
      "Usage:",
      "  node src/cli.mjs generate <export.json>   Write Playwright specs",
      "  node src/cli.mjs manual   <export.json>   Write Markdown manuals",
      "  node src/cli.mjs build    <export.json>   generate → test → manuals",
    ].join("\n")
  );
  process.exit(msg ? 1 : 0);
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function doGenerate(exportFile) {
  const { tours } = loadTours(exportFile);
  ensureDir(SPECS_DIR);
  const report = [];
  for (const tour of tours) {
    const { filename, source, todos } = genSpec(tour);
    const outPath = path.join(SPECS_DIR, filename);
    fs.writeFileSync(outPath, source, "utf8");
    console.log(`  spec  ${outPath}  (${tour.steps.length} steps)`);
    if (todos.length) {
      report.push(`## ${tour.name}  (${filename})`);
      for (const t of todos) report.push(`- step ${t.step}: ${t.msg}`);
      report.push("");
    }
  }
  // Surface everything that needs a human in one place.
  const reportPath = path.join(GENERATED_DIR, "REVIEW.md");
  if (report.length) {
    ensureDir(GENERATED_DIR);
    fs.writeFileSync(
      reportPath,
      "# tour2playwright — items needing review\n\n" + report.join("\n"),
      "utf8"
    );
    console.log(`\n  ${report.filter((l) => l.startsWith("- ")).length} item(s) need review → ${reportPath}`);
  } else {
    // Clear a stale report from a previous run.
    if (fs.existsSync(reportPath)) fs.rmSync(reportPath);
  }
  return tours;
}

function doManual(exportFile) {
  const { tours } = loadTours(exportFile);
  ensureDir(MANUALS_DIR);
  for (const tour of tours) {
    const files = genManuals(tour);
    for (const { filename, content } of files) {
      const outPath = path.join(MANUALS_DIR, filename);
      fs.writeFileSync(outPath, content, "utf8");
      console.log(`  manual  ${outPath}`);
    }
  }
}

function runPlaywright() {
  console.log("\nRunning Playwright (this drives the live Odoo instance)…\n");
  const res = spawnSync("npx", ["playwright", "test"], {
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (res.status !== 0) {
    console.error(
      "\nPlaywright run did not fully pass. Screenshots for passing steps were still captured; " +
        "manuals will use whatever exists. Check generated/report for details."
    );
  }
  return res.status;
}

function main() {
  const [, , cmd, exportFile] = process.argv;
  if (!cmd || cmd === "-h" || cmd === "--help") return usage();

  if (cmd === "generate" || cmd === "gen") {
    if (!exportFile) return usage("missing <export.json>");
    console.log(`Generating specs from ${exportFile}`);
    doGenerate(exportFile);
    console.log("\nNext: `npm test` to run them and capture screenshots.");
  } else if (cmd === "manual") {
    if (!exportFile) return usage("missing <export.json>");
    console.log(`Generating manuals from ${exportFile}`);
    doManual(exportFile);
  } else if (cmd === "build") {
    if (!exportFile) return usage("missing <export.json>");
    console.log(`Building specs from ${exportFile}`);
    doGenerate(exportFile);
    runPlaywright();
    console.log("\nGenerating manuals…");
    doManual(exportFile);
    console.log("\nDone. See generated/manuals/ and generated/report/.");
  } else {
    return usage(`unknown command "${cmd}"`);
  }
}

main();
