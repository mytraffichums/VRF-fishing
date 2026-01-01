"use client";

import { useState, useEffect, useCallback } from "react";
import {
  useAccount,
  useBalance,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
  useSwitchChain,
} from "wagmi";
import { usePrivy, useLogin, useLogout } from "@privy-io/react-auth";
import { parseEventLogs } from "viem";
import {
  RANDOM_NUMBER_CONTRACT_ADDRESS,
  RANDOM_NUMBER_ABI,
  ZERO_BYTES32,
} from "@/lib/contracts/randomNumber";
import { monadTestnet } from "@/lib/wagmi";

const POLLING_INTERVAL_MS = 2000;

export function useBlockchainFishing() {
  const { address, isConnected, chain } = useAccount();
  const { ready, authenticated } = usePrivy();
  const { login } = useLogin();
  const { logout } = useLogout();
  const { switchChain, isPending: isSwitching } = useSwitchChain();

  const [mounted, setMounted] = useState(false);
  const [sequenceNumber, setSequenceNumber] = useState<bigint | null>(null);
  const [isPolling, setIsPolling] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isWrongNetwork =
    mounted && ready && authenticated && isConnected && chain?.id !== monadTestnet.id;
  const isReady = mounted && ready && authenticated && isConnected && !isWrongNetwork;

  // Read wallet balance
  const { data: balanceData } = useBalance({
    address: address,
    query: {
      enabled: isReady,
    },
  });

  // Read the fee
  const { data: fee } = useReadContract({
    address: RANDOM_NUMBER_CONTRACT_ADDRESS,
    abi: RANDOM_NUMBER_ABI,
    functionName: "getFee",
  });

  // Write contract
  const {
    writeContract,
    data: txHash,
    isPending: isWritePending,
    error: writeError,
    reset: resetWrite,
  } = useWriteContract();

  // Wait for transaction
  const { data: receipt, isLoading: isConfirming } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  // Poll for random number result
  const { data: randomResult, refetch: refetchRandom } = useReadContract({
    address: RANDOM_NUMBER_CONTRACT_ADDRESS,
    abi: RANDOM_NUMBER_ABI,
    functionName: "randomNumbers",
    args: sequenceNumber ? [sequenceNumber] : undefined,
    query: {
      enabled: sequenceNumber !== null,
    },
  });

  // Extract sequence number from receipt
  useEffect(() => {
    if (receipt) {
      const logs = parseEventLogs({
        abi: RANDOM_NUMBER_ABI,
        logs: receipt.logs,
        eventName: "RandomNumberRequested",
      });
      if (logs.length > 0) {
        setSequenceNumber(logs[0].args.sequenceNumber);
        setIsPolling(true);
      }
    }
  }, [receipt]);

  // Poll for result
  useEffect(() => {
    if (!isPolling || !sequenceNumber) return;

    const interval = setInterval(() => {
      refetchRandom();
    }, POLLING_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [isPolling, sequenceNumber, refetchRandom]);

  // Check if we have a result
  const hasResult = randomResult && randomResult !== ZERO_BYTES32;

  // Stop polling when we get a result
  useEffect(() => {
    if (hasResult && isPolling) {
      setIsPolling(false);
    }
  }, [hasResult, isPolling]);

  // Request random number
  const requestRandom = useCallback(() => {
    if (!fee) return;
    resetWrite();
    setSequenceNumber(null);
    writeContract({
      address: RANDOM_NUMBER_CONTRACT_ADDRESS,
      abi: RANDOM_NUMBER_ABI,
      functionName: "requestRandomNumber",
      value: fee,
    });
  }, [fee, writeContract, resetWrite]);

  // Reset state
  const reset = useCallback(() => {
    resetWrite();
    setSequenceNumber(null);
    setIsPolling(false);
  }, [resetWrite]);

  return {
    // Auth state
    mounted,
    isReady,
    isWrongNetwork,
    address,
    authenticated,
    balance: balanceData,

    // Auth actions
    login,
    logout,
    switchChain: () => switchChain({ chainId: monadTestnet.id }),
    isSwitching,

    // Blockchain state
    fee,
    sequenceNumber,
    randomResult: hasResult ? (randomResult as string) : null,
    isLoading: isWritePending || isConfirming || isPolling,
    isWritePending,
    isConfirming,
    isPolling,
    writeError,

    // Actions
    requestRandom,
    reset,
  };
}

// Generate pseudo-random for practice mode
export function generatePracticeRandom(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return (
    "0x" +
    Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
  );
}
