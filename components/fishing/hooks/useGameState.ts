"use client";

import { useReducer, useCallback } from "react";
import type {
  GameStateData,
  GameAction,
  CaughtFish,
  FishData,
  FishRarity,
  SplashParticle,
} from "../types";
import {
  FISH_DATA,
  RARITY_THRESHOLDS,
  TIMING,
  GAMEPLAY,
  GAME_WIDTH,
  GAME_HEIGHT,
  DEFAULT_BALANCE,
  STAKE_OPTIONS,
  PAYOUT_MULTIPLIERS,
} from "../constants";

function createInitialState(): GameStateData {
  return {
    state: "idle",
    castProgress: 0,
    rodAngle: 0,
    rodTargetAngle: 0,
    bobberDistance: 0,
    bobberX: 0,
    tension: 0,
    progress: 0,
    fishIsFighting: false,
    fishFightTimer: 0,
    fishFightIntensity: 0,
    waitTimer: 0,
    biteTimer: 0,
    resultTimer: 0,
    caughtFishY: GAME_HEIGHT + 100, // For animation
    splashParticles: [],
    catches: [],
    lastCatch: null,
    sequenceNumber: null,
    randomResult: null,
    isPracticeMode: false,
    // Staking
    stake: STAKE_OPTIONS[0],
    balance: DEFAULT_BALANCE,
    lastPayout: null,
  };
}

// Determine catch from random bytes
export function determineCatch(randomBytes: string): FishData | null {
  const randomBigInt = BigInt(randomBytes);

  // Use different parts of the random number (matching reference)
  const rarityRoll = Number(randomBigInt % BigInt(100));
  const fishRoll = Number((randomBigInt >> BigInt(8)) % BigInt(100));
  const sizeRoll = Number((randomBigInt >> BigInt(16)) % BigInt(100));

  let rarity: FishRarity;
  let fishList: readonly { name: string; size: readonly [number, number] }[];

  if (rarityRoll < RARITY_THRESHOLDS.JUNK) {
    rarity = "JUNK";
    fishList = FISH_DATA.JUNK;
  } else if (rarityRoll < RARITY_THRESHOLDS.COMMON) {
    rarity = "COMMON";
    fishList = FISH_DATA.COMMON;
  } else if (rarityRoll < RARITY_THRESHOLDS.RARE) {
    rarity = "RARE";
    fishList = FISH_DATA.RARE;
  } else {
    rarity = "LEGENDARY";
    fishList = FISH_DATA.LEGENDARY;
  }

  const fishIndex = fishRoll % fishList.length;
  const fish = fishList[fishIndex];
  const sizeRange = fish.size[1] - fish.size[0];
  const size = fish.size[0] + (sizeRoll % sizeRange);

  return {
    name: fish.name,
    rarity,
    size,
  };
}

function createSplashParticles(): SplashParticle[] {
  const particles: SplashParticle[] = [];
  // Splash at bobber spawn position
  const bobberX = GAME_WIDTH / 2;
  const bobberY = GAMEPLAY.HORIZON_Y + 50;

  for (let i = 0; i < 8; i++) {
    particles.push({
      x: bobberX + (Math.random() - 0.5) * 30,
      y: bobberY,
      vx: (Math.random() - 0.5) * 6,
      vy: -2 - Math.random() * 4, // Upward burst
      life: 1,
    });
  }
  return particles;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function gameReducer(state: GameStateData, action: GameAction): GameStateData {
  switch (action.type) {
    case "START_CAST":
      if (state.state !== "idle") return state;
      return {
        ...state,
        state: "casting",
        castProgress: 0,
        rodAngle: state.rodAngle,
        rodTargetAngle: GAMEPLAY.ROD_ANGLE_CASTING,
      };

    case "UPDATE_CAST":
      if (state.state !== "casting") return state;
      // Smooth rod angle interpolation (matching reference: factor 0.1)
      const newAngle =
        state.rodAngle +
        (state.rodTargetAngle - state.rodAngle) * GAMEPLAY.ROD_ANGLE_SMOOTH_FACTOR;
      return {
        ...state,
        castProgress: action.progress,
        rodAngle: newAngle,
      };

    case "START_WAITING":
      return {
        ...state,
        state: "waiting",
        bobberDistance: GAMEPLAY.BOBBER_INITIAL_DISTANCE,
        bobberX: 0,
        rodAngle: state.rodAngle,
        rodTargetAngle: GAMEPLAY.ROD_ANGLE_WAITING,
        waitTimer: TIMING.MAX_WAIT_TIME_MS,
        splashParticles: createSplashParticles(),
      };

    case "UPDATE_WAITING":
      if (state.state !== "waiting") return state;
      return {
        ...state,
        waitTimer: state.waitTimer - action.deltaTime,
        // Smooth rod angle
        rodAngle:
          state.rodAngle +
          (state.rodTargetAngle - state.rodAngle) * GAMEPLAY.ROD_ANGLE_SMOOTH_FACTOR,
      };

    case "SET_RANDOM":
      return {
        ...state,
        randomResult: action.result,
        sequenceNumber: action.sequenceNumber,
      };

    case "START_BITE": {
      if (state.state !== "waiting") return state;
      return {
        ...state,
        state: "bite",
        biteTimer: TIMING.BITE_WINDOW_MS,
      };
    }

    case "MISS_BITE":
      return {
        ...state,
        state: "escaped",
        resultTimer: TIMING.ESCAPED_DISPLAY_MS,
      };

    case "START_REELING": {
      if (state.state !== "bite") return state;
      // Deduct stake when player commits to reeling (only in on-chain mode)
      const newBalance = state.isPracticeMode ? state.balance : state.balance - state.stake;
      // Initialize fish fight timer (matching reference: 500 + random 0-1000ms)
      const initialFightTimer =
        GAMEPLAY.FISH_FIGHT_INITIAL_MIN +
        Math.random() * GAMEPLAY.FISH_FIGHT_INITIAL_RANDOM;
      return {
        ...state,
        state: "reeling",
        tension: 20,
        progress: 0,
        fishIsFighting: false,
        fishFightTimer: initialFightTimer,
        fishFightIntensity: 0,
        bobberDistance: GAMEPLAY.BOBBER_INITIAL_DISTANCE,
        balance: newBalance,
        lastPayout: null, // Reset payout display
      };
    }

    case "UPDATE_REELING": {
      if (state.state !== "reeling") return state;

      const dt = action.deltaTime; // Keep in ms like reference
      let {
        tension,
        progress,
        bobberDistance,
        bobberX,
        fishIsFighting,
        fishFightTimer,
        fishFightIntensity,
        rodAngle,
        rodTargetAngle,
      } = state;

      // Update fish fight timer
      fishFightTimer -= dt;

      // Start fighting if timer expired and not already fighting
      if (fishFightTimer <= 0 && !fishIsFighting) {
        fishIsFighting = true;
        fishFightIntensity =
          GAMEPLAY.FISH_FIGHT_INTENSITY_MIN +
          Math.random() *
            (GAMEPLAY.FISH_FIGHT_INTENSITY_MAX - GAMEPLAY.FISH_FIGHT_INTENSITY_MIN);
        fishFightTimer =
          GAMEPLAY.FISH_FIGHT_DURATION_MIN +
          Math.random() *
            (GAMEPLAY.FISH_FIGHT_DURATION_MAX - GAMEPLAY.FISH_FIGHT_DURATION_MIN);
      }

      // End fighting after duration
      if (fishIsFighting && fishFightTimer <= 0) {
        fishIsFighting = false;
        fishFightTimer =
          GAMEPLAY.FISH_FIGHT_INITIAL_MIN +
          Math.random() * GAMEPLAY.FISH_FIGHT_INITIAL_RANDOM;
      }

      // Update bobber wobble (matching reference formulas)
      const time = Date.now();
      if (fishIsFighting) {
        bobberX = Math.sin(time / 50) * (15 + fishFightIntensity * 10);
      } else if (action.isHolding) {
        bobberX = Math.sin(time / 200) * 3;
      } else {
        bobberX = Math.sin(time / 1000) * 5;
      }

      // Track previous tension to limit change rate (prevents spam click spikes)
      const prevTension = tension;

      // Update tension and progress based on input
      if (action.isHolding) {
        // Holding: tension += dt/18, progress += dt/56
        tension += dt / GAMEPLAY.TENSION_HOLD_DIVISOR;
        progress += dt / GAMEPLAY.PROGRESS_HOLD_DIVISOR;
        bobberDistance -= dt / GAMEPLAY.BOBBER_PULL_DIVISOR;

        // Rod angle increases with tension
        rodTargetAngle = 0.3 + (tension / 100) * 0.2;
      } else {
        // Releasing: tension -= dt/12 (normal) or dt/6 (fighting)
        const releaseDivisor = fishIsFighting
          ? GAMEPLAY.TENSION_RELEASE_FIGHT_DIVISOR
          : GAMEPLAY.TENSION_RELEASE_DIVISOR;
        tension -= dt / releaseDivisor;

        rodTargetAngle = fishIsFighting ? 0.2 : 0.1;
      }

      // Add extra tension when fish is fighting
      if (fishIsFighting) {
        tension += (dt / GAMEPLAY.TENSION_FIGHT_DIVISOR) * fishFightIntensity;
      }

      // Clamp tension change rate to prevent spam click spikes
      const tensionDelta = tension - prevTension;
      const maxChange = GAMEPLAY.TENSION_MAX_CHANGE_PER_FRAME;
      if (Math.abs(tensionDelta) > maxChange) {
        tension = prevTension + Math.sign(tensionDelta) * maxChange;
      }

      // Smooth rod angle
      rodAngle += (rodTargetAngle - rodAngle) * GAMEPLAY.ROD_ANGLE_SMOOTH_FACTOR;

      tension = clamp(tension, 0, 100);

      // Fighting zone mechanic: drain progress if tension is outside safe zone during fights
      if (fishIsFighting) {
        const inZone = tension >= GAMEPLAY.FIGHT_ZONE_MIN && tension <= GAMEPLAY.FIGHT_ZONE_MAX;
        if (!inZone) {
          // Drain progress proportionally to how far outside the zone
          const distanceFromZone = tension < GAMEPLAY.FIGHT_ZONE_MIN
            ? GAMEPLAY.FIGHT_ZONE_MIN - tension
            : tension - GAMEPLAY.FIGHT_ZONE_MAX;
          const drainMultiplier = 1 + (distanceFromZone / 30); // Drain faster the further outside
          progress -= (dt / GAMEPLAY.FIGHT_ZONE_PROGRESS_DRAIN) * drainMultiplier;
        }
      }

      progress = clamp(progress, 0, 100);
      bobberDistance = clamp(bobberDistance, 0, 100);

      // Check win/lose conditions
      if (tension >= 100) {
        return {
          ...state,
          state: "escaped",
          tension: 100,
          resultTimer: TIMING.ESCAPED_DISPLAY_MS,
        };
      }

      if (progress >= 100) {
        // Reel succeeded! Now we need to call Pyth to determine the fish
        return {
          ...state,
          state: "revealing",
          progress: 100,
        };
      }

      return {
        ...state,
        tension,
        progress,
        bobberDistance,
        bobberX,
        fishIsFighting,
        fishFightTimer,
        fishFightIntensity,
        rodAngle,
        rodTargetAngle,
      };
    }

    case "REVEAL_FISH": {
      // Pyth returned - determine and show the fish
      if (!state.randomResult) {
        return {
          ...state,
          state: "escaped",
          resultTimer: TIMING.ESCAPED_DISPLAY_MS,
          lastPayout: 0, // Lost stake
        };
      }
      const fishData = determineCatch(state.randomResult);
      if (!fishData) {
        return {
          ...state,
          state: "escaped",
          resultTimer: TIMING.ESCAPED_DISPLAY_MS,
          lastPayout: 0, // Lost stake
        };
      }
      // Calculate payout based on fish rarity (only in on-chain mode)
      const multiplier = PAYOUT_MULTIPLIERS[fishData.rarity];
      const payout = state.isPracticeMode ? 0 : Math.floor(state.stake * multiplier);
      const caughtFish: CaughtFish = {
        ...fishData,
        timestamp: Date.now(),
        sequenceNumber: state.sequenceNumber?.toString() || "practice",
        isPractice: state.isPracticeMode,
      };
      return {
        ...state,
        state: "caught",
        lastCatch: caughtFish,
        catches: [caughtFish, ...state.catches],
        resultTimer: TIMING.CAUGHT_DISPLAY_MS,
        caughtFishY: GAME_HEIGHT + 100,
        balance: state.isPracticeMode ? state.balance : state.balance + payout,
        lastPayout: state.isPracticeMode ? null : payout,
      };
    }

    case "FISH_ESCAPED":
      return {
        ...state,
        state: "escaped",
        resultTimer: TIMING.ESCAPED_DISPLAY_MS,
        lastPayout: 0, // Lost stake (line snapped)
      };

    case "UPDATE_RESULT":
      if (state.state !== "caught" && state.state !== "escaped") return state;

      // Animate caught fish rising up (matching reference: dt/2)
      let caughtFishY = state.caughtFishY;
      if (state.state === "caught") {
        const targetY = GAME_HEIGHT * 0.4;
        caughtFishY = Math.max(targetY, caughtFishY - action.deltaTime / 2);
      }

      return {
        ...state,
        resultTimer: Math.max(0, state.resultTimer - action.deltaTime),
        caughtFishY,
      };

    case "UPDATE_PARTICLES": {
      const gravity = 0.2; // Matching reference
      const updatedParticles = state.splashParticles
        .map((p) => ({
          ...p,
          x: p.x + p.vx,
          y: p.y + p.vy,
          vy: p.vy + gravity,
          life: p.life - 0.03, // Fade out over ~33 frames
        }))
        .filter((p) => p.life > 0);
      return {
        ...state,
        splashParticles: updatedParticles,
      };
    }

    case "RESET":
      return {
        ...createInitialState(),
        catches: state.catches,
        isPracticeMode: state.isPracticeMode,
        // Preserve staking state
        stake: state.stake,
        balance: state.balance,
        lastPayout: null,
      };

    case "SET_PRACTICE_MODE":
      return {
        ...state,
        isPracticeMode: action.enabled,
      };

    case "SET_STAKE":
      // Only allow changing stake in idle state
      if (state.state !== "idle") return state;
      return {
        ...state,
        stake: action.amount,
      };

    default:
      return state;
  }
}

export function useGameState() {
  const [state, dispatch] = useReducer(gameReducer, null, createInitialState);

  const reset = useCallback(() => {
    dispatch({ type: "RESET" });
  }, []);

  return {
    state,
    dispatch,
    reset,
  };
}
