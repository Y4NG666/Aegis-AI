require("dotenv").config();

const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

const UNISWAP_V2_SYNC_TOPIC_0 = BigInt(
  "0x1c411e9a96e071241c2f21f7726b17ae89e3cab4c78be50e062b03a9fffbbad1",
);

function loadDeployment() {
  const explicitPath = process.env.AEGIS_DEPLOYMENT_FILE;
  const deploymentPath = explicitPath
    ? path.resolve(explicitPath)
    : path.join(__dirname, "..", "deployments", `${hre.network.name}.json`);

  if (!fs.existsSync(deploymentPath)) {
    throw new Error(`Deployment manifest not found at ${deploymentPath}`);
  }

  return JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
}

function buildLogRecord(chainId, pairAddress, reserve0, reserve1, blockNumber) {
  const abiCoder = hre.ethers.AbiCoder.defaultAbiCoder();

  return [
    BigInt(chainId),
    pairAddress,
    UNISWAP_V2_SYNC_TOPIC_0,
    0n,
    0n,
    0n,
    abiCoder.encode(["uint112", "uint112"], [reserve0, reserve1]),
    BigInt(blockNumber),
    0n,
    0n,
    0n,
    0n,
  ];
}

async function main() {
  const deployment = loadDeployment();
  const reactiveGuardian = await hre.ethers.getContractAt(
    "AegisReactiveLiquidityGuardian",
    deployment.monitorContractAddress,
  );

  const baselineBlock = await hre.ethers.provider.getBlockNumber();
  const baselineTx = await reactiveGuardian.react(
    buildLogRecord(
      deployment.sourceChainId,
      deployment.demoPairAddress,
      1_000_000n,
      1_000_000n,
      baselineBlock,
    ),
  );
  await baselineTx.wait();

  const abnormalBlock = await hre.ethers.provider.getBlockNumber();
  const abnormalTx = await reactiveGuardian.react(
    buildLogRecord(
      deployment.sourceChainId,
      deployment.demoPairAddress,
      620_000n,
      490_000n,
      abnormalBlock,
    ),
  );
  const abnormalReceipt = await abnormalTx.wait();

  console.log("Baseline initialization tx:", baselineTx.hash);
  console.log("Abnormal liquidity tx:", abnormalTx.hash);
  console.log("AbnormalLiquidityDetected block:", abnormalReceipt.blockNumber);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
