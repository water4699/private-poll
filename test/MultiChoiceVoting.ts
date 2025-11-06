import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm } from "hardhat";
import { MultiChoiceVoting, MultiChoiceVoting__factory } from "../types";
import { expect } from "chai";
import { FhevmType } from "@fhevm/hardhat-plugin";

type Signers = {
  deployer: HardhatEthersSigner;
  alice: HardhatEthersSigner;
  bob: HardhatEthersSigner;
  carol: HardhatEthersSigner;
};

async function deployFixture() {
  const factory = (await ethers.getContractFactory("MultiChoiceVoting")) as MultiChoiceVoting__factory;
  const contract = (await factory.deploy()) as MultiChoiceVoting;
  const contractAddress = await contract.getAddress();

  return { contract, contractAddress };
}

describe("MultiChoiceVoting", function () {
  let signers: Signers;
  let votingContract: MultiChoiceVoting;
  let contractAddress: string;

  before(async function () {
    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = {
      deployer: ethSigners[0],
      alice: ethSigners[1],
      bob: ethSigners[2],
      carol: ethSigners[3],
    };
  });

  beforeEach(async function () {
    // Check if running on mock environment
    if (!fhevm.isMock) {
      console.warn(`This test suite can only run on local mock environment`);
      this.skip();
    }

    ({ contract: votingContract, contractAddress } = await deployFixture());
  });

  describe("Poll Creation", function () {
    it("should create a poll successfully", async function () {
      const title = "Favorite Programming Language";
      const options = ["JavaScript", "Python", "Rust"];
      const startTime = Math.floor(Date.now() / 1000);
      const endTime = startTime + 3600; // 1 hour from now

      const tx = await votingContract
        .connect(signers.alice)
        .createPoll(title, options, startTime, endTime);
      await tx.wait();

      const pollCount = await votingContract.getPollCount();
      expect(pollCount).to.equal(1);

      const pollInfo = await votingContract.getPollInfo(0);
      expect(pollInfo[0]).to.equal(title);
      expect(pollInfo[1]).to.deep.equal(options);
      expect(pollInfo[4]).to.equal(signers.alice.address);
      expect(pollInfo[5]).to.equal(false); // not finalized
    });

    it("should fail to create poll with empty title", async function () {
      const options = ["Option A", "Option B"];
      const startTime = Math.floor(Date.now() / 1000);
      const endTime = startTime + 3600;

      await expect(
        votingContract.connect(signers.alice).createPoll("", options, startTime, endTime),
      ).to.be.revertedWith("Title cannot be empty");
    });

    it("should fail to create poll with too few options", async function () {
      const title = "Test Poll";
      const options = ["Only One"];
      const startTime = Math.floor(Date.now() / 1000);
      const endTime = startTime + 3600;

      await expect(
        votingContract.connect(signers.alice).createPoll(title, options, startTime, endTime),
      ).to.be.revertedWith("Must have 2-16 options");
    });

    it("should fail to create poll with invalid time range", async function () {
      const title = "Test Poll";
      const options = ["Option A", "Option B"];
      const startTime = Math.floor(Date.now() / 1000);
      const endTime = startTime - 100; // End before start

      await expect(
        votingContract.connect(signers.alice).createPoll(title, options, startTime, endTime),
      ).to.be.revertedWith("End time must be after start time");
    });
  });

  describe("Voting", function () {
    let pollId: number;

    beforeEach(async function () {
      const title = "Best Framework";
      const options = ["React", "Vue", "Angular"];
      const startTime = Math.floor(Date.now() / 1000) - 100; // Started
      const endTime = startTime + 3600;

      const tx = await votingContract
        .connect(signers.deployer)
        .createPoll(title, options, startTime, endTime);
      await tx.wait();
      pollId = 0;
    });

    it("should allow a user to vote with encrypted choice", async function () {
      // Alice votes for option 1 (Vue)
      const voteChoice = 1;
      const encryptedVote = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .add32(voteChoice)
        .encrypt();

      const tx = await votingContract
        .connect(signers.alice)
        .vote(pollId, encryptedVote.handles[0], encryptedVote.inputProof);
      await tx.wait();

      const hasVoted = await votingContract.hasUserVoted(pollId, signers.alice.address);
      expect(hasVoted).to.equal(true);

      const totalVoters = await votingContract.getTotalVoters(pollId);
      expect(totalVoters).to.equal(1);
    });

    it("should prevent double voting", async function () {
      const voteChoice = 0;
      const encryptedVote = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .add32(voteChoice)
        .encrypt();

      await votingContract
        .connect(signers.alice)
        .vote(pollId, encryptedVote.handles[0], encryptedVote.inputProof);

      // Try to vote again
      const encryptedVote2 = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .add32(1)
        .encrypt();

      await expect(
        votingContract.connect(signers.alice).vote(pollId, encryptedVote2.handles[0], encryptedVote2.inputProof),
      ).to.be.revertedWith("Already voted");
    });

    it("should allow multiple users to vote", async function () {
      // Alice votes for option 0
      const aliceVote = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .add32(0)
        .encrypt();
      await votingContract
        .connect(signers.alice)
        .vote(pollId, aliceVote.handles[0], aliceVote.inputProof);

      // Bob votes for option 1
      const bobVote = await fhevm
        .createEncryptedInput(contractAddress, signers.bob.address)
        .add32(1)
        .encrypt();
      await votingContract.connect(signers.bob).vote(pollId, bobVote.handles[0], bobVote.inputProof);

      // Carol votes for option 0
      const carolVote = await fhevm
        .createEncryptedInput(contractAddress, signers.carol.address)
        .add32(0)
        .encrypt();
      await votingContract
        .connect(signers.carol)
        .vote(pollId, carolVote.handles[0], carolVote.inputProof);

      const totalVoters = await votingContract.getTotalVoters(pollId);
      expect(totalVoters).to.equal(3);
    });

    it("should correctly count encrypted votes", async function () {
      // Vote distribution: React=2, Vue=1, Angular=0
      const votes = [
        { signer: signers.alice, choice: 0 },
        { signer: signers.bob, choice: 1 },
        { signer: signers.carol, choice: 0 },
      ];

      for (const vote of votes) {
        const encrypted = await fhevm
          .createEncryptedInput(contractAddress, vote.signer.address)
          .add32(vote.choice)
          .encrypt();
        await votingContract.connect(vote.signer).vote(pollId, encrypted.handles[0], encrypted.inputProof);
      }

      // Verify encrypted counts by decrypting them
      const encryptedCount0 = await votingContract.getEncryptedCount(pollId, 0);
      const decryptedCount0 = await fhevm.userDecryptEuint(
        FhevmType.euint32,
        encryptedCount0,
        contractAddress,
        signers.alice,
      );
      expect(decryptedCount0).to.equal(2); // React: 2 votes

      const encryptedCount1 = await votingContract.getEncryptedCount(pollId, 1);
      const decryptedCount1 = await fhevm.userDecryptEuint(
        FhevmType.euint32,
        encryptedCount1,
        contractAddress,
        signers.alice,
      );
      expect(decryptedCount1).to.equal(1); // Vue: 1 vote

      const encryptedCount2 = await votingContract.getEncryptedCount(pollId, 2);
      const decryptedCount2 = await fhevm.userDecryptEuint(
        FhevmType.euint32,
        encryptedCount2,
        contractAddress,
        signers.alice,
      );
      expect(decryptedCount2).to.equal(0); // Angular: 0 votes
    });
  });

  describe("Poll Finalization", function () {
    let pollId: number;

    beforeEach(async function () {
      const title = "Color Poll";
      const options = ["Red", "Green", "Blue"];
      const startTime = Math.floor(Date.now() / 1000) - 200;
      const endTime = startTime + 100; // Already ended

      const tx = await votingContract
        .connect(signers.deployer)
        .createPoll(title, options, startTime, endTime);
      await tx.wait();
      pollId = 0;
    });

    it("should fail to finalize before voting ends", async function () {
      const title = "Future Poll";
      const options = ["A", "B"];
      const startTime = Math.floor(Date.now() / 1000);
      const endTime = startTime + 3600; // Still active

      const tx = await votingContract
        .connect(signers.deployer)
        .createPoll(title, options, startTime, endTime);
      await tx.wait();
      const newPollId = 1;

      await expect(votingContract.requestFinalization(newPollId)).to.be.revertedWith("Voting has not ended");
    });

    it("should request finalization after voting ends", async function () {
      const tx = await votingContract.requestFinalization(pollId);
      const receipt = await tx.wait();

      expect(receipt).to.not.be.null;

      const pollInfo = await votingContract.getPollInfo(pollId);
      expect(pollInfo[6]).to.equal(true); // decryptionPending should be true
    });
  });

  describe("View Functions", function () {
    it("should return correct poll count", async function () {
      const initialCount = await votingContract.getPollCount();
      expect(initialCount).to.equal(0);

      const startTime = Math.floor(Date.now() / 1000);
      const endTime = startTime + 3600;

      await votingContract
        .connect(signers.alice)
        .createPoll("Poll 1", ["A", "B"], startTime, endTime);
      await votingContract
        .connect(signers.bob)
        .createPoll("Poll 2", ["X", "Y", "Z"], startTime, endTime);

      const finalCount = await votingContract.getPollCount();
      expect(finalCount).to.equal(2);
    });

    it("should return encrypted counts", async function () {
      const title = "Test Poll";
      const options = ["Option 1", "Option 2"];
      const startTime = Math.floor(Date.now() / 1000) - 100;
      const endTime = startTime + 3600;

      await votingContract
        .connect(signers.deployer)
        .createPoll(title, options, startTime, endTime);
      const pollId = 0;

      const encryptedCounts = await votingContract.getEncryptedCounts(pollId);
      expect(encryptedCounts.length).to.equal(2);
    });
  });
});

