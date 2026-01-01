"use client";

import { useRef, useEffect, useCallback, useState } from "react";
import { useSendTransaction, useWaitForTransactionReceipt } from "wagmi";
import { parseEther, isAddress } from "viem";
import { useGameState } from "./hooks/useGameState";
import { useGameLoop } from "./hooks/useGameLoop";
import {
  useBlockchainFishing,
  generatePracticeRandom,
} from "./hooks/useBlockchainFishing";
import { CanvasRenderer } from "./renderer/CanvasRenderer";
import { TIMING, UI_RARITY_COLORS, UI_RARITY_BG, STAKE_OPTIONS, PAYOUT_MULTIPLIERS } from "./constants";
import type { CaughtFish } from "./types";

const BLOCK_EXPLORER_URL = "https://testnet.monadvision.com";

export function FishingGameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<CanvasRenderer | null>(null);
  const castStartTimeRef = useRef<number>(0);
  const requestedRandomRef = useRef<boolean>(false);

  const { state, dispatch } = useGameState();
  const blockchain = useBlockchainFishing();

  const [isHolding, setIsHolding] = useState(false);

  // Send funds modal state
  const [showSendModal, setShowSendModal] = useState(false);
  const [sendTo, setSendTo] = useState("");
  const [sendAmount, setSendAmount] = useState("");
  const [sendError, setSendError] = useState<string | null>(null);

  // Send transaction hook
  const {
    sendTransaction,
    data: sendTxHash,
    isPending: isSendPending,
    error: sendTxError,
    reset: resetSendTx,
  } = useSendTransaction();

  const { isLoading: isSendConfirming, isSuccess: isSendSuccess } = useWaitForTransactionReceipt({
    hash: sendTxHash,
  });

  // Reset modal on successful send
  useEffect(() => {
    if (isSendSuccess) {
      setSendTo("");
      setSendAmount("");
      setSendError(null);
      // Close modal after a brief delay to show success
      setTimeout(() => {
        setShowSendModal(false);
        resetSendTx();
      }, 2000);
    }
  }, [isSendSuccess, resetSendTx]);

  // Handle send transaction
  const handleSend = useCallback(() => {
    setSendError(null);

    if (!isAddress(sendTo)) {
      setSendError("Invalid recipient address");
      return;
    }

    const amount = parseFloat(sendAmount);
    if (isNaN(amount) || amount <= 0) {
      setSendError("Invalid amount");
      return;
    }

    try {
      sendTransaction({
        to: sendTo as `0x${string}`,
        value: parseEther(sendAmount),
      });
    } catch {
      setSendError("Failed to send transaction");
    }
  }, [sendTo, sendAmount, sendTransaction]);

  // Determine if we're in practice mode
  const isPracticeMode = !blockchain.isReady;

  // Check if wallet has insufficient funds for VRF fee (only relevant when logged in)
  const hasInsufficientBalance = !isPracticeMode &&
    blockchain.balance !== undefined &&
    blockchain.fee !== undefined &&
    blockchain.balance.value < blockchain.fee;

  // Refs for game loop to avoid recreating callback every frame
  const stateRef = useRef(state);
  const isHoldingRef = useRef(isHolding);
  const insufficientBalanceRef = useRef(hasInsufficientBalance);
  stateRef.current = state;
  isHoldingRef.current = isHolding;
  insufficientBalanceRef.current = hasInsufficientBalance;

  // Initialize renderer
  useEffect(() => {
    if (canvasRef.current && !rendererRef.current) {
      rendererRef.current = new CanvasRenderer(canvasRef.current);
    }
  }, []);

  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      rendererRef.current?.resize();
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Update practice mode in state
  useEffect(() => {
    dispatch({ type: "SET_PRACTICE_MODE", enabled: isPracticeMode });
  }, [isPracticeMode, dispatch]);

  // Handle input start
  const handleInputStart = useCallback(
    (e: React.PointerEvent | React.TouchEvent) => {
      e.preventDefault();
      setIsHolding(true);

      if (state.state === "idle") {
        // On-chain mode: block if wallet has insufficient funds for VRF fee
        if (!isPracticeMode) {
          const walletBalance = blockchain.balance?.value ?? BigInt(0);
          const requiredFee = blockchain.fee ?? BigInt(0);
          if (walletBalance < requiredFee) {
            return; // Can't play without funds to cover VRF fee
          }
        }
        // Start casting - NO blockchain call yet!
        dispatch({ type: "START_CAST" });
        castStartTimeRef.current = Date.now();
      } else if (state.state === "bite") {
        // Hook the fish!
        dispatch({ type: "START_REELING" });
      } else if (
        (state.state === "caught" || state.state === "escaped") &&
        state.resultTimer <= 0
      ) {
        // Reset for next cast
        dispatch({ type: "RESET" });
        blockchain.reset();
        requestedRandomRef.current = false;
      }
    },
    [state.state, state.resultTimer, isPracticeMode, dispatch, blockchain]
  );

  // Handle input end
  const handleInputEnd = useCallback((e: React.PointerEvent | React.TouchEvent) => {
    e.preventDefault();
    setIsHolding(false);
  }, []);

  // Handle casting animation
  useEffect(() => {
    if (state.state !== "casting") return;

    const interval = setInterval(() => {
      const elapsed = Date.now() - castStartTimeRef.current;
      const progress = Math.min(elapsed / TIMING.CAST_DURATION_MS, 1);
      dispatch({ type: "UPDATE_CAST", progress });

      if (progress >= 1) {
        dispatch({ type: "START_WAITING" });
      }
    }, 16);

    return () => clearInterval(interval);
  }, [state.state, dispatch]);

  // Trigger bite after local random delay (no Pyth yet!)
  useEffect(() => {
    if (state.state !== "waiting") return;

    // Local random delay for bite timing - fish identity determined AFTER successful reel
    const delay = 500 + Math.random() * 1500;
    const timeout = setTimeout(() => {
      dispatch({ type: "START_BITE" });
    }, delay);

    return () => clearTimeout(timeout);
  }, [state.state, dispatch]);

  // When reel succeeds (revealing state), call Pyth to determine fish
  useEffect(() => {
    if (state.state !== "revealing") return;
    if (requestedRandomRef.current) return; // Prevent duplicate requests

    requestedRandomRef.current = true;

    if (isPracticeMode) {
      // Practice mode: generate random immediately
      const random = generatePracticeRandom();
      dispatch({ type: "SET_RANDOM", result: random, sequenceNumber: null });
    } else {
      // On-chain mode: 2 second delay before wallet prompt to prevent accidental dismissal
      const timeout = setTimeout(() => {
        blockchain.requestRandom();
      }, 2000);
      return () => clearTimeout(timeout);
    }
  }, [state.state, isPracticeMode, dispatch, blockchain.requestRandom]);

  // When Pyth returns in revealing state, reveal the fish
  useEffect(() => {
    if (state.state !== "revealing") return;

    // For practice mode, randomResult is set immediately above
    // For on-chain mode, we need to wait for blockchain.randomResult
    if (isPracticeMode && state.randomResult) {
      dispatch({ type: "REVEAL_FISH" });
    } else if (!isPracticeMode && blockchain.randomResult) {
      dispatch({
        type: "SET_RANDOM",
        result: blockchain.randomResult,
        sequenceNumber: blockchain.sequenceNumber,
      });
      dispatch({ type: "REVEAL_FISH" });
    }
  }, [state.state, state.randomResult, isPracticeMode, blockchain.randomResult, blockchain.sequenceNumber, dispatch]);

  // Handle bite timer expiration
  useEffect(() => {
    if (state.state !== "bite") return;

    const interval = setInterval(() => {
      const newTimer = state.biteTimer - 16;
      if (newTimer <= 0) {
        dispatch({ type: "MISS_BITE" });
      }
    }, 16);

    return () => clearInterval(interval);
  }, [state.state, state.biteTimer, dispatch]);

  // Handle waiting timeout
  useEffect(() => {
    if (state.state !== "waiting") return;

    const interval = setInterval(() => {
      dispatch({ type: "UPDATE_WAITING", deltaTime: 16 });

      if (state.waitTimer <= 0) {
        dispatch({ type: "FISH_ESCAPED" });
      }
    }, 16);

    return () => clearInterval(interval);
  }, [state.state, state.waitTimer, dispatch]);

  // Game loop - uses refs to avoid recreating callback every frame
  const gameLoop = useCallback(
    (deltaTime: number) => {
      const currentState = stateRef.current;
      const holding = isHoldingRef.current;

      // Update reeling mechanics
      if (currentState.state === "reeling") {
        dispatch({ type: "UPDATE_REELING", deltaTime, isHolding: holding });
      }

      // Update result timer
      if (currentState.state === "caught" || currentState.state === "escaped") {
        dispatch({ type: "UPDATE_RESULT", deltaTime });
      }

      // Update particles
      if (currentState.splashParticles.length > 0) {
        dispatch({ type: "UPDATE_PARTICLES", deltaTime });
      }

      // Render
      rendererRef.current?.render(currentState, deltaTime, {
        insufficientBalance: insufficientBalanceRef.current,
      });
    },
    [dispatch]
  );

  useGameLoop(gameLoop, true);

  // Calculate stats
  const realCatches = state.catches.filter((c) => !c.isPractice);
  const practiceCatches = state.catches.filter((c) => c.isPractice);

  return (
    <div className="flex justify-center items-center min-h-screen w-full">
      {/* Game Canvas Container */}
      <div className="relative h-[100vh] max-h-[100vh] aspect-[9/16] bg-black overflow-hidden shadow-2xl flex-shrink-0">
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full touch-none"
          style={{ touchAction: "none" }}
          onPointerDown={handleInputStart}
          onPointerUp={handleInputEnd}
          onPointerLeave={handleInputEnd}
          onPointerCancel={handleInputEnd}
          onTouchStart={(e) => e.preventDefault()}
          onTouchMove={(e) => e.preventDefault()}
          onContextMenu={(e) => e.preventDefault()}
        />

        {/* Loading overlay */}
        {blockchain.isLoading && (
          <div className="absolute top-2 left-2 right-2 flex items-center justify-center gap-2 p-2 bg-purple-900/80 rounded-lg">
            <div className="animate-spin h-4 w-4 border-2 border-purple-300 border-t-transparent rounded-full" />
            <span className="text-sm text-purple-200">
              {blockchain.isWritePending
                ? "Confirm in wallet..."
                : blockchain.isConfirming
                  ? "Confirming..."
                  : "Waiting for Pyth..."}
            </span>
          </div>
        )}
      </div>

      {/* Info Panel - Left side */}
      <div className="fixed left-4 top-4 bottom-4 w-80 space-y-4 overflow-y-auto hidden lg:block">
        {/* How to Play */}
        <div className="p-4 bg-gray-800 rounded-lg">
          <h3 className="font-bold text-white text-lg mb-3 flex items-center gap-2">
            <span className="text-2xl">🎣</span> How to Play
          </h3>
          <div className="space-y-3 text-sm text-gray-300">
            <div className="flex gap-2">
              <span className="text-blue-400 font-bold">1.</span>
              <p><span className="text-white font-medium">Tap to Cast</span> — Your line flies into the water</p>
            </div>
            <div className="flex gap-2">
              <span className="text-blue-400 font-bold">2.</span>
              <p><span className="text-white font-medium">Wait for Bite</span> — Watch for the "TAP!" indicator</p>
            </div>
            <div className="flex gap-2">
              <span className="text-blue-400 font-bold">3.</span>
              <p><span className="text-white font-medium">Tap to Hook</span> — Quick! Tap before it escapes</p>
            </div>
            <div className="flex gap-2">
              <span className="text-blue-400 font-bold">4.</span>
              <p><span className="text-white font-medium">Reel it In</span> — Hold to reel, release to ease tension</p>
            </div>
            <div className="mt-3 p-2 bg-orange-900/30 rounded border border-orange-700/50">
              <p className="text-orange-300 text-xs">
                <span className="font-bold">⚡ During Fights:</span> Keep tension in the green ZONE or lose progress!
              </p>
            </div>
            <div className="mt-2 p-2 bg-yellow-900/30 rounded border border-yellow-700/50">
              <p className="text-yellow-300 text-xs">
                <span className="font-bold">💰 Staking:</span> Coming soon! On-chain staking will be implemented in a future update.
              </p>
            </div>
          </div>
        </div>

        {/* Pyth Entropy VRF */}
        <div className="p-4 bg-gray-800 rounded-lg">
          <h3 className="font-bold text-white text-lg mb-3 flex items-center gap-2">
            <span className="text-2xl">🔮</span> Pyth Entropy VRF
          </h3>
          <div className="space-y-3 text-sm text-gray-300">
            <p>
              This game uses <span className="text-purple-400 font-medium">Pyth Entropy</span> for
              provably fair on-chain randomness on <span className="text-blue-400 font-medium">Monad Testnet</span>.
            </p>

            <div className="p-2 bg-gray-900 rounded border border-gray-700">
              <p className="text-xs text-gray-400 mb-2">How it works:</p>
              <div className="space-y-1 text-xs">
                <p><span className="text-green-400">✓</span> Player successfully reels in fish</p>
                <p><span className="text-green-400">✓</span> Contract requests random number from Pyth</p>
                <p><span className="text-green-400">✓</span> Pyth Entropy generates verifiable randomness</p>
                <p><span className="text-green-400">✓</span> Fish rarity & type determined on-chain</p>
              </div>
            </div>

            <div className="p-2 bg-purple-900/30 rounded border border-purple-700/50">
              <p className="text-purple-300 text-xs">
                <span className="font-bold">Why it matters:</span> Randomness is generated AFTER successful gameplay,
                ensuring fair outcomes that can't be predicted or manipulated.
              </p>
            </div>

            <div className="pt-2 border-t border-gray-700">
              <p className="text-xs text-gray-500">
                No on-chain cost for failed attempts — only successful catches trigger the VRF call.
              </p>
            </div>
          </div>
        </div>

        {/* Tech Stack */}
        <div className="p-4 bg-gray-800 rounded-lg">
          <h3 className="font-bold text-white text-sm mb-2">Tech Stack</h3>
          <div className="flex flex-wrap gap-2">
            <span className="px-2 py-1 bg-gray-700 rounded text-xs text-gray-300">Monad Testnet</span>
            <span className="px-2 py-1 bg-purple-900/50 rounded text-xs text-purple-300">Pyth Entropy</span>
            <span className="px-2 py-1 bg-blue-900/50 rounded text-xs text-blue-300">Privy Auth</span>
            <span className="px-2 py-1 bg-gray-700 rounded text-xs text-gray-300">Next.js</span>
            <span className="px-2 py-1 bg-gray-700 rounded text-xs text-gray-300">wagmi</span>
          </div>
        </div>
      </div>

      {/* Stats and Auth - Right side panel */}
      <div className="fixed right-4 top-4 bottom-4 w-72 space-y-3 overflow-y-auto hidden lg:block">
        {/* Balance Display */}
        <div className="p-3 bg-gradient-to-r from-yellow-900/50 to-orange-900/50 rounded-lg border border-yellow-700/50">
          <div className="flex items-center justify-between">
            <span className="text-yellow-400 text-sm font-medium">Balance</span>
            <span className="text-2xl font-bold text-yellow-300">{state.balance}</span>
          </div>
          {state.lastPayout !== null && (
            <div className={`text-right text-sm font-bold mt-1 ${state.lastPayout > 0 ? "text-green-400" : "text-red-400"}`}>
              {state.lastPayout > 0 ? `+${state.lastPayout}` : `-${state.stake}`}
            </div>
          )}
        </div>

        {/* Stake Selector */}
        <div className="p-3 bg-gray-800 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400">Stake</span>
            <span className="text-sm font-medium text-white">{state.stake} tokens</span>
          </div>
          <div className="flex gap-2">
            {STAKE_OPTIONS.map((amount) => (
              <button
                key={amount}
                onClick={() => dispatch({ type: "SET_STAKE", amount })}
                disabled={state.state !== "idle" || state.balance < amount}
                className={`flex-1 py-2 px-1 rounded-lg text-sm font-bold transition-all ${
                  state.stake === amount
                    ? "bg-yellow-600 text-white ring-2 ring-yellow-400"
                    : state.balance < amount
                      ? "bg-gray-700 text-gray-500 cursor-not-allowed"
                      : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                }`}
              >
                {amount}
              </button>
            ))}
          </div>
          {state.balance < state.stake && (
            <p className="text-xs text-red-400 mt-2 text-center">Not enough balance!</p>
          )}
        </div>

        {/* Payout Info */}
        <div className="p-3 bg-gray-800 rounded-lg">
          <h3 className="text-sm font-medium text-gray-400 mb-2">Payouts (Stake: {state.stake})</h3>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between text-gray-500">
              <span>JUNK (10%)</span>
              <span className="text-red-400">-{state.stake}</span>
            </div>
            <div className="flex justify-between text-gray-500">
              <span>COMMON (55%)</span>
              <span className="text-red-400">-{state.stake}</span>
            </div>
            <div className="flex justify-between text-yellow-400">
              <span>RARE (25%)</span>
              <span>+{Math.floor(state.stake * PAYOUT_MULTIPLIERS.RARE) - state.stake}</span>
            </div>
            <div className="flex justify-between text-purple-400">
              <span>LEGENDARY (10%)</span>
              <span className="text-green-400">+{Math.floor(state.stake * PAYOUT_MULTIPLIERS.LEGENDARY) - state.stake}</span>
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-gray-700 text-xs text-gray-500 text-center">
            House Edge: 70%
          </div>
        </div>

        {/* Stats Bar */}
        <div className="flex justify-between items-center p-3 bg-gray-800 rounded-lg">
          <div className="text-center flex-1">
            <div className="text-xl font-bold text-blue-400">
              {realCatches.length}
            </div>
            <div className="text-xs text-gray-400">Catches</div>
          </div>
          {practiceCatches.length > 0 && (
            <div className="text-center flex-1">
              <div className="text-xl font-bold text-gray-500">
                {practiceCatches.length}
              </div>
              <div className="text-xs text-gray-500">Practice</div>
            </div>
          )}
          <div className="text-center flex-1">
            <div className={`text-xs px-2 py-1 rounded ${isPracticeMode ? "bg-gray-700 text-gray-300" : "bg-green-900 text-green-300"}`}>
              {isPracticeMode ? "Practice" : "On-chain"}
            </div>
          </div>
        </div>

        {/* Auth Section */}
        {!blockchain.isReady && (
          <div className="p-3 bg-gray-800 rounded-lg text-center">
            {blockchain.isWrongNetwork ? (
              <>
                <p className="text-sm text-yellow-400 mb-2">Wrong Network</p>
                <button
                  onClick={blockchain.switchChain}
                  disabled={blockchain.isSwitching}
                  className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-600 text-white font-semibold rounded-lg transition-colors text-sm"
                >
                  {blockchain.isSwitching ? "Switching..." : "Switch to Monad"}
                </button>
              </>
            ) : (
              <>
                <p className="text-sm text-gray-400 mb-2">
                  Sign in for on-chain catches
                </p>
                <button
                  onClick={() => blockchain.login()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors text-sm"
                >
                  Sign In
                </button>
              </>
            )}
          </div>
        )}

        {blockchain.writeError && (
          <div className="p-3 bg-red-900/50 text-red-300 rounded-lg text-sm">
            {blockchain.writeError.message.slice(0, 100)}
          </div>
        )}

        {/* Insufficient balance warning */}
        {!isPracticeMode && blockchain.balance && blockchain.fee && blockchain.balance.value < blockchain.fee && (
          <div className="p-3 bg-orange-900/50 border border-orange-700/50 rounded-lg text-center">
            <p className="text-sm text-orange-300 font-medium mb-1">Insufficient Balance</p>
            <p className="text-xs text-orange-400">
              Fund your wallet to play on-chain. Need at least {(Number(blockchain.fee) / 1e18).toFixed(6)} MON for VRF fees.
            </p>
          </div>
        )}

        {/* Catch History */}
        {state.catches.length > 0 && (
          <div className="space-y-2">
            <h3 className="font-semibold text-white text-sm">Recent Catches</h3>
            <div className="max-h-40 overflow-y-auto space-y-1">
              {state.catches.slice(0, 5).map((fish: CaughtFish, i: number) => (
                <div
                  key={`${fish.sequenceNumber}-${i}`}
                  className={`flex items-center justify-between p-2 rounded-lg ${UI_RARITY_BG[fish.rarity]} ${fish.isPractice ? "opacity-50" : ""}`}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className={`font-medium text-sm ${UI_RARITY_COLORS[fish.rarity]}`}
                    >
                      {fish.name}
                      {fish.isPractice && (
                        <span className="text-gray-500 text-xs ml-1">(practice)</span>
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-gray-400">{fish.size} cm</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Account Details */}
        {blockchain.mounted && blockchain.authenticated && blockchain.address && (
          <div className="p-3 bg-gray-800 rounded-lg space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">Wallet</span>
              <button
                type="button"
                onClick={() => blockchain.logout()}
                className="text-xs text-gray-400 hover:text-white cursor-pointer hover:underline"
              >
                Sign Out
              </button>
            </div>

            {/* Address with copy and explorer link */}
            <div className="flex items-center gap-2">
              <a
                href={`${BLOCK_EXPLORER_URL}/address/${blockchain.address}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-sm text-blue-400 hover:text-blue-300 hover:underline truncate flex-1"
                title="View on block explorer"
              >
                {blockchain.address.slice(0, 6)}...{blockchain.address.slice(-4)}
              </a>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(blockchain.address!);
                }}
                className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
                title="Copy address"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </button>
            </div>

            {/* Balance */}
            {blockchain.balance && (
              <div className="pt-2 border-t border-gray-700 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">Balance</span>
                  <span className="text-sm font-medium text-white">
                    {parseFloat(blockchain.balance.formatted).toFixed(4)} {blockchain.balance.symbol}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSendModal(true)}
                  className="w-full py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                  Withdraw
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Send Funds Modal */}
      {showSendModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl p-5 w-full max-w-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">Withdraw</h3>
              <button
                type="button"
                onClick={() => {
                  setShowSendModal(false);
                  setSendTo("");
                  setSendAmount("");
                  setSendError(null);
                  resetSendTx();
                }}
                className="text-gray-400 hover:text-white"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {isSendSuccess ? (
              <div className="text-center py-4">
                <div className="text-green-400 text-4xl mb-2">✓</div>
                <p className="text-green-400 font-medium">Transaction Sent!</p>
                <a
                  href={`${BLOCK_EXPLORER_URL}/tx/${sendTxHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 text-sm hover:underline"
                >
                  View on explorer
                </a>
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Recipient Address</label>
                    <input
                      type="text"
                      value={sendTo}
                      onChange={(e) => setSendTo(e.target.value)}
                      placeholder="0x..."
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm font-mono placeholder-gray-500 focus:outline-none focus:border-blue-500"
                      disabled={isSendPending || isSendConfirming}
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Amount (MON)</label>
                    <input
                      type="number"
                      value={sendAmount}
                      onChange={(e) => setSendAmount(e.target.value)}
                      placeholder="0.0"
                      step="0.0001"
                      min="0"
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500"
                      disabled={isSendPending || isSendConfirming}
                    />
                    {blockchain.balance && (
                      <button
                        type="button"
                        onClick={() => setSendAmount(blockchain.balance!.formatted)}
                        className="text-xs text-blue-400 hover:text-blue-300 mt-1"
                        disabled={isSendPending || isSendConfirming}
                      >
                        Max: {parseFloat(blockchain.balance.formatted).toFixed(4)} MON
                      </button>
                    )}
                  </div>
                </div>

                {(sendError || sendTxError) && (
                  <div className="p-2 bg-red-900/50 border border-red-700 rounded-lg">
                    <p className="text-red-300 text-sm">{sendError || sendTxError?.message?.slice(0, 100)}</p>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleSend}
                  disabled={isSendPending || isSendConfirming || !sendTo || !sendAmount}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
                >
                  {isSendPending ? "Confirm in wallet..." : isSendConfirming ? "Sending..." : "Send"}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
