#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const cliPath = path.resolve(__dirname, "..", "dist", "cjs", "esp-partition-table.cjs");

if (!fs.existsSync(cliPath)) {
  console.error("Build output not found. Run `npm run build` first.");
  process.exit(1);
}

require(cliPath).main(process.argv.slice(2));
