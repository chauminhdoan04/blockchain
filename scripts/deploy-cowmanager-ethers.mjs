import fs from 'fs';
import path from 'path';
import { ethers } from 'ethers';

async function main() {
  const artifactPath = path.resolve('artifacts/contracts/CowManager.sol/CowManager.json');
  const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));

  const provider = new ethers.JsonRpcProvider('http://127.0.0.1:8545');
  const accounts = await provider.listAccounts();
  if (accounts.length === 0) throw new Error('No accounts available from RPC provider');
  const signer = provider.getSigner(accounts[0]);

  console.log('Deploying CowManager via ethers to http://127.0.0.1:8545');
  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, signer);
  const contract = await factory.deploy();
  await contract.waitForDeployment();
  console.log('CowManager deployed to:', await contract.getAddress());
}

main().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
