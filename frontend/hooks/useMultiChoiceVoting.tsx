"use client";

import { useState, useCallback, useMemo } from "react";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { hexlify } from "ethers";
import { useFhevmContext } from "./useFhevmProvider";
import { CONTRACT_ADDRESSES } from "@/config/contract";
import { MultiChoiceVotingABI } from "@/abi/MultiChoiceVotingABI";

export function useMultiChoiceVoting() {
  const { address, chain, isConnected } = useAccount();
  const { instance: fhevm, isReady: fhevmReady, error: fhevmError } = useFhevmContext();
  const { writeContractAsync } = useWriteContract();
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get contract address based on chain ID
  const contractAddress = useMemo<`0x${string}` | null>(() => {
    if (!chain) return null;
    if (chain.id === 31337) return CONTRACT_ADDRESSES.localhost as `0x${string}`;
    if (chain.id === 11155111) return CONTRACT_ADDRESSES.sepolia as `0x${string}`;
    return null;
  }, [chain]);

  // Create Poll
  const createPoll = useCallback(
    async (
      title: string,
      options: string[],
      startTime: number,
      endTime: number
    ) => {
      if (!contractAddress || !isConnected) {
        throw new Error("Wallet not connected or contract not available");
      }

      try {
        setIsLoading(true);
        setError(null);

        const hash = await writeContractAsync({
          address: contractAddress,
          abi: MultiChoiceVotingABI,
          functionName: "createPoll",
          args: [title, options, BigInt(startTime), BigInt(endTime)],
        });

        return hash;
      } catch (err: any) {
        const errorMsg = err.message || "Failed to create poll";
        setError(errorMsg);
        throw new Error(errorMsg);
      } finally {
        setIsLoading(false);
      }
    },
    [contractAddress, isConnected, writeContractAsync]
  );

  // Vote
  const vote = useCallback(
    async (pollId: number, optionIndex: number) => {
      if (!contractAddress || !fhevm || !isConnected || !address) {
        throw new Error("Wallet not connected or FHEVM not ready");
      }

      try {
        setIsLoading(true);
        setError(null);

        // Create encrypted input
        const input = fhevm.createEncryptedInput(contractAddress, address);
        input.add32(optionIndex);
        const encryptedInput = await input.encrypt();

        // Convert Uint8Array to hex string for wagmi
        const encryptedChoice = hexlify(encryptedInput.handles[0]) as `0x${string}`;
        const proof = hexlify(encryptedInput.inputProof) as `0x${string}`;

        console.log("[Vote] Encrypted input:", {
          encryptedChoice,
          proof,
          choiceLength: encryptedChoice.length,
          proofLength: proof.length,
        });

        // Submit vote
        const hash = await writeContractAsync({
          address: contractAddress,
          abi: MultiChoiceVotingABI,
          functionName: "vote",
          args: [BigInt(pollId), encryptedChoice, proof],
        });

        return hash;
      } catch (err: any) {
        const errorMsg = err.message || "Failed to vote";
        setError(errorMsg);
        throw new Error(errorMsg);
      } finally {
        setIsLoading(false);
      }
    },
    [contractAddress, fhevm, isConnected, address, writeContractAsync]
  );

  // Request finalization (with auto-decryption in mock mode)
  const requestFinalization = useCallback(
    async (pollId: number) => {
      // Debug: Log all conditions
      console.log("[Finalization] Checking prerequisites:", {
        contractAddress: !!contractAddress,
        isConnected,
        fhevm: !!fhevm,
        fhevmReady,
        address: !!address,
        chain: chain?.id,
      });

      if (!contractAddress) {
        throw new Error("Contract address not found");
      }
      if (!isConnected || !address) {
        throw new Error("Wallet not connected");
      }
      if (!fhevm || !fhevmReady) {
        throw new Error("FHEVM not ready. Please wait a few seconds and try again.");
      }

      try {
        setIsLoading(true);
        setError(null);

        console.log(`[Finalization] Starting for Poll #${pollId}...`);

        // Step 1: Request finalization
        const hash = await writeContractAsync({
          address: contractAddress,
          abi: MultiChoiceVotingABI,
          functionName: "requestFinalization",
          args: [BigInt(pollId)],
        });

        console.log(`[Finalization] Request submitted: ${hash}`);

        // Wait for transaction confirmation
        const { waitForTransactionReceipt } = await import("wagmi/actions");
        const { config } = await import("@/config/wagmi");
        await waitForTransactionReceipt(config, { hash });

        console.log(`[Finalization] Request confirmed`);

        // Step 2: For localhost (mock mode), auto-complete decryption
        if (chain?.id === 31337) {
          console.log(`[Finalization] Mock mode - auto-decrypting...`);

          // Read contract to get encrypted counts
          const { readContract } = await import("wagmi/actions");
          
          const encryptedCounts = await readContract(config, {
            address: contractAddress,
            abi: MultiChoiceVotingABI,
            functionName: "getEncryptedCounts",
            args: [BigInt(pollId)],
          }) as any[];

          console.log(`[Finalization] Found ${encryptedCounts.length} encrypted counts`);

          // Decrypt all counts at once using Mock SDK
          // Generate a keypair for decryption
          const keypair = fhevm.generateKeypair();
          
          // Prepare all handles for batch decryption
          const handleContractPairs = encryptedCounts.map(handle => ({
            handle: handle,
            contractAddress: contractAddress,
          }));

          const startTimeStamp = Math.floor(Date.now() / 1000).toString();
          const durationDays = "10";
          const contractAddresses = [contractAddress];

          // Create EIP712 signature request (once for all handles)
          const eip712 = fhevm.createEIP712(
            keypair.publicKey,
            contractAddresses,
            startTimeStamp,
            durationDays
          );

          console.log(`[Finalization] Requesting signature for batch decryption...`);

          // Sign the message using wallet (only once!)
          const { signTypedData } = await import("wagmi/actions");
          const signature = await signTypedData(config, {
            domain: {
              ...eip712.domain,
              verifyingContract: eip712.domain.verifyingContract as `0x${string}`,
            },
            types: eip712.types as any,
            primaryType: 'UserDecryptRequestVerification',
            message: eip712.message,
          });

          console.log(`[Finalization] Signature received, decrypting...`);

          // Decrypt all handles at once
          const result = await fhevm.userDecrypt(
            handleContractPairs,
            keypair.privateKey,
            keypair.publicKey,
            signature.replace("0x", ""),
            contractAddresses,
            address,
            startTimeStamp,
            durationDays,
          );

          // Extract decrypted values
          const decryptedCounts: number[] = [];
          for (let i = 0; i < encryptedCounts.length; i++) {
            const decrypted = result[encryptedCounts[i]];
            decryptedCounts.push(Number(decrypted));
            console.log(`[Finalization] Option ${i}: ${decrypted} votes`);
          }

          // Get request ID
          const requestId = await readContract(config, {
            address: contractAddress,
            abi: MultiChoiceVotingABI,
            functionName: "getRequestId",
            args: [BigInt(pollId)],
          }) as bigint;

          console.log(`[Finalization] Request ID: ${requestId}`);

          // Encode decrypted results
          const { AbiCoder } = await import("ethers");
          const abiCoder = AbiCoder.defaultAbiCoder();
          const cleartexts = abiCoder.encode(["uint32[]"], [decryptedCounts]) as `0x${string}`;

          console.log(`[Finalization] Calling decryption callback...`);

          // Call decryption callback
          const callbackHash = await writeContractAsync({
            address: contractAddress,
            abi: MultiChoiceVotingABI,
            functionName: "decryptionCallback",
            args: [requestId, cleartexts, []],
          });

          console.log(`[Finalization] Callback submitted: ${callbackHash}`);

          // Wait for callback confirmation
          await waitForTransactionReceipt(config, { hash: callbackHash });

          console.log(`[Finalization] ✅ Decryption complete!`);
        } else {
          console.log(`[Finalization] Testnet mode - waiting for oracle...`);
        }

        return hash;
      } catch (err: any) {
        console.error("[Finalization] Error:", err);
        const errorMsg = err.message || "Failed to request finalization";
        setError(errorMsg);
        throw new Error(errorMsg);
      } finally {
        setIsLoading(false);
      }
    },
    [contractAddress, isConnected, fhevm, address, chain, writeContractAsync]
  );

  return {
    // Connection state
    isConnected,
    address,
    chainId: chain?.id,
    contractAddress,

    // FHEVM state
    fhevmReady,
    fhevmError,

    // Contract functions
    createPoll,
    vote,
    requestFinalization,

    // Loading state
    isLoading,
    error,
  };
}
