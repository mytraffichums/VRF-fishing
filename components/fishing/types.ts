export type GameState =
  | "idle"
  | "casting"
  | "waiting"
  | "bite"
  | "reeling"
  | "revealing" // Waiting for Pyth after successful reel
  | "caught"
  | "escaped";

export type FishRarity = "JUNK" | "COMMON" | "RARE" | "LEGENDARY";

export interface CaughtFish {
  name: string;
  rarity: FishRarity;
  size: number;
  timestamp: number;
  sequenceNumber: string;
  isPractice: boolean;
}

export interface FishData {
  name: string;
  rarity: FishRarity;
  size: number;
}

export interface GameStateData {
  state: GameState;

  // Casting animation
  castProgress: number; // 0-1
  rodAngle: number;
  rodTargetAngle: number;

  // Bobber
  bobberDistance: number; // percentage into water
  bobberX: number; // horizontal offset for wobble

  // Reeling mechanics
  tension: number; // 0-100
  progress: number; // 0-100

  // Fish fighting
  fishIsFighting: boolean;
  fishFightTimer: number;
  fishFightIntensity: number;

  // Timers
  waitTimer: number;
  biteTimer: number;
  resultTimer: number;

  // Caught fish animation
  caughtFishY: number;

  // Splash particles
  splashParticles: SplashParticle[];

  // Results
  catches: CaughtFish[];
  lastCatch: CaughtFish | null;

  // Blockchain
  sequenceNumber: bigint | null;
  randomResult: string | null;
  isPracticeMode: boolean;

  // Staking
  stake: number;
  balance: number;
  lastPayout: number | null; // null = no result yet, 0 = lost, >0 = won
}

export interface SplashParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
}

export interface InputState {
  isHolding: boolean;
}

export type GameAction =
  | { type: "START_CAST" }
  | { type: "UPDATE_CAST"; progress: number }
  | { type: "START_WAITING" }
  | { type: "SET_RANDOM"; result: string; sequenceNumber: bigint | null }
  | { type: "START_BITE" }
  | { type: "MISS_BITE" }
  | { type: "START_REELING" }
  | { type: "UPDATE_REELING"; deltaTime: number; isHolding: boolean }
  | { type: "REVEAL_FISH" } // Pyth returned, show the fish
  | { type: "FISH_ESCAPED" }
  | { type: "UPDATE_RESULT"; deltaTime: number }
  | { type: "RESET" }
  | { type: "SET_PRACTICE_MODE"; enabled: boolean }
  | { type: "UPDATE_WAITING"; deltaTime: number }
  | { type: "UPDATE_PARTICLES"; deltaTime: number }
  | { type: "SET_STAKE"; amount: number };
