import * as fs from "node:fs";

import { decodePartitionTable, fromCSV, toCSV } from "../src/index.js";
import { canonicalize, listFixtureBinFiles, runPythonBinToCsv } from "./helpers.js";

describe("decodePartitionTable", () => {
  it("matches python output for all fixture binaries", async () => {
    const bins = listFixtureBinFiles();
    expect(bins.length).toBeGreaterThanOrEqual(12);

    for (const binPath of bins) {
      const data = fs.readFileSync(binPath);
      const decoded = decodePartitionTable(data);

      const pyCsv = await runPythonBinToCsv(binPath);
      const pyPartitions = fromCSV(pyCsv);

      expect(canonicalize(decoded)).toEqual(canonicalize(pyPartitions));
    }
  });

  it("roundtrips csv conversion for decoded partitions", async () => {
    const bins = listFixtureBinFiles();

    for (const binPath of bins) {
      const data = fs.readFileSync(binPath);
      const decoded = decodePartitionTable(data);
      const csv = toCSV(decoded);
      const reparsed = fromCSV(csv);
      expect(canonicalize(reparsed)).toEqual(canonicalize(decoded));
    }
  });
});
