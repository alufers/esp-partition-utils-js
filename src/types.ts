export type SecureMode = "v1" | "v2" | null;

export type PartitionTypeName = "app" | "data" | "bootloader" | "partition_table";
export type PartitionType = PartitionTypeName | number;

export type PartitionSubtype = string | number;

export interface PartitionFlags {
  encrypted: boolean;
  readonly: boolean;
  unknown: number;
}

export interface Partition {
  name: string;
  type: PartitionType;
  subtype: PartitionSubtype;
  offset: number | null;
  size: number | null;
  flags: PartitionFlags;
}

export interface ExtraPartitionSubtype {
  type: PartitionTypeName;
  name: string;
  value: number;
}

export interface EncodePartitionTableOptions {
  flashSizeMb?: 1 | 2 | 4 | 8 | 16 | 32 | 64 | 128;
  disableMd5sum?: boolean;
  noVerify?: boolean;
  offset?: number;
  primaryBootloaderOffset?: number;
  recoveryBootloaderOffset?: number;
  secure?: Exclude<SecureMode, null>;
  extraPartitionSubtypes?: ExtraPartitionSubtype[];
}

export interface NormalizedPartition {
  name: string;
  type: number;
  subtype: number;
  offset: number;
  size: number;
  flags: number;
}
