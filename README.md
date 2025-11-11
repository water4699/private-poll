# FHE Multi-Choice Voting System

A privacy-preserving voting platform built with Fully Homomorphic Encryption (FHE) using Zama's fhEVM technology.

## 🚀 Live Demo

**Deployed Application**: [https://private-poll-mu.vercel.app/](https://private-poll-mu.vercel.app/)

📹 **Demo Video**: [Watch the demo](./private-pool.mp4)

## Features

- **Fully Encrypted Voting**: All votes are encrypted using FHE technology, ensuring complete privacy
- **Multi-Choice Polls**: Create polls with 2-16 options
- **Transparent Results**: Cryptographically verified results after finalization
- **User-Friendly Interface**: Modern, responsive UI with Rainbow Kit wallet integration
- **End-to-End Encryption**: Data encryption and decryption loop with smart contract integration

## 🔐 Core Smart Contract

### MultiChoiceVoting.sol

The main contract implements fully encrypted voting using Zama's FHEVM:

```solidity
contract MultiChoiceVoting is SepoliaConfig {
    struct Poll {
        address creator;
        string question;
        string[] options;
        euint8[] voteCounts;     // Encrypted vote counts
        uint256 endTime;
        bool finalized;
        uint8[] results;         // Decrypted results (after finalization)
    }
    
    mapping(uint256 => Poll) public polls;
    mapping(uint256 => mapping(address => bool)) public hasVoted;
    
    // Create a new encrypted poll
    function createPoll(
        string memory question,
        string[] memory options,
        uint256 duration
    ) external returns (uint256 pollId);
    
    // Submit encrypted vote
    function vote(
        uint256 pollId,
        bytes32 encryptedVoteHandle,
        bytes calldata encryptedVoteProof
    ) external;
    
    // Finalize and decrypt results
    function finalizePoll(uint256 pollId) external;
}
```

**Key Privacy Features:**
- ✅ Vote counts remain encrypted during voting period
- ✅ Individual votes are never revealed
- ✅ Homomorphic addition of encrypted votes
- ✅ Results only decrypted after poll finalization

## 🔒 Encryption & Decryption Flow

### Client-Side Encryption

Before submitting a vote, the frontend encrypts the user's choice:

```typescript
// 1. Initialize FHEVM instance
const fhevmInstance = await createInstance({
  chainId: sepoliaChainId,
  publicKey: await contract.getPublicKey()
});

// 2. Encrypt the vote option (0-15 for multi-choice)
const encryptedInput = await fhevmInstance.createEncryptedInput(
  contractAddress,
  userAddress
);
encryptedInput.add8(voteOption);  // Encrypt as euint8
const encryptedVote = await encryptedInput.encrypt();

// 3. Submit encrypted vote to contract
await contract.vote(
  pollId,
  encryptedVote.handles[0],    // Encrypted handle
  encryptedVote.inputProof      // Zero-knowledge proof
);
```

### On-Chain Homomorphic Operations

The smart contract performs operations on encrypted data without decryption:

```solidity
// Import encrypted vote from user
euint8 encryptedVote = FHE.asEuint8(encryptedVoteHandle, encryptedVoteProof);

// Validate vote is within valid range (0 to optionCount-1)
ebool isValid = FHE.lt(encryptedVote, FHE.asEuint8(uint8(poll.options.length)));

// Homomorphically increment the vote count for selected option
euint8 increment = FHE.select(isValid, FHE.asEuint8(1), FHE.asEuint8(0));
poll.voteCounts[i] = FHE.add(poll.voteCounts[i], 
    FHE.select(FHE.eq(encryptedVote, FHE.asEuint8(uint8(i))), increment, FHE.asEuint8(0))
);
```

### Decryption After Finalization

Only after the poll ends can results be decrypted:

```solidity
function finalizePoll(uint256 pollId) external {
    require(block.timestamp >= poll.endTime, "Poll not ended");
    require(!poll.finalized, "Already finalized");
    
    // Decrypt all vote counts
    for (uint256 i = 0; i < poll.voteCounts.length; i++) {
        poll.results[i] = FHE.decrypt(poll.voteCounts[i]);
    }
    
    poll.finalized = true;
}
```

### Privacy Guarantees

| Data | During Voting | After Finalization |
|------|--------------|-------------------|
| **Individual Votes** | ✅ Encrypted (`euint8`) | ✅ Never revealed |
| **Vote Counts** | ✅ Encrypted (`euint8[]`) | ❌ Decrypted to `uint8[]` |
| **User Participation** | ⚠️ Public (address recorded) | ⚠️ Public |
| **Homomorphic Operations** | ✅ Add/Compare without decryption | N/A |

### Key Homomorphic Operations

```solidity
// 1. Encrypted comparison
ebool isEqual = FHE.eq(encryptedVote, FHE.asEuint8(optionIndex));

// 2. Encrypted addition
euint8 newCount = FHE.add(currentCount, increment);

// 3. Conditional selection
euint8 result = FHE.select(condition, valueIfTrue, valueIfFalse);

// 4. Less-than comparison
ebool isLessThan = FHE.lt(encryptedVote, maxOptions);
```

## Tech Stack

### Backend
- **Solidity**: Smart contracts using fhEVM
- **Hardhat**: Development environment
- **TypeScript**: Testing and deployment scripts

### Frontend
- **Next.js 15**: React framework with App Router
- **Rainbow Kit**: Wallet connection
- **Wagmi**: Ethereum interactions
- **Tailwind CSS**: Styling
- **Zama Relayer SDK**: FHE operations

## Project Structure

```
private-poll/
├── contracts/              # Solidity smart contracts
│   └── MultiChoiceVoting.sol
├── test/                   # Test files
│   ├── MultiChoiceVoting.ts
│   └── MultiChoiceVotingSepolia.ts
├── deploy/                 # Deployment scripts
│   └── deploy.ts
├── tasks/                  # Hardhat tasks
│   ├── accounts.ts
│   └── MultiChoiceVoting.ts
├── frontend/               # Next.js frontend
│   ├── app/               # App router pages
│   ├── components/        # React components
│   ├── hooks/             # Custom hooks
│   ├── config/            # Configuration
│   └── abi/               # Contract ABIs (auto-generated)
└── hardhat.config.ts      # Hardhat configuration
```

## Getting Started

### Prerequisites

- Node.js >= 20
- npm >= 7.0.0
- MetaMask or compatible Web3 wallet

### Installation

1. **Install backend dependencies:**
```bash
cd private-poll
npm install
```

2. **Install frontend dependencies:**
```bash
cd frontend
npm install
```

### Setup

1. **Configure Hardhat:**
```bash
npx hardhat vars setup
```

Set the following variables:
- `MNEMONIC`: Your wallet mnemonic
- `INFURA_API_KEY`: Infura API key for Sepolia
- `ETHERSCAN_API_KEY`: (Optional) For contract verification

2. **Update WalletConnect Project ID:**

Edit `frontend/config/wagmi.ts` and add your WalletConnect project ID:
```typescript
projectId: "YOUR_PROJECT_ID", // Get from https://cloud.walletconnect.com
```

### Local Development

1. **Start local Hardhat node:**
```bash
npx hardhat node
```

2. **Deploy contracts (in another terminal):**
```bash
npx hardhat deploy --network localhost
```

3. **Generate ABI and start frontend:**
```bash
cd frontend
npm run dev
```

4. **Open browser:**
Navigate to `http://localhost:3000`

### Testing

**Run local tests:**
```bash
npm test
```

**Run Sepolia tests:**
```bash
npm run test:sepolia
```

### Deployment

**Deploy to Sepolia:**
```bash
npm run deploy:sepolia
```

After deployment, the frontend will automatically use the deployed contract address.

## Usage

### Creating a Poll

1. Connect your wallet using the button in the top-right corner
2. Click "Create New Poll"
3. Enter poll title and options (2-16 options)
4. Select voting duration
5. Submit transaction to create the poll

### Voting

1. Browse active polls
2. Select your choice (encrypted locally)
3. Click "Cast Vote" to submit encrypted vote
4. Your vote is recorded on-chain but remains private

### Viewing Results

1. After voting period ends, anyone can request finalization
2. Click "Finalize Poll" to trigger decryption
3. Decryption oracle processes encrypted votes
4. Click "Show Results" to view final vote counts

## Smart Contract

### MultiChoiceVoting.sol

Main contract functions:

- `createPoll(title, options, startTime, endTime)`: Create a new poll
- `vote(pollId, encryptedOptionIndex, inputProof)`: Cast encrypted vote
- `requestFinalization(pollId)`: Request result decryption
- `getPollInfo(pollId)`: Get poll information
- `getResults(pollId)`: Get decrypted results (after finalization)
- `hasUserVoted(pollId, user)`: Check if user has voted

## Security Features

- **FHE Encryption**: Votes are encrypted on-chain and computed homomorphically
- **Single Vote**: Each address can only vote once per poll
- **Verifiable Results**: KMS signatures verify decryption authenticity
- **Time-Locked**: Polls have defined voting periods

## Hardhat Tasks

```bash
# Create a poll
npx hardhat task:createPoll --title "Test Poll" --options "A,B,C" --duration 3600 --network localhost

# Get poll info
npx hardhat task:getPollInfo --pollid 0 --network localhost

# Get poll count
npx hardhat task:getPollCount --network localhost

# Request finalization
npx hardhat task:requestFinalization --pollid 0 --network localhost

# Get results
npx hardhat task:getResults --pollid 0 --network localhost
```

## Development Notes

- Frontend uses Rainbow Kit for wallet connections (positioned top-right)
- All code and documentation in English
- Custom logo and favicon included
- Supports both localhost and Sepolia testnet
- Full MVP with data submission, viewing, and decryption loop

## License

BSD-3-Clause-Clear

## Resources

- [Zama fhEVM Documentation](https://docs.zama.ai/fhevm)
- [Rainbow Kit Documentation](https://www.rainbowkit.com/)
- [Hardhat Documentation](https://hardhat.org/)
- [Next.js Documentation](https://nextjs.org/)

## Support

For issues and questions, please open an issue on GitHub.

