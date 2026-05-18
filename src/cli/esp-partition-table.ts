import * as fs from "node:fs";
import * as path from "node:path";

import { decodePartitionTable } from "../decoder.js";
import { encodePartitionTable } from "../encoder.js";
import { fromCSVWithOptions, toCSV } from "../csv.js";
import type { EncodePartitionTableOptions } from "../types.js";

function usage(): string {
  return [
    "Usage: esp-partition-table [options] <input> [output]",
    "",
    "If input is CSV, output is BIN. If input is BIN, output is CSV.",
    "",
    "Options:",
    "  --flash-size <MB>                1|2|4|8|16|32|64|128",
    "  --disable-md5sum",
    "  --no-verify",
    "  --offset <value>                 default 0x8000",
    "  --primary-bootloader-offset <v>",
    "  --recovery-bootloader-offset <v>",
    "  --secure [v1|v2]                 default v1 when omitted value",
    "  -h, --help",
  ].join("\n");
}

function parseNumber(text: string): number {
  const parsed = Number.parseInt(text, 0);
  if (Number.isNaN(parsed)) {
    throw new Error(`Invalid number '${text}'`);
  }
  return parsed;
}

function parseArgs(argv: string[]): { options: EncodePartitionTableOptions; positional: string[] } {
  const options: EncodePartitionTableOptions = {};
  const positional: string[] = [];

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("-")) {
      positional.push(arg);
      continue;
    }

    if (arg === "-h" || arg === "--help") {
      throw new Error("__HELP__");
    }
    if (arg === "--disable-md5sum") {
      options.disableMd5sum = true;
      continue;
    }
    if (arg === "--no-verify") {
      options.noVerify = true;
      continue;
    }
    if (arg === "--flash-size") {
      i += 1;
      options.flashSizeMb = parseNumber(argv[i]) as EncodePartitionTableOptions["flashSizeMb"];
      continue;
    }
    if (arg === "--offset" || arg === "-o") {
      i += 1;
      options.offset = parseNumber(argv[i]);
      continue;
    }
    if (arg === "--primary-bootloader-offset") {
      i += 1;
      options.primaryBootloaderOffset = parseNumber(argv[i]);
      continue;
    }
    if (arg === "--recovery-bootloader-offset") {
      i += 1;
      options.recoveryBootloaderOffset = parseNumber(argv[i]);
      continue;
    }
    if (arg === "--secure") {
      const next = argv[i + 1];
      if (!next || next.startsWith("-")) {
        options.secure = "v1";
      } else {
        i += 1;
        if (next !== "v1" && next !== "v2") {
          throw new Error(`Invalid --secure value '${next}'`);
        }
        options.secure = next;
      }
      continue;
    }

    throw new Error(`Unknown option '${arg}'`);
  }

  return { options, positional };
}

function isBinary(input: Uint8Array): boolean {
  return input.length >= 2 && input[0] === 0xaa && input[1] === 0x50;
}

export function main(args: string[]): void {
  try {
    const { options, positional } = parseArgs(args);
    const inputPath = positional[0];
    const outputPath = positional[1] ?? "-";

    if (!inputPath) {
      process.stderr.write(`${usage()}\n`);
      process.exit(1);
    }

    const absoluteInput = path.resolve(process.cwd(), inputPath);
    const inputData = fs.readFileSync(absoluteInput);

    if (isBinary(inputData)) {
      const partitions = decodePartitionTable(inputData);
      const csv = toCSV(partitions);
      if (outputPath === "-") {
        process.stdout.write(csv);
      } else {
        fs.writeFileSync(path.resolve(process.cwd(), outputPath), csv, "utf8");
      }
      return;
    }

    const text = inputData.toString("utf8");
    const partitions = fromCSVWithOptions(text, options);
    const binary = encodePartitionTable(partitions, options);
    if (outputPath === "-") {
      process.stdout.write(Buffer.from(binary));
    } else {
      fs.writeFileSync(path.resolve(process.cwd(), outputPath), binary);
    }
  } catch (error) {
    if (error instanceof Error && error.message === "__HELP__") {
      process.stdout.write(`${usage()}\n`);
      process.exit(0);
    }
    process.stderr.write(`${(error as Error).message}\n`);
    process.exit(2);
  }
}
