import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm, deployments } from "hardhat";
import { MultiChoiceVoting } from "../types";
import { expect } from "chai";
import { FhevmType } from "@fhevm/hardhat-plugin";

type Signers = {
  alice: HardhatEthersSigner;
};

describe("MultiChoiceVoting Sepolia", function () {
  let signers: Signers;
  let votingContract: MultiChoiceVoting;
  let contractAddress: string;
  let step: number;
  let steps: number;

  function progress(message: string) {
    console.log(`${++step}/${steps} ${message}`);
  }

  before(async function () {
    if (fhevm.isMock) {
      console.warn(`This test suite can only run on Sepolia Testnet`);
      this.skip();
    }

    try {
      const deployment = await deployments.get("MultiChoiceVoting");
      contractAddress = deployment.address;
      votingContract = await ethers.getContractAt("MultiChoiceVoting", deployment.address);
    } catch (e) {
      (e as Error).message += ". Call 'npx hardhat deploy --network sepolia'";
      throw e;
    }

    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { alice: ethSigners[0] };
  });

  beforeEach(async () => {
    step = 0;
    steps = 0;
  });

  it("should create a poll and vote on Sepolia", async function () {
    steps = 8;
    this.timeout(5 * 60000); // 5 minutes timeout

    progress("Creating a new poll...");
    const title = "Sepolia Test Poll";
    const options = ["Option A", "Option B", "Option C"];
    const startTime = Math.floor(Date.now() / 1000);
    const endTime = startTime + 3600;

    const createTx = await votingContract
      .connect(signers.alice)
      .createPoll(title, options, startTime, endTime);
    await createTx.wait();
    progress(`Poll created successfully`);

    progress("Getting poll count...");
    const pollCount = await votingContract.getPollCount();
    const pollId = Number(pollCount) - 1;
    progress(`Current poll count: ${pollCount}, testing with pollId: ${pollId}`);

    progress("Getting poll information...");
    const pollInfo = await votingContract.getPollInfo(pollId);
    expect(pollInfo[0]).to.equal(title);
    progress(`Poll title: ${pollInfo[0]}`);

    progress("Encrypting vote for Option B (index 1)...");
    const voteChoice = 1;
    const encryptedVote = await fhevm
      .createEncryptedInput(contractAddress, signers.alice.address)
      .add32(voteChoice)
      .encrypt();
    progress(`Vote encrypted successfully`);

    progress("Submitting encrypted vote...");
    const voteTx = await votingContract
      .connect(signers.alice)
      .vote(pollId, encryptedVote.handles[0], encryptedVote.inputProof);
    await voteTx.wait();
    progress(`Vote submitted successfully`);

    progress("Verifying vote was recorded...");
    const hasVoted = await votingContract.hasUserVoted(pollId, signers.alice.address);
    expect(hasVoted).to.equal(true);
    const totalVoters = await votingContract.getTotalVoters(pollId);
    expect(totalVoters).to.equal(1);
    progress(`Vote verified. Total voters: ${totalVoters}`);

    progress("Getting encrypted count for Option B...");
    const encryptedCount = await votingContract.getEncryptedCount(pollId, 1);
    const decryptedCount = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      encryptedCount,
      contractAddress,
      signers.alice,
    );
    expect(decryptedCount).to.equal(1);
    progress(`Decrypted count for Option B: ${decryptedCount}`);
  });

  it("should handle multiple votes correctly", async function () {
    steps = 7;
    this.timeout(5 * 60000);

    progress("Creating a new poll for multiple votes test...");
    const title = "Multi-voter Test";
    const options = ["Choice 1", "Choice 2"];
    const startTime = Math.floor(Date.now() / 1000);
    const endTime = startTime + 7200;

    const createTx = await votingContract
      .connect(signers.alice)
      .createPoll(title, options, startTime, endTime);
    await createTx.wait();

    const pollCount = await votingContract.getPollCount();
    const pollId = Number(pollCount) - 1;
    progress(`Poll created with ID: ${pollId}`);

    progress("Casting vote for Choice 1...");
    const encryptedVote = await fhevm
      .createEncryptedInput(contractAddress, signers.alice.address)
      .add32(0)
      .encrypt();

    const voteTx = await votingContract
      .connect(signers.alice)
      .vote(pollId, encryptedVote.handles[0], encryptedVote.inputProof);
    await voteTx.wait();
    progress("Vote cast successfully");

    progress("Verifying vote count...");
    const totalVoters = await votingContract.getTotalVoters(pollId);
    expect(totalVoters).to.equal(1);
    progress(`Total voters: ${totalVoters}`);

    progress("Attempting to vote again (should fail)...");
    const encryptedVote2 = await fhevm
      .createEncryptedInput(contractAddress, signers.alice.address)
      .add32(1)
      .encrypt();

    await expect(
      votingContract.connect(signers.alice).vote(pollId, encryptedVote2.handles[0], encryptedVote2.inputProof),
    ).to.be.revertedWith("Already voted");
    progress("Double voting prevented successfully");

    progress("Verifying encrypted counts...");
    const encryptedCounts = await votingContract.getEncryptedCounts(pollId);
    expect(encryptedCounts.length).to.equal(2);
    progress(`Retrieved ${encryptedCounts.length} encrypted counts`);
  });
});

