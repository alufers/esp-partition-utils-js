import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { encodePartitionTable, fromCSV } from "../src/index.js";
import {
  canonicalize,
  listFixtureCsvFiles,
  runPythonBinToCsv,
  runPythonCsvToBin,
} from "./helpers.js";

describe("encodePartitionTable", () => {
  it("encodes fixture tables that python decodes identically", async () => {
    const csvFiles = listFixtureCsvFiles();
    expect(csvFiles.length).toBeGreaterThanOrEqual(12);

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "esp-partition-tests-"));

    for (const csvFile of csvFiles) {
      const csv = fs.readFileSync(csvFile, "utf8");
      const partitions = fromCSV(csv);
      const encoded = encodePartitionTable(partitions, {});

      const outBin = path.join(tempDir, `${path.basename(csvFile, ".csv")}.bin`);
      fs.writeFileSync(outBin, encoded);

      const pyCsv = await runPythonBinToCsv(outBin);
      const pyPartitions = fromCSV(pyCsv);
      expect(canonicalize(pyPartitions)).toEqual(canonicalize(partitions));
    }
  });

  it("matches python-generated binaries after decode", async () => {
    const csvFiles = listFixtureCsvFiles();
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "esp-partition-tests-py-"));

    for (const csvFile of csvFiles) {
      const oursBin = path.join(tempDir, `${path.basename(csvFile, ".csv")}.ours.bin`);
      const pyBin = path.join(tempDir, `${path.basename(csvFile, ".csv")}.py.bin`);

      const partitions = fromCSV(fs.readFileSync(csvFile, "utf8"));
      fs.writeFileSync(oursBin, encodePartitionTable(partitions, {}));
      await runPythonCsvToBin(csvFile, pyBin);

      const oursCsv = await runPythonBinToCsv(oursBin);
      const pyCsv = await runPythonBinToCsv(pyBin);
      expect(canonicalize(fromCSV(oursCsv))).toEqual(canonicalize(fromCSV(pyCsv)));
    }
  });

  it("enforces flash size when specified", () => {
    const bigCsv = fs.readFileSync(path.join(process.cwd(), "testdata", "case10.csv"), "utf8");
    const partitions = fromCSV(bigCsv);
    expect(() => encodePartitionTable(partitions, { flashSizeMb: 1 })).toThrow();
  });
});
