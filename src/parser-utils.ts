import {
  ALIGNMENT,
  APP_TYPE,
  BOOTLOADER_TYPE,
  DATA_TYPE,
  FLAGS,
  NVS_RW_MIN_PARTITION_SIZE,
  PARTITION_TABLE_SIZE,
  PARTITION_TABLE_TYPE,
  SUBTYPES,
  TYPE_NAMES,
  TYPES,
} from "./constants.js";
import type {
  EncodePartitionTableOptions,
  NormalizedPartition,
  Partition,
  PartitionType,
  PartitionTypeName,
} from "./types.js";

export interface NormalizedOptions {
  flashSizeMb?: number;
  disableMd5sum: boolean;
  noVerify: boolean;
  offset: number;
  primaryBootloaderOffset: number | null;
  recoveryBootloaderOffset: number | null;
  secure: "v1" | "v2" | null;
  extraPartitionSubtypes: Array<{ type: number; name: string; value: number }>;
}

export function resolveOptions(options?: EncodePartitionTableOptions): NormalizedOptions {
  const offset = options?.offset ?? 0x8000;
  return {
    flashSizeMb: options?.flashSizeMb,
    disableMd5sum: options?.disableMd5sum ?? false,
    noVerify: options?.noVerify ?? false,
    offset,
    primaryBootloaderOffset: options?.primaryBootloaderOffset ?? null,
    recoveryBootloaderOffset: options?.recoveryBootloaderOffset ?? null,
    secure: options?.secure ?? null,
    extraPartitionSubtypes: (options?.extraPartitionSubtypes ?? []).map((x) => ({
      type: TYPES[x.type],
      name: x.name,
      value: x.value,
    })),
  };
}

export function parseIntLike(value: string, keywords: Record<string, number> = {}): number {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new Error("Invalid empty numeric field");
  }

  const lower = trimmed.toLowerCase();
  if (lower.endsWith("k")) {
    return parseIntLike(lower.slice(0, -1), keywords) * 1024;
  }
  if (lower.endsWith("m")) {
    return parseIntLike(lower.slice(0, -1), keywords) * 1024 * 1024;
  }

  const asNumber = Number.parseInt(trimmed, 0);
  if (!Number.isNaN(asNumber)) {
    return asNumber;
  }

  const mapped = keywords[lower];
  if (mapped === undefined) {
    throw new Error(`Invalid field value '${value}'`);
  }
  return mapped;
}

export function typeToNumber(type: string | number): number {
  if (typeof type === "number") {
    return type;
  }
  return parseIntLike(type, TYPES);
}

export function subtypeToNumber(type: number, subtype: string | number): number {
  if (typeof subtype === "number") {
    return subtype;
  }
  return parseIntLike(subtype, SUBTYPES[type] ?? {});
}

export function typeToName(type: number): PartitionType {
  return (TYPE_NAMES[type] as PartitionTypeName | undefined) ?? type;
}

export function subtypeToName(type: number, subtype: number): string | number {
  const entries = SUBTYPES[type] ?? {};
  for (const [name, value] of Object.entries(entries)) {
    if (value === subtype) {
      return name;
    }
  }
  return subtype;
}

export function flagsToWord(flags: Partition["flags"]): number {
  let value = flags.unknown >>> 0;
  if (flags.encrypted) {
    value |= 1 << FLAGS.encrypted;
  }
  if (flags.readonly) {
    value |= 1 << FLAGS.readonly;
  }
  return value >>> 0;
}

export function flagsFromWord(word: number): Partition["flags"] {
  let unknown = word >>> 0;
  const encrypted = (unknown & (1 << FLAGS.encrypted)) !== 0;
  if (encrypted) {
    unknown &= ~(1 << FLAGS.encrypted);
  }
  const readonly = (unknown & (1 << FLAGS.readonly)) !== 0;
  if (readonly) {
    unknown &= ~(1 << FLAGS.readonly);
  }
  return { encrypted, readonly, unknown: unknown >>> 0 };
}

export function defaultFlags(): Partition["flags"] {
  return { encrypted: false, readonly: false, unknown: 0 };
}

export function parseFlags(csvField: string): Partition["flags"] {
  const result = defaultFlags();
  const parts = csvField.split(":").map((x) => x.trim()).filter(Boolean);
  for (const part of parts) {
    if (part === "encrypted") {
      result.encrypted = true;
      continue;
    }
    if (part === "readonly") {
      result.readonly = true;
      continue;
    }
    throw new Error(`CSV flag column contains unknown flag '${part}'`);
  }
  return result;
}

export function normalizePartitions(
  partitions: Partition[],
  options: NormalizedOptions,
): NormalizedPartition[] {
  const subtypeMap = cloneSubtypeMap();
  for (const extra of options.extraPartitionSubtypes) {
    if (!(extra.type in subtypeMap)) {
      subtypeMap[extra.type] = {};
    }
    subtypeMap[extra.type][extra.name.toLowerCase()] = extra.value;
  }

  const normalized = partitions.map((partition) => {
    const type = typeToNumber(partition.type);
    const subtype = typeof partition.subtype === "string"
      ? parseIntLike(partition.subtype, subtypeMap[type] ?? {})
      : partition.subtype;
    return {
      name: partition.name,
      type,
      subtype,
      offset: partition.offset,
      size: partition.size,
      flags: flagsToWord(partition.flags),
    };
  });

  // Match Python behavior for missing offsets and negative sizes.
  let lastEnd = options.offset + PARTITION_TABLE_SIZE;
  for (const part of normalized) {
    const isPrimaryBootloader = part.type === BOOTLOADER_TYPE && part.subtype === SUBTYPES[BOOTLOADER_TYPE].primary;
    const isPrimaryPartitionTable =
      part.type === PARTITION_TABLE_TYPE && part.subtype === SUBTYPES[PARTITION_TABLE_TYPE].primary;
    if (isPrimaryBootloader || isPrimaryPartitionTable) {
      continue;
    }

    if (part.offset !== null && part.offset < lastEnd) {
      throw new Error(`Partitions overlap: partition ${part.name} sets offset 0x${part.offset.toString(16)}, previous end is 0x${lastEnd.toString(16)}`);
    }

    if (part.offset === null) {
      const padTo = getAlignmentOffsetForType(part.type);
      if (lastEnd % padTo !== 0) {
        lastEnd += padTo - (lastEnd % padTo);
      }
      part.offset = lastEnd;
    }

    if (part.size === null) {
      throw new Error(`Partition ${part.name} size cannot be empty`);
    }
    if (part.size < 0) {
      part.size = -part.size - part.offset;
    }
    lastEnd = part.offset + part.size;
  }

  return normalized.map((part) => {
    if (part.offset === null || part.size === null) {
      throw new Error(`Partition ${part.name} has unresolved fields`);
    }
    return {
      name: part.name,
      type: part.type,
      subtype: part.subtype,
      offset: part.offset,
      size: part.size,
      flags: part.flags,
    };
  });
}

export function verifyPartitions(partitions: NormalizedPartition[], options: NormalizedOptions): void {
  for (const part of partitions) {
    verifyPartition(part, options);
  }

  const names = partitions.map((x) => x.name);
  const dup = new Set(names.filter((name, idx) => names.indexOf(name) !== idx));
  if (dup.size > 0) {
    throw new Error("Partition names must be unique");
  }

  let previous: NormalizedPartition | null = null;
  const sortedByOffset = [...partitions].sort((a, b) => a.offset - b.offset);
  for (const part of sortedByOffset) {
    if (part.offset < options.offset + PARTITION_TABLE_SIZE) {
      const isPrimaryBootloader = part.type === BOOTLOADER_TYPE && part.subtype === SUBTYPES[BOOTLOADER_TYPE].primary;
      const isPrimaryPartitionTable =
        part.type === PARTITION_TABLE_TYPE && part.subtype === SUBTYPES[PARTITION_TABLE_TYPE].primary;
      if (!isPrimaryBootloader && !isPrimaryPartitionTable) {
        throw new Error(`Partition offset 0x${part.offset.toString(16)} is below 0x${(options.offset + PARTITION_TABLE_SIZE).toString(16)}`);
      }
    }
    if (previous && part.offset < previous.offset + previous.size) {
      throw new Error(`Partition at 0x${part.offset.toString(16)} overlaps previous partition`);
    }
    previous = part;
  }

  const otadata = partitions.filter((x) => x.type === DATA_TYPE && x.subtype === SUBTYPES[DATA_TYPE].ota);
  if (otadata.length > 1) {
    throw new Error("Found multiple otadata partitions");
  }
  if (otadata.length === 1 && otadata[0].size !== 0x2000) {
    throw new Error("otadata partition must have size = 0x2000");
  }

  const teeOtadata = partitions.filter((x) => x.type === DATA_TYPE && x.subtype === SUBTYPES[DATA_TYPE].tee_ota);
  if (teeOtadata.length > 1) {
    throw new Error("Found multiple TEE otadata partitions");
  }
  if (teeOtadata.length === 1 && teeOtadata[0].size !== 0x2000) {
    throw new Error("TEE otadata partition must have size = 0x2000");
  }

  if (options.flashSizeMb !== undefined) {
    const flashSize = options.flashSizeMb * 1024 * 1024;
    const end = partitions.length === 0 ? 0 : Math.max(...partitions.map((x) => x.offset + x.size));
    if (end > flashSize) {
      throw new Error(`Partition table occupies ${end} bytes and does not fit in ${options.flashSizeMb}MB flash`);
    }
  }
}

function verifyPartition(partition: NormalizedPartition, options: NormalizedOptions): void {
  const offsetAlign = getAlignmentOffsetForType(partition.type);
  if (partition.offset % offsetAlign !== 0) {
    throw new Error(`Partition ${partition.name} offset 0x${partition.offset.toString(16)} is not aligned to 0x${offsetAlign.toString(16)}`);
  }

  if (partition.type === APP_TYPE) {
    const sizeAlign = getAlignmentSizeForType(partition.type, options.secure);
    if (partition.size % sizeAlign !== 0) {
      throw new Error(`Partition ${partition.name} size 0x${partition.size.toString(16)} is not aligned to 0x${sizeAlign.toString(16)}`);
    }
  }

  const readonly = (partition.flags & (1 << FLAGS.readonly)) !== 0;
  const alwaysRw = partition.type === DATA_TYPE && (partition.subtype === SUBTYPES[DATA_TYPE].ota || partition.subtype === SUBTYPES[DATA_TYPE].coredump);
  if (alwaysRw && readonly) {
    throw new Error(`Partition ${partition.name} cannot be readonly`);
  }

  if (partition.type === DATA_TYPE && partition.subtype === SUBTYPES[DATA_TYPE].nvs) {
    if (partition.size < NVS_RW_MIN_PARTITION_SIZE && !readonly) {
      throw new Error(`Partition ${partition.name} NVS size 0x${partition.size.toString(16)} requires readonly flag`);
    }
  }
}

export function toPublicPartition(partition: NormalizedPartition): Partition {
  return {
    name: partition.name,
    type: typeToName(partition.type),
    subtype: subtypeToName(partition.type, partition.subtype),
    offset: partition.offset,
    size: partition.size,
    flags: flagsFromWord(partition.flags),
  };
}

export function getAlignmentOffsetForType(type: number): number {
  return ALIGNMENT[type] ?? ALIGNMENT[DATA_TYPE];
}

export function getAlignmentSizeForType(type: number, secure: "v1" | "v2" | null): number {
  if (type !== APP_TYPE) {
    return 1;
  }
  if (secure === "v1") {
    return 0x10000;
  }
  return 0x1000;
}

function cloneSubtypeMap(): Record<number, Record<string, number>> {
  const result: Record<number, Record<string, number>> = {};
  for (const [typeStr, values] of Object.entries(SUBTYPES)) {
    result[Number(typeStr)] = {};
    for (const [name, value] of Object.entries(values)) {
      result[Number(typeStr)][name.toLowerCase()] = value;
    }
  }
  return result;
}

export function parseTypeName(type: PartitionTypeName): number {
  return TYPES[type];
}
