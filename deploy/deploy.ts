import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  const deployed = await deploy("MultiChoiceVoting", {
    from: deployer,
    args: [],
    log: true,
    skipIfAlreadyDeployed: false,
  });

  console.log(`MultiChoiceVoting contract deployed at: ${deployed.address}`);
};

export default func;
func.id = "deploy_multi_choice_voting";
func.tags = ["MultiChoiceVoting"];

