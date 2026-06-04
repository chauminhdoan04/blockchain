
import { network } from "hardhat";

async function main() {
  const { ethers } = await network.create();
  console.log("Deploying CowManager...");
  const CowManager = await ethers.getContractFactory("CowManager");
  const cm = await CowManager.deploy();
  await cm.waitForDeployment();
  const addr = await cm.getAddress();
  console.log("CowManager deployed to:", addr);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
