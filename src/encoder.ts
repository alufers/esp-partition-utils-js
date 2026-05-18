import {
  MAX_PARTITION_LENGTH,
  MD5_PARTITION_BEGIN,
  PARTITION_MAGIC_0,
  PARTITION_MAGIC_1,
} from "./constants.js";
import { md5 } from "./md5.js";
import {
  normalizePartitions,
  resolveOptions,
  typeToNumber,
  subtypeToNumber,
  verifyPartitions,
} from "./parser-utils.js";
import type { EncodePartitionTableOptions, Partition } from "./types.js";

function encodeName(name: string): Uint8Array {
  const encoded = new TextEncoder().encode(name);
  if (encoded.length > 16) {
    throw new Error(`Partition name too long: ${name}`);
  }
  const out = new Uint8Array(16);
  out.set(encoded, 0);
  return out;
}

function ensureBinaryFields(partitions: Partition[]): Partition[] {
  return partitions.map((part) => ({
    ...part,
    type: typeToNumber(part.type),
    subtype: subtypeToNumber(typeToNumber(part.type), part.subtype),
  }));
}

export function encodePartitionTable(
  partitions: Partition[],
  options: EncodePartitionTableOptions = {},
): Uint8Array {
  const resolved = resolveOptions(options);
  const numeric = ensureBinaryFields(partitions);
  const normalized = normalizePartitions(numeric, resolved);
  if (!resolved.noVerify) {
    verifyPartitions(normalized, resolved);
  }

  const chunks: Uint8Array[] = [];

  for (const part of normalized) {
    const entry = new Uint8Array(32);
    const dv = new DataView(entry.buffer);
    dv.setUint8(0, PARTITION_MAGIC_0);
    dv.setUint8(1, PARTITION_MAGIC_1);
    dv.setUint8(2, part.type);
    dv.setUint8(3, part.subtype);
    dv.setUint32(4, part.offset, true);
    dv.setUint32(8, part.size, true);
    entry.set(encodeName(part.name), 12);
    dv.setUint32(28, part.flags >>> 0, true);
    chunks.push(entry);
  }

  let bodyLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
  let body = new Uint8Array(bodyLength);
  let cursor = 0;
  for (const chunk of chunks) {
    body.set(chunk, cursor);
    cursor += chunk.length;
  }

  if (!resolved.disableMd5sum) {
    const digest = md5(body);
    const md5Entry = new Uint8Array(32);
    md5Entry.set(MD5_PARTITION_BEGIN, 0);
    md5Entry.set(digest, 16);

    const next = new Uint8Array(body.length + md5Entry.length);
    next.set(body, 0);
    next.set(md5Entry, body.length);
    body = next;
    bodyLength = body.length;
  }

  if (bodyLength >= MAX_PARTITION_LENGTH) {
    throw new Error(`Binary partition table length (${bodyLength}) is longer than max`);
  }

  const out = new Uint8Array(MAX_PARTITION_LENGTH);
  out.fill(0xff);
  out.set(body, 0);
  return out;
}
