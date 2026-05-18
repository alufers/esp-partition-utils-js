# esp-partition-utils-js

ESP-IDF partition table parser and encoder written in TypeScript.

## Installation

```sh
npm i esp-partition-utils
```

## API

```ts
import {
  decodePartitionTable,
  encodePartitionTable,
  fromCSV,
  toCSV,
  type Partition,
  type EncodePartitionTableOptions,
} from "esp-partition-utils";
```

## CLI

```sh
# CSV -> BIN
npx esp-partition-table partitions.csv out.bin

# BIN -> CSV
npx esp-partition-table out.bin out.csv
```

## Development

```sh
npm install
npm test
npm run lint
npm run build
```

## License

Apache-2.0, see [./LICENSE](./LICENSE). This project includes the original Python partition table parser/generator pulled from esp-idf under `./python_original`, which is used during unit-tests. It is licensed under the same license.
