require('dotenv').config()

require("@nomicfoundation/hardhat-toolbox");
require("@nomicfoundation/hardhat-ignition-ethers");
require("hardhat-contract-sizer");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  defaultNetwork: "hardhat",
  solidity: {
    version: "0.8.25",
    settings: {
      optimizer: {
        enabled: true,
        runs: 100,
      },
    },
  },
  networks: {
    hardhat: {
      allowUnlimitedContractSize: true
    },
    amoy: {
      url: "https://rpc-amoy.polygon.technology/",
      accounts: [process.env.OWNER_PRIVATE_KEY],
    },
    base_testnet: {
      url: "	https://sepolia.base.org",
      accounts: [process.env.OWNER_PRIVATE_KEY],
    }
  },

};
