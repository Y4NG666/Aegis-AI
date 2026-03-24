require("dotenv").config();

const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

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

async function main() {
  const deployment = loadDeployment();
  const guardian = await hre.ethers.getContractAt(
    "AegisAIGuardian",
    deployment.guardianContractAddress,
  );
  const riskController = await hre.ethers.getContractAt(
    "RiskController",
    deployment.riskControllerAddress,
  );
  const subjectAddress =
    process.env.DEMO_SUBJECT_ADDRESS ||
    deployment.demoPairAddress ||
    deployment.monitorContractAddress;

  const guardianState = await guardian.getGuardianState(subjectAddress);
  const paused = await riskController.paused();
  const parameters = await riskController.parameters();

  console.log(
    JSON.stringify(
      {
        subjectAddress,
        guardianState: {
          active: guardianState.active,
          lastRiskScore: Number(guardianState.lastRiskScore),
          lastUpdated: Number(guardianState.lastUpdated),
          latestSummary: guardianState.latestSummary,
        },
        riskController: {
          paused,
          parameters: {
            maxPositionBps: Number(parameters.maxPositionBps),
            liquidationThresholdBps: Number(parameters.liquidationThresholdBps),
            rebalanceThresholdBps: Number(parameters.rebalanceThresholdBps),
          },
        },
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
