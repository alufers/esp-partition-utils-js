import {
  MAX_PARTITION_LENGTH,
  MD5_PARTITION_BEGIN,
  PARTITION_MAGIC_0,
  PARTITION_MAGIC_1,
} from "./constants.js";
import { md5 } from "./md5.js";
import { flagsFromWord, subtypeToName, typeToName } from "./parser-utils.js";
import type { Partition } from "./types.js";

function isAllFF(block: Uint8Array): boolean {
  for (const byte of block) {
    if (byte !== 0xff) {
      return false;
    }
  }
  return true;
}

function startsWithMd5Marker(block: Uint8Array): boolean {
  return block[0] === MD5_PARTITION_BEGIN[0] && block[1] === MD5_PARTITION_BEGIN[1];
}

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

export function decodePartitionTable(data: ArrayBuffer | Uint8Array): Partition[] {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  const result: Partition[] = [];

  const digestBlocks: number[] = [];

  for (let offset = 0; offset + 32 <= bytes.length; offset += 32) {
    const entry = bytes.subarray(offset, offset + 32);
    if (isAllFF(entry)) {
      return result;
    }

    if (startsWithMd5Marker(entry)) {
      const withoutMd5 = bytes.subarray(0, offset);
      const computed = md5(withoutMd5);
      const parsed = entry.subarray(16, 32);
      if (!bytesEqual(computed, parsed)) {
        throw new Error("MD5 checksums do not match");
      }
      continue;
    }

    if (entry[0] !== PARTITION_MAGIC_0 || entry[1] !== PARTITION_MAGIC_1) {
      throw new Error(`Invalid partition magic at offset 0x${offset.toString(16)}`);
    }

    const dv = new DataView(entry.buffer, entry.byteOffset, entry.byteLength);
    const type = dv.getUint8(2);
    const subtype = dv.getUint8(3);
    const partOffset = dv.getUint32(4, true);
    const size = dv.getUint32(8, true);

    const nameBytes = entry.subarray(12, 28);
    const nul = nameBytes.indexOf(0x00);
    const actual = nul >= 0 ? nameBytes.subarray(0, nul) : nameBytes;
    const name = new TextDecoder().decode(actual);

    const flagWord = dv.getUint32(28, true);
    const flags = flagsFromWord(flagWord);
    digestBlocks.push(offset);

    result.push({
      name,
      type: typeToName(type),
      subtype: subtypeToName(type, subtype),
      offset: partOffset,
      size,
      flags,
    });

    if (offset >= MAX_PARTITION_LENGTH) {
      throw new Error("Partition table exceeds max length");
    }
  }

  void digestBlocks;
  throw new Error("Partition table is missing an end-of-table marker");
}
