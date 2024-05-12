# Novolem Protocol V0
This repository contains the core smart contracts for the Novolem V0 Protocol.

[![Novolem V0](https://www.novolem.com/assets/novolem-v0-banner.png)](https://novolem.com)

## Requirements
- Node.js 18.0.0 or later
- Bun 1.0 or later

## Installation
Use `bun` to install the project dependencies:
```bash
bun install
```

## Testing
Tests are available under the `test` folder. To run the tests, you can use the following command:
```bash
bunx hardhat test
```

## Development
### Local
To run the development chain, use the following command:
```bash
bunx hardhat node
```

To deploy the contracts to the local chain, use the following command:
```bash
bunx hardhat ignition deploy ignition/modules/Novolem.js --network localhost
```

## Resources
- [Novolem V0 Protocol](https://novolem.com)
- [Novolem V0 Documentation](https://novolem.com/docs)
- [Novolem V0 GitHub](https://github.com/novolem/v0-core)

## Licensing
The primary license for Novolem V0 Core is the Business Source License 1.1 (`BUSL-1.1`), see LICENSE. However, some files are licensed under the `MIT`, `GPL-2.0-or-later` or other licenses, see the individual file headers for details. Core files without a license on the header are considered to be licensed under the `BUSL-1.1`. Libraries, modules and third-party code are licensed under their respective licenses.
