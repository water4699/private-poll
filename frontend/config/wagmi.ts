import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { defineChain } from "viem";

// Define custom localhost chain with correct Chain ID (31337)
const hardhatLocal = defineChain({
  id: 31337,
  name: "Localhost",
  nativeCurrency: {
    name: "Ether",
    symbol: "ETH",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ["http://127.0.0.1:8545"],
    },
  },
  testnet: true,
});

// Define custom Sepolia chain with explicit Infura RPC URL
const sepoliaCustom = defineChain({
  id: 11155111,
  name: "Sepolia",
  nativeCurrency: {
    name: "Sepolia Ether",
    symbol: "ETH",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [
        // Explicitly use Infura RPC endpoint
        process.env.NEXT_PUBLIC_INFURA_API_KEY
          ? `https://sepolia.infura.io/v3/${process.env.NEXT_PUBLIC_INFURA_API_KEY}`
          : "https://ethereum-sepolia-rpc.publicnode.com",
      ],
    },
    public: {
      http: [
        // Fallback public endpoints
        "https://ethereum-sepolia-rpc.publicnode.com",
        "https://rpc.sepolia.org",
      ],
    },
  },
  blockExplorers: {
    default: {
      name: "Etherscan",
      url: "https://sepolia.etherscan.io",
    },
  },
  testnet: true,
});

export const config = getDefaultConfig({
  appName: "FHE Multi-Choice Voting",
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "dummy-project-id-for-testing",
  chains: [hardhatLocal, sepoliaCustom],
  ssr: true,
});

