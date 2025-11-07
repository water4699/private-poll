import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { sepolia } from "wagmi/chains";
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

export const config = getDefaultConfig({
  appName: "FHE Multi-Choice Voting",
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "dummy-project-id-for-testing",
  chains: [hardhatLocal, sepolia],
  ssr: true,
});

