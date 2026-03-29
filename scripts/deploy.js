require("dotenv").config();

const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

const DEFAULT_MAX_POSITION_BPS = Number(process.env.HEDGE_MAX_POSITION_BPS || "2500");
const DEFAULT_LIQUIDATION_THRESHOLD_BPS = Number(
  process.env.HEDGE_LIQUIDATION_THRESHOLD_BPS || "8000",
);
const DEFAULT_REBALANCE_THRESHOLD_BPS = Number(
  process.env.HEDGE_REBALANCE_THRESHOLD_BPS || "500",
);
const DEFAULT_LIQUIDITY_THRESHOLD_BPS = Number(
  process.env.DEMO_LIQUIDITY_THRESHOLD_BPS || "2000",
);
const DEFAULT_CALLBACK_GAS_LIMIT = Number(process.env.DEMO_CALLBACK_GAS_LIMIT || "300000");

async function main() {
  const [deployer, demoPairSigner] = await hre.ethers.getSigners();
  const networkInfo = await hre.ethers.provider.getNetwork();
  const chainId = Number(networkInfo.chainId);

  const Guardian = await hre.ethers.getContractFactory("AegisAIGuardian");
  const guardian = await Guardian.deploy();
  await guardian.waitForDeployment();

  const RiskController = await hre.ethers.getContractFactory("RiskController");
  const riskController = await RiskController.deploy(
    DEFAULT_MAX_POSITION_BPS,
    DEFAULT_LIQUIDATION_THRESHOLD_BPS,
    DEFAULT_REBALANCE_THRESHOLD_BPS,
  );
  await riskController.waitForDeployment();

  const ReactiveGuardian = await hre.ethers.getContractFactory(
    "AegisReactiveLiquidityGuardian",
  );
  const demoPairAddress =
    process.env.DEMO_PAIR_ADDRESS ||
    demoPairSigner?.address ||
    deployer.address;
  const reactiveGuardian = await ReactiveGuardian.deploy(
    chainId,
    chainId,
    demoPairAddress,
    await guardian.getAddress(),
    DEFAULT_LIQUIDITY_THRESHOLD_BPS,
    DEFAULT_CALLBACK_GAS_LIMIT,
  );
  await reactiveGuardian.waitForDeployment();

  const deployment = {
    network: hre.network.name,
    chainId,
    deployerAddress: deployer.address,
    guardianContractAddress: await guardian.getAddress(),
    riskControllerAddress: await riskController.getAddress(),
    monitorContractAddress: await reactiveGuardian.getAddress(),
    monitorContractName: "AegisReactiveLiquidityGuardian",
    monitorEventName: "AbnormalLiquidityDetected",
    demoPairAddress,
    sourceChainId: chainId,
    callbackChainId: chainId,
    liquidityThresholdBps: DEFAULT_LIQUIDITY_THRESHOLD_BPS,
    callbackGasLimit: DEFAULT_CALLBACK_GAS_LIMIT,
    deployedAt: new Date().toISOString(),
  };

  const deploymentsDir = path.join(__dirname, "..", "deployments");
  fs.mkdirSync(deploymentsDir, { recursive: true });

  const deploymentPath = path.join(deploymentsDir, `${hre.network.name}.json`);
  fs.writeFileSync(deploymentPath, JSON.stringify(deployment, null, 2));

  console.log("AegisAIGuardian deployed to:", deployment.guardianContractAddress);
  console.log("RiskController deployed to:", deployment.riskControllerAddress);
  console.log("AegisReactiveLiquidityGuardian deployed to:", deployment.monitorContractAddress);
  console.log("Deployment manifest written to:", deploymentPath);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
