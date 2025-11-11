"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useAccount } from "wagmi";

interface FhevmContextType {
  fhevm: any | null;
  isReady: boolean;
  error: string | null;
}

const FhevmContext = createContext<FhevmContextType>({
  fhevm: null,
  isReady: false,
  error: null,
});

export function FhevmProvider({ children }: { children: React.ReactNode }) {
  const [fhevm, setFhevm] = useState<any | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { address, chain, isConnected } = useAccount();

  useEffect(() => {
    const initFhevm = async () => {
      try {
        console.log("[FHEVM] Initializing...", { isConnected, address, chainId: chain?.id });

        // Reset state if wallet is disconnected
        if (!isConnected || !address || !chain) {
          setFhevm(null);
          setIsReady(false);
          setError(null);
          console.log("[FHEVM] Wallet not connected, skipping initialization");
          return;
        }

        // Check if window.ethereum is available
        if (typeof window === "undefined" || !window.ethereum) {
          setError("MetaMask or Web3 wallet not detected");
          setIsReady(false);
          console.error("[FHEVM] window.ethereum not available");
          return;
        }

        // For localhost, we need to use Mock mode
        if (chain.id === 31337) {
          console.log("[FHEVM] Loading Mock SDK for localhost...");
          // Import Mock utilities for local development
          const { MockFhevmInstance } = await import("@fhevm/mock-utils");
          const { JsonRpcProvider } = await import("ethers");
          
          const provider = new JsonRpcProvider("http://127.0.0.1:8545");
          
          console.log("[FHEVM] Creating Mock instance...");
          // Create mock instance for local Hardhat node
          // Using addresses from fhevmTemp/precompiled-fhevm-core-contracts-addresses.json
          const sdk = await MockFhevmInstance.create(provider, provider, {
            chainId: 31337,
            gatewayChainId: 55815,
            aclContractAddress: "0x50157CFfD6bBFA2DECe204a89ec419c23ef5755D",
            inputVerifierContractAddress: "0x901F8942346f7AB3a01F6D7613119Bca447Bb030",
            kmsContractAddress: "0x1364cBBf2cDF5032C47d8226a6f6FBD2AFCDacAC",
            verifyingContractAddressDecryption: "0x5ffdaAB0373E62E2ea2944776209aEf29E631A64",
            verifyingContractAddressInputVerification: "0x812b06e1CDCE800494b79fFE4f925A504a9A9810",
          });
          
          console.log("[FHEVM] ✅ Mock instance created successfully");
          setFhevm(sdk);
          setIsReady(true);
          setError(null);
        } else if (chain.id === 11155111) {
          console.log("[FHEVM] Loading Gateway SDK for Sepolia testnet...");
          // For Sepolia testnet, use Gateway (more stable than Relayer)
          const { createInstance } = await import("@zama-fhe/relayer-sdk/web");

          console.log("[FHEVM] Creating Gateway instance with Sepolia config...");
          const sdk = await createInstance({
            chainId: 11155111,
            network: window.ethereum,
            gatewayUrl: "https://gateway.sepolia.zama.ai/",
            aclContractAddress: "0x4fCBEB62ea8720ff23767a7d9a827eC4d67c6fd1",
          });
          
          console.log("[FHEVM] ✅ Gateway instance created successfully");
          setFhevm(sdk);
          setIsReady(true);
          setError(null);
        } else {
          console.log("[FHEVM] Unsupported chain:", chain.id);
          setError(`Unsupported network (Chain ID: ${chain.id}). Please use Localhost (31337) or Sepolia (11155111).`);
          setFhevm(null);
          setIsReady(false);
        }
      } catch (err) {
        console.error("[FHEVM] ❌ Initialization failed:", err);
        setError(err instanceof Error ? err.message : "Failed to initialize FHEVM");
        setFhevm(null);
        setIsReady(false);
      }
    };

    initFhevm();
  }, [address, chain, isConnected]);

  return (
    <FhevmContext.Provider value={{ fhevm, isReady, error }}>
      {children}
    </FhevmContext.Provider>
  );
}

export function useFhevm() {
  const context = useContext(FhevmContext);
  if (context === undefined) {
    throw new Error("useFhevm must be used within FhevmProvider");
  }
  return context;
}

