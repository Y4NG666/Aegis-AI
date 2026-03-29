require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const {
  SEPOLIA_RPC_URL,
  PRIVATE_KEY,
  GUARDIAN_SIGNER_KEY,
  MONITOR_SIGNER_KEY,
} = process.env;

const DEPLOYER_PRIVATE_KEY =
  PRIVATE_KEY || GUARDIAN_SIGNER_KEY || MONITOR_SIGNER_KEY || "";

module.exports = {
  solidity: "0.8.24",
  networks: {
    hardhat: {},
    localhost: {
      url: "http://127.0.0.1:8545",
    },
    sepolia: {
      url: SEPOLIA_RPC_URL || "",
      accounts: DEPLOYER_PRIVATE_KEY ? [DEPLOYER_PRIVATE_KEY] : [],
    },
  },
};
