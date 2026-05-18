import {
  BOOTLOADER_TYPE,
  PARTITION_TABLE_SIZE,
  PARTITION_TABLE_TYPE,
  SUBTYPES,
  TYPE_NAMES,
  TYPES,
} from "./constants.js";
import {
  defaultFlags,
  normalizePartitions,
  parseFlags,
  parseIntLike,
  resolveOptions,
  toPublicPartition,
  verifyPartitions,
} from "./parser-utils.js";
import type { EncodePartitionTableOptions, Partition } from "./types.js";

function parseAddress(field: string, type: number, subtype: number, options: ReturnType<typeof resolveOptions>): number | null {
  if (type === BOOTLOADER_TYPE) {
    if (subtype === SUBTYPES[type].primary) {
      if (options.primaryBootloaderOffset === null) {
        throw new Error("Primary bootloader offset is not defined");
      }
      return options.primaryBootloaderOffset;
    }
    if (subtype === SUBTYPES[type].recovery) {
      if (options.recoveryBootloaderOffset === null) {
        throw new Error("Recovery bootloader offset is not defined");
      }
      return options.recoveryBootloaderOffset;
    }
  }

  if (type === PARTITION_TABLE_TYPE && subtype === SUBTYPES[type].primary) {
    return options.offset;
  }

  const trimmed = field.trim();
  if (!trimmed) {
    return null;
  }
  return parseIntLike(trimmed);
}

function parseSize(field: string, type: number, options: ReturnType<typeof resolveOptions>): number | null {
  if (type === BOOTLOADER_TYPE) {
    if (options.primaryBootloaderOffset === null) {
      throw new Error("Primary bootloader offset is not defined");
    }
    return options.offset - options.primaryBootloaderOffset;
  }
  if (type === PARTITION_TABLE_TYPE) {
    return PARTITION_TABLE_SIZE;
  }

  const trimmed = field.trim();
  if (!trimmed) {
    return null;
  }
  return parseIntLike(trimmed);
}

export function fromCSV(data: string): Partition[] {
  return fromCSVWithOptions(data, {});
}

export function fromCSVWithOptions(data: string, options: EncodePartitionTableOptions): Partition[] {
  const resolved = resolveOptions(options);
  const lines = data.split(/\r?\n/);
  const parsed: Partition[] = [];

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const rawLine = lines[lineIndex];
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const fields = `${line},,,,`.split(",").map((x) => x.trim());
    const name = fields[0];
    if (!name) {
      throw new Error(`Invalid row at line ${lineIndex + 1}: name is required`);
    }

    const typeField = fields[1];
    if (!typeField) {
      throw new Error(`Invalid row at line ${lineIndex + 1}: type is required`);
    }
    const type = parseIntLike(typeField, TYPES);

    const subtypeField = fields[2];
    const subtype = subtypeField ? parseIntLike(subtypeField, SUBTYPES[type] ?? {}) : type === TYPES.app ? (() => { throw new Error("App partition cannot have empty subtype"); })() : SUBTYPES[TYPES.data].undefined;

    const offset = parseAddress(fields[3], type, subtype, resolved);
    const size = parseSize(fields[4], type, resolved);
    if (size === null) {
      throw new Error(`Size cannot be empty at line ${lineIndex + 1}`);
    }

    parsed.push({
      name,
      type,
      subtype,
      offset,
      size,
      flags: fields[5] ? parseFlags(fields[5]) : defaultFlags(),
    });
  }

  const normalized = normalizePartitions(parsed, resolved);
  if (!resolved.noVerify) {
    verifyPartitions(normalized, resolved);
  }
  return normalized.map(toPublicPartition);
}

function formatAddress(value: number, includeSizes: boolean): string {
  if (includeSizes) {
    if (value % 0x100000 === 0) {
      return `${value / 0x100000}M`;
    }
    if (value % 0x400 === 0) {
      return `${value / 0x400}K`;
    }
  }
  return `0x${value.toString(16)}`;
}

function lookupType(type: string | number): string {
  if (typeof type === "number") {
    return TYPE_NAMES[type] ?? String(type);
  }
  return type;
}

function lookupSubtype(type: string | number, subtype: string | number): string {
  if (typeof subtype === "string") {
    return subtype;
  }

  const typeNum = typeof type === "number" ? type : TYPES[type] ?? Number.NaN;
  if (Number.isNaN(typeNum)) {
    return String(subtype);
  }
  for (const [name, value] of Object.entries(SUBTYPES[typeNum] ?? {})) {
    if (value === subtype) {
      return name;
    }
  }
  return String(subtype);
}

function flagsToCsv(flags: Partition["flags"]): string {
  const values: string[] = [];
  if (flags.encrypted) values.push("encrypted");
  if (flags.readonly) values.push("readonly");
  return values.join(":");
}

export function toCSV(partitions: Partition[]): string {
  const rows = ["# ESP-IDF Partition Table", "# Name, Type, SubType, Offset, Size, Flags"];
  for (const p of partitions) {
    if (p.offset === null || p.size === null) {
      throw new Error(`Partition ${p.name} has unresolved fields`);
    }
    rows.push([
      p.name,
      lookupType(p.type),
      lookupSubtype(p.type, p.subtype),
      formatAddress(p.offset, false),
      formatAddress(p.size, true),
      flagsToCsv(p.flags),
    ].join(","));
  }
  return `${rows.join("\n")}\n`;
}
