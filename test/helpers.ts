import { execFile } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { FLAGS, SUBTYPES, TYPES } from "../src/constants.js";
import type { Partition } from "../src/types.js";

const execFileAsync = promisify(execFile);

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const TESTDATA = path.join(REPO_ROOT, "testdata");
export const PYTHON_TOOL = path.join(REPO_ROOT, "python_original", "gen_esp32part.py");

export async function runPythonBinToCsv(binPath: string): Promise<string> {
  const { stdout } = await execFileAsync("python3", [PYTHON_TOOL, binPath], { cwd: REPO_ROOT });
  return stdout;
}

export async function runPythonCsvToBin(
  csvPath: string,
  outBinPath: string,
  extraArgs: string[] = [],
): Promise<void> {
  await execFileAsync("python3", [PYTHON_TOOL, ...extraArgs, csvPath, outBinPath], {
    cwd: REPO_ROOT,
  });
}

export function listFixtureCsvFiles(): string[] {
  return fs
    .readdirSync(TESTDATA)
    .filter((x) => x.endsWith(".csv"))
    .map((x) => path.join(TESTDATA, x))
    .sort();
}

export function listFixtureBinFiles(): string[] {
  return fs
    .readdirSync(TESTDATA)
    .filter((x) => x.endsWith(".bin"))
    .map((x) => path.join(TESTDATA, x))
    .sort();
}

function typeToNumber(value: string | number): number {
  if (typeof value === "number") return value;
  const mapped = TYPES[value.toLowerCase()];
  if (mapped !== undefined) return mapped;
  return Number.parseInt(value, 0);
}

function subtypeToNumber(type: number, value: string | number): number {
  if (typeof value === "number") return value;
  const mapped = SUBTYPES[type]?.[value.toLowerCase()];
  if (mapped !== undefined) return mapped;
  return Number.parseInt(value, 0);
}

function flagsToWord(flags: Partition["flags"]): number {
  let value = flags.unknown >>> 0;
  if (flags.encrypted) value |= 1 << FLAGS.encrypted;
  if (flags.readonly) value |= 1 << FLAGS.readonly;
  return value >>> 0;
}

export function canonicalize(partitions: Partition[]): Array<Record<string, number | string>> {
  return partitions
    .map((p) => {
      const type = typeToNumber(p.type);
      return {
        name: p.name,
        type,
        subtype: subtypeToNumber(type, p.subtype),
        offset: p.offset ?? -1,
        size: p.size ?? -1,
        flags: flagsToWord(p.flags),
      };
    })
    .sort((a, b) => Number(a.offset) - Number(b.offset));
}
