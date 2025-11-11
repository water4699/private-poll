"use client";

import { createContext, useContext, ReactNode } from "react";
import { useAccount, useWalletClient } from "wagmi";
import { useFhevm, FhevmGoState } from "@/fhevm/useFhevm";
import type { FhevmInstance } from "@/fhevm/fhevmTypes";

interface FhevmContextType {
  instance: FhevmInstance | undefined;
  isReady: boolean;
  error: Error | undefined;
  status: FhevmGoState;
  refresh: () => void;
}

const FhevmContext = createContext<FhevmContextType | undefined>(undefined);

export function FhevmProvider({ children }: { children: ReactNode }) {
  const { chain, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();

  // Use CDN-based FHEVM with wagmi provider
  const { instance, error, status, refresh } = useFhevm({
    provider: typeof window !== 'undefined' ? window.ethereum : undefined,
    chainId: chain?.id,
    enabled: isConnected,
    initialMockChains: {
      31337: "http://localhost:8545",
    },
  });

  const isReady = status === "ready";

  console.log('[FhevmProvider]', {
    isConnected,
    chainId: chain?.id,
    status,
    isReady,
    hasInstance: !!instance,
    error: error?.message,
  });

  return (
    <FhevmContext.Provider value={{ instance, isReady, error, status, refresh }}>
      {children}
    </FhevmContext.Provider>
  );
}

export function useFhevmContext() {
  const context = useContext(FhevmContext);
  if (context === undefined) {
    throw new Error("useFhevmContext must be used within FhevmProvider");
  }
  return context;
}

