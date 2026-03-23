require("dotenv").config();

async function main() {
  const Guardian = await ethers.getContractFactory("AegisAIGuardian");
  const guardian = await Guardian.deploy();

  await guardian.waitForDeployment();

  console.log("AegisAIGuardian deployed to:", await guardian.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
