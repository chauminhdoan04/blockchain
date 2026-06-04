async function main() {
  console.log("Đang bắt đầu triển khai CowManager...");

  const { JsonRpcProvider, ContractFactory } = require("ethers");
  const artifact = require("./artifacts/contracts/CowManager.sol/CowManager.json");

  const provider = new JsonRpcProvider("http://127.0.0.1:8545");
  const deployer = await provider.getSigner(0);
  console.log("Triển khai bằng tài khoản:", await deployer.getAddress());

  // Deploy contract
  const CowManager = new ContractFactory(artifact.abi, artifact.bytecode, deployer);
  const cowManager = await CowManager.deploy();

  await cowManager.waitForDeployment();

  const address = await cowManager.getAddress();
  console.log("CowManager đã được triển khai tại địa chỉ:", address);
  console.log("Địa chỉ này có thể dán vào contractAddress trong src/App.tsx");
  
  // Lưu ý: Copy địa chỉ này dán vào file src/App.tsx (contractAddress)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
