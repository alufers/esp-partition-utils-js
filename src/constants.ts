export const MAX_PARTITION_LENGTH = 0x0c00;
export const PARTITION_TABLE_SIZE = 0x1000;
export const MD5_PARTITION_BEGIN = new Uint8Array([0xeb, 0xeb, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff]);
export const PARTITION_MAGIC_0 = 0xaa;
export const PARTITION_MAGIC_1 = 0x50;

export const APP_TYPE = 0x00;
export const DATA_TYPE = 0x01;
export const BOOTLOADER_TYPE = 0x02;
export const PARTITION_TABLE_TYPE = 0x03;

export const MIN_PARTITION_SUBTYPE_APP_OTA = 0x10;
export const NUM_PARTITION_SUBTYPE_APP_OTA = 16;
export const MIN_PARTITION_SUBTYPE_APP_TEE = 0x30;
export const NUM_PARTITION_SUBTYPE_APP_TEE = 2;

export const NVS_RW_MIN_PARTITION_SIZE = 0x3000;

export const TYPES: Record<string, number> = {
  bootloader: BOOTLOADER_TYPE,
  partition_table: PARTITION_TABLE_TYPE,
  app: APP_TYPE,
  data: DATA_TYPE,
};

export const TYPE_NAMES: Record<number, string> = {
  [BOOTLOADER_TYPE]: "bootloader",
  [PARTITION_TABLE_TYPE]: "partition_table",
  [APP_TYPE]: "app",
  [DATA_TYPE]: "data",
};

export const SUBTYPES: Record<number, Record<string, number>> = {
  [BOOTLOADER_TYPE]: {
    primary: 0x00,
    ota: 0x01,
    recovery: 0x02,
  },
  [PARTITION_TABLE_TYPE]: {
    primary: 0x00,
    ota: 0x01,
  },
  [APP_TYPE]: {
    factory: 0x00,
    test: 0x20,
  },
  [DATA_TYPE]: {
    ota: 0x00,
    phy: 0x01,
    nvs: 0x02,
    coredump: 0x03,
    nvs_keys: 0x04,
    efuse: 0x05,
    undefined: 0x06,
    esphttpd: 0x80,
    fat: 0x81,
    spiffs: 0x82,
    littlefs: 0x83,
    tee_ota: 0x90,
  },
};

for (let slot = 0; slot < NUM_PARTITION_SUBTYPE_APP_OTA; slot += 1) {
  SUBTYPES[APP_TYPE][`ota_${slot}`] = MIN_PARTITION_SUBTYPE_APP_OTA + slot;
}
for (let slot = 0; slot < NUM_PARTITION_SUBTYPE_APP_TEE; slot += 1) {
  SUBTYPES[APP_TYPE][`tee_${slot}`] = MIN_PARTITION_SUBTYPE_APP_TEE + slot;
}

export const SUBTYPE_NAMES: Record<number, Record<number, string>> = {};
for (const [typeName, typeValue] of Object.entries(TYPES)) {
  void typeName;
  SUBTYPE_NAMES[typeValue] = {};
  for (const [name, value] of Object.entries(SUBTYPES[typeValue] ?? {})) {
    SUBTYPE_NAMES[typeValue][value] = name;
  }
}

export const FLAGS = {
  encrypted: 0,
  readonly: 1,
} as const;

export const ALIGNMENT: Record<number, number> = {
  [APP_TYPE]: 0x10000,
  [DATA_TYPE]: 0x1000,
  [BOOTLOADER_TYPE]: 0x1000,
  [PARTITION_TABLE_TYPE]: 0x1000,
};
