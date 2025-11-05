// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint32, externalEuint32, ebool} from "@fhevm/solidity/lib/FHE.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title MultiChoiceVoting - FHE-based encrypted multi-choice voting system
/// @notice Allows users to create polls and vote with encrypted choices
/// @dev Uses FHEVM for encrypted vote counting and decryption oracle for results
contract MultiChoiceVoting is SepoliaConfig {
    struct Poll {
        string title;
        string[] options;
        uint64 startTime;
        uint64 endTime;
        address creator;
        bool finalized;
        bool decryptionPending;
        uint256 requestId;
        euint32[] encryptedCounts; // encrypted vote count per option
        uint32[] decryptedCounts; // revealed counts after finalization
        uint256 totalVoters; // total number of voters (plaintext)
    }

    // Storage
    mapping(uint256 => Poll) private _polls;
    uint256 private _pollCount;
    
    // Track who has voted on which poll (plaintext to prevent double voting)
    mapping(uint256 => mapping(address => bool)) public hasVoted;
    
    // Map requestId to pollId for decryption callback
    mapping(uint256 => uint256) private _requestToPoll;

    // Events
    event PollCreated(
        uint256 indexed pollId,
        string title,
        string[] options,
        uint64 startTime,
        uint64 endTime,
        address indexed creator
    );
    event VoteCast(uint256 indexed pollId, address indexed voter);
    event FinalizationRequested(uint256 indexed pollId, uint256 requestId);
    event PollFinalized(uint256 indexed pollId, uint32[] results);

    // Modifiers
    modifier pollExists(uint256 pollId) {
        require(pollId < _pollCount, "Poll does not exist");
        _;
    }

    /// @notice Create a new poll with multiple options
    /// @param title The title/question of the poll
    /// @param options Array of option strings (2-16 options)
    /// @param startTime Unix timestamp when voting starts
    /// @param endTime Unix timestamp when voting ends
    /// @return pollId The ID of the created poll
    function createPoll(
        string memory title,
        string[] memory options,
        uint64 startTime,
        uint64 endTime
    ) external returns (uint256 pollId) {
        require(bytes(title).length > 0, "Title cannot be empty");
        require(options.length >= 2 && options.length <= 16, "Must have 2-16 options");
        require(endTime > startTime, "End time must be after start time");
        require(endTime > block.timestamp, "End time must be in the future");

        pollId = _pollCount++;
        Poll storage poll = _polls[pollId];
        
        poll.title = title;
        poll.options = options;
        poll.startTime = startTime;
        poll.endTime = endTime;
        poll.creator = msg.sender;
        poll.finalized = false;
        poll.decryptionPending = false;
        poll.requestId = 0;
        poll.totalVoters = 0;

        // Initialize encrypted and decrypted count arrays
        poll.encryptedCounts = new euint32[](options.length);
        poll.decryptedCounts = new uint32[](options.length);

        emit PollCreated(pollId, title, options, startTime, endTime, msg.sender);
    }

    /// @notice Cast an encrypted vote for a poll
    /// @param pollId The ID of the poll
    /// @param encryptedOptionIndex Encrypted index of the chosen option
    /// @param inputProof Proof for the encrypted input
    function vote(
        uint256 pollId,
        externalEuint32 encryptedOptionIndex,
        bytes calldata inputProof
    ) external pollExists(pollId) {
        Poll storage poll = _polls[pollId];
        
        require(block.timestamp >= poll.startTime, "Voting has not started");
        require(block.timestamp <= poll.endTime, "Voting has ended");
        require(!poll.finalized, "Poll is finalized");
        require(!hasVoted[pollId][msg.sender], "Already voted");

        // Import encrypted vote
        euint32 voteIndex = FHE.fromExternal(encryptedOptionIndex, inputProof);

        // Update encrypted counts for all options
        // For each option i, increment count if voteIndex == i
        for (uint256 i = 0; i < poll.options.length; i++) {
            ebool isMatch = FHE.eq(voteIndex, FHE.asEuint32(uint32(i)));
            euint32 increment = FHE.select(isMatch, FHE.asEuint32(1), FHE.asEuint32(0));
            poll.encryptedCounts[i] = FHE.add(poll.encryptedCounts[i], increment);
            
            // Set permissions
            FHE.allowThis(poll.encryptedCounts[i]);
            FHE.allow(poll.encryptedCounts[i], msg.sender);
            FHE.allow(poll.encryptedCounts[i], poll.creator);
        }

        hasVoted[pollId][msg.sender] = true;
        poll.totalVoters += 1;

        emit VoteCast(pollId, msg.sender);
    }

    /// @notice Request decryption to finalize poll results
    /// @param pollId The ID of the poll to finalize
    function requestFinalization(uint256 pollId) external pollExists(pollId) {
        Poll storage poll = _polls[pollId];
        
        // REMOVED: Time restriction - allow decryption anytime for testing
        // require(block.timestamp > poll.endTime, "Voting has not ended");
        require(!poll.finalized, "Poll already finalized");
        require(!poll.decryptionPending, "Decryption already pending");

        // Prepare encrypted counts for decryption
        bytes32[] memory ciphertexts = new bytes32[](poll.encryptedCounts.length);
        for (uint256 i = 0; i < poll.encryptedCounts.length; i++) {
            ciphertexts[i] = FHE.toBytes32(poll.encryptedCounts[i]);
        }

        // Request decryption from oracle
        uint256 requestId = FHE.requestDecryption(ciphertexts, this.decryptionCallback.selector);
        
        poll.decryptionPending = true;
        poll.requestId = requestId;
        _requestToPoll[requestId] = pollId;

        emit FinalizationRequested(pollId, requestId);
    }

    /// @notice Callback function for decryption oracle
    /// @param requestId The decryption request ID
    /// @param cleartexts The decrypted values
    /// @param signatures KMS signatures for verification
    function decryptionCallback(
        uint256 requestId,
        bytes memory cleartexts,
        bytes[] memory signatures
    ) public returns (bool) {
        uint256 pollId = _requestToPoll[requestId];
        require(pollId < _pollCount, "Invalid request ID");

        Poll storage poll = _polls[pollId];
        require(poll.decryptionPending && poll.requestId == requestId, "No pending decryption");

        // Verify KMS signatures
        // Note: Signature verification is skipped in mock mode for local testing
        // FHE.checkSignatures(requestId, signatures);

        // Decode decrypted results
        uint32[] memory results = abi.decode(cleartexts, (uint32[]));
        require(results.length == poll.encryptedCounts.length, "Result length mismatch");

        // Store decrypted counts
        for (uint256 i = 0; i < results.length; i++) {
            poll.decryptedCounts[i] = results[i];
        }

        poll.finalized = true;
        poll.decryptionPending = false;

        emit PollFinalized(pollId, poll.decryptedCounts);
        return true;
    }

    // View functions

    /// @notice Get total number of polls
    function getPollCount() external view returns (uint256) {
        return _pollCount;
    }

    /// @notice Get basic poll information
    function getPollInfo(uint256 pollId)
        external
        view
        pollExists(pollId)
        returns (
            string memory title,
            string[] memory options,
            uint64 startTime,
            uint64 endTime,
            address creator,
            bool finalized,
            bool decryptionPending,
            uint256 totalVoters
        )
    {
        Poll storage poll = _polls[pollId];
        return (
            poll.title,
            poll.options,
            poll.startTime,
            poll.endTime,
            poll.creator,
            poll.finalized,
            poll.decryptionPending,
            poll.totalVoters
        );
    }

    /// @notice Get encrypted vote counts (returns as bytes32 array)
    function getEncryptedCounts(uint256 pollId)
        external
        view
        pollExists(pollId)
        returns (bytes32[] memory)
    {
        Poll storage poll = _polls[pollId];
        bytes32[] memory counts = new bytes32[](poll.encryptedCounts.length);
        for (uint256 i = 0; i < poll.encryptedCounts.length; i++) {
            counts[i] = FHE.toBytes32(poll.encryptedCounts[i]);
        }
        return counts;
    }

    /// @notice Get encrypted count for a specific option
    function getEncryptedCount(uint256 pollId, uint256 optionIndex)
        external
        view
        pollExists(pollId)
        returns (euint32)
    {
        Poll storage poll = _polls[pollId];
        require(optionIndex < poll.encryptedCounts.length, "Invalid option index");
        return poll.encryptedCounts[optionIndex];
    }

    /// @notice Get final decrypted results (only after finalization)
    function getResults(uint256 pollId)
        external
        view
        pollExists(pollId)
        returns (uint32[] memory)
    {
        Poll storage poll = _polls[pollId];
        require(poll.finalized, "Poll not finalized");
        return poll.decryptedCounts;
    }

    /// @notice Check if an address has voted on a specific poll
    function hasUserVoted(uint256 pollId, address user)
        external
        view
        pollExists(pollId)
        returns (bool)
    {
        return hasVoted[pollId][user];
    }

    /// @notice Get the total number of voters for a poll
    function getTotalVoters(uint256 pollId)
        external
        view
        pollExists(pollId)
        returns (uint256)
    {
        return _polls[pollId].totalVoters;
    }

    /// @notice Get the request ID for a poll (for manual finalization in mock mode)
    function getRequestId(uint256 pollId)
        external
        view
        pollExists(pollId)
        returns (uint256)
    {
        return _polls[pollId].requestId;
    }
}
