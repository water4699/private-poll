import { task } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";

task("task:createPoll", "Create a new poll")
  .addParam("title", "The poll title")
  .addParam("options", "Comma-separated list of options")
  .addParam("duration", "Duration in seconds", "3600")
  .setAction(async function (taskArguments: TaskArguments, { ethers, deployments }) {
    const { deployer } = await ethers.getNamedSigners();
    const MultiChoiceVoting = await deployments.get("MultiChoiceVoting");
    const contract = await ethers.getContractAt("MultiChoiceVoting", MultiChoiceVoting.address);

    const options = taskArguments.options.split(",").map((opt: string) => opt.trim());
    const startTime = Math.floor(Date.now() / 1000);
    const endTime = startTime + parseInt(taskArguments.duration);

    console.log("Creating poll...");
    console.log("Title:", taskArguments.title);
    console.log("Options:", options);
    console.log("Duration:", taskArguments.duration, "seconds");

    const tx = await contract.connect(deployer).createPoll(taskArguments.title, options, startTime, endTime);
    const receipt = await tx.wait();

    console.log(`Poll created! Transaction: ${receipt.hash}`);
  });

task("task:getPollInfo", "Get poll information")
  .addParam("pollid", "The poll ID")
  .setAction(async function (taskArguments: TaskArguments, { ethers, deployments }) {
    const MultiChoiceVoting = await deployments.get("MultiChoiceVoting");
    const contract = await ethers.getContractAt("MultiChoiceVoting", MultiChoiceVoting.address);

    const pollId = parseInt(taskArguments.pollid);
    const pollInfo = await contract.getPollInfo(pollId);

    console.log("\n=== Poll Information ===");
    console.log("Title:", pollInfo[0]);
    console.log("Options:", pollInfo[1]);
    console.log("Start Time:", new Date(Number(pollInfo[2]) * 1000).toLocaleString());
    console.log("End Time:", new Date(Number(pollInfo[3]) * 1000).toLocaleString());
    console.log("Creator:", pollInfo[4]);
    console.log("Finalized:", pollInfo[5]);
    console.log("Decryption Pending:", pollInfo[6]);
    console.log("Total Voters:", pollInfo[7].toString());
  });

task("task:getPollCount", "Get total number of polls").setAction(
  async function (_taskArguments: TaskArguments, { ethers, deployments }) {
    const MultiChoiceVoting = await deployments.get("MultiChoiceVoting");
    const contract = await ethers.getContractAt("MultiChoiceVoting", MultiChoiceVoting.address);

    const count = await contract.getPollCount();
    console.log("Total polls:", count.toString());
  },
);

task("task:requestFinalization", "Request poll finalization")
  .addParam("pollid", "The poll ID")
  .setAction(async function (taskArguments: TaskArguments, { ethers, deployments }) {
    const { deployer } = await ethers.getNamedSigners();
    const MultiChoiceVoting = await deployments.get("MultiChoiceVoting");
    const contract = await ethers.getContractAt("MultiChoiceVoting", MultiChoiceVoting.address);

    const pollId = parseInt(taskArguments.pollid);
    console.log("Requesting finalization for poll", pollId);

    const tx = await contract.connect(deployer).requestFinalization(pollId);
    const receipt = await tx.wait();

    console.log(`Finalization requested! Transaction: ${receipt.hash}`);
  });

task("task:getResults", "Get poll results")
  .addParam("pollid", "The poll ID")
  .setAction(async function (taskArguments: TaskArguments, { ethers, deployments }) {
    const MultiChoiceVoting = await deployments.get("MultiChoiceVoting");
    const contract = await ethers.getContractAt("MultiChoiceVoting", MultiChoiceVoting.address);

    const pollId = parseInt(taskArguments.pollid);
    const results = await contract.getResults(pollId);
    const pollInfo = await contract.getPollInfo(pollId);

    console.log("\n=== Poll Results ===");
    console.log("Title:", pollInfo[0]);
    console.log("\nVote Counts:");
    pollInfo[1].forEach((option: string, index: number) => {
      console.log(`  ${option}: ${results[index]} votes`);
    });
    console.log("\nTotal Voters:", pollInfo[7].toString());
  });

