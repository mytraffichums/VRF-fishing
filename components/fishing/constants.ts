import type { FishRarity } from "./types";

// Staking system (70% house edge, 30% player EV)
export const STAKE_OPTIONS = [10, 25, 50, 100] as const;
export const DEFAULT_BALANCE = 1000;
export const PAYOUT_MULTIPLIERS: Record<FishRarity, number> = {
  JUNK: 0,       // 10% odds - lose all
  COMMON: 0,    // 55% odds - lose all
  RARE: 0.4,    // 25% odds - get 40% back
  LEGENDARY: 2, // 10% odds - double
};
// EV = 0.10*0 + 0.55*0 + 0.25*0.4 + 0.10*2 = 0.30 (30% return)

// Game dimensions (portrait mobile-first)
export const GAME_WIDTH = 360;
export const GAME_HEIGHT = 640;

// Colors matching reference game exactly
export const COLORS = {
  sky: "#87CEEB",
  skyTop: "#6BB3D9",
  horizon: "#E8D5B7",
  water: "#2E7D9E",
  waterMid: "#256B89",
  waterNear: "#1D5A75",
  waterDeep: "#194D66",
  rod: "#5D4037",
  rodLight: "#795548",
  rodDark: "#3E2723",
  reel: "#78909C",
  reelDark: "#546E7A",
  handle: "#4E342E",
  line: "#E0E0E0",
  bobber: "#E53935",
  bobberWhite: "#FFFFFF",
  tensionLow: "#4CAF50",
  tensionMed: "#FFC107",
  tensionHigh: "#F44336",
  progressBar: "#64B5F6",
  progressBg: "#1A1A2E",
  text: "#FFFFFF",
  textShadow: "#000000",
  fish: "#FFB74D",
  fishDark: "#F57C00",
  splash: "#FFFFFF",
} as const;

// Rarity colors (matching reference exactly)
export const RARITY_COLORS = {
  JUNK: { primary: "#666666", secondary: "#444444", glow: null },
  COMMON: { primary: "#FFB74D", secondary: "#F57C00", glow: null },
  RARE: { primary: "#FFD700", secondary: "#FFA000", glow: "#FFD700" },
  LEGENDARY: { primary: "#E040FB", secondary: "#9C27B0", glow: "#E040FB" },
} as const;

// Timing constants (matching reference exactly)
export const TIMING = {
  CAST_DURATION_MS: 400,
  MAX_WAIT_TIME_MS: 60000,
  BITE_WINDOW_MS: 1500,
  CAUGHT_DISPLAY_MS: 2000,
  ESCAPED_DISPLAY_MS: 1500,
} as const;

// Gameplay constants (matching reference exactly)
// Reference uses frame-based: dt/18, dt/25, dt/12, dt/6, dt/80
// At 60fps, dt ≈ 16.67ms, so dt/18 ≈ 0.93 per frame ≈ 55.5 per second
export const GAMEPLAY = {
  // Tension (these are divisors for dt in ms)
  TENSION_HOLD_DIVISOR: 18, // dt/18 when holding
  TENSION_FIGHT_DIVISOR: 25, // dt/25 * intensity when fighting
  TENSION_RELEASE_DIVISOR: 12, // dt/12 when releasing (normal)
  TENSION_RELEASE_FIGHT_DIVISOR: 6, // dt/6 when releasing (fighting)

  // Thresholds for tension colors
  TENSION_LOW_THRESHOLD: 40,
  TENSION_HIGH_THRESHOLD: 70,

  // Progress
  PROGRESS_HOLD_DIVISOR: 80, // dt/80 when holding

  // Fish fighting (matching reference)
  FISH_FIGHT_INITIAL_MIN: 500, // Initial delay before first fight
  FISH_FIGHT_INITIAL_RANDOM: 1000, // Random 0-1000ms added to initial
  FISH_FIGHT_DURATION_MIN: 5000, // Fight lasts 5-10 seconds
  FISH_FIGHT_DURATION_MAX: 10000,
  FISH_FIGHT_INTENSITY_MIN: 0.3,
  FISH_FIGHT_INTENSITY_MAX: 1.0,

  // Fighting zone mechanic - player must keep tension in this range during fights
  FIGHT_ZONE_MIN: 30, // Lower bound of safe zone (%)
  FIGHT_ZONE_MAX: 60, // Upper bound of safe zone (%)
  FIGHT_ZONE_PROGRESS_DRAIN: 60, // dt/60 progress drain when outside zone

  // Bobber
  BOBBER_INITIAL_DISTANCE: 70, // Starting depth (0-100)
  BOBBER_PULL_DIVISOR: 50, // dt/50 when reeling

  // Rod
  ROD_LENGTH: 360,
  ROD_PIVOT_X: GAME_WIDTH / 2, // 180 - bottom center
  ROD_PIVOT_Y: GAME_HEIGHT + 30, // 670 - below screen
  ROD_ANGLE_IDLE: 0,
  ROD_ANGLE_CASTING: -0.3,
  ROD_ANGLE_WAITING: 0.1,
  ROD_ANGLE_SMOOTH_FACTOR: 0.1,

  // UI positioning (matching reference exactly)
  TENSION_BAR_X: GAME_WIDTH - 50, // 310
  TENSION_BAR_Y: 80,
  TENSION_BAR_WIDTH: 24,
  TENSION_BAR_HEIGHT: 180,

  PROGRESS_BAR_X: 40,
  PROGRESS_BAR_Y: GAME_HEIGHT - 70, // 570
  PROGRESS_BAR_WIDTH: GAME_WIDTH - 80, // 280
  PROGRESS_BAR_HEIGHT: 20,

  // Bobber screen positions
  HORIZON_Y: 180,
  NEAR_Y: 400,
} as const;

// Fish data (matching reference)
export const FISH_DATA = {
  JUNK: [
    { name: "Old Boot", size: [5, 25] as const },
    { name: "Rusty Can", size: [5, 25] as const },
    { name: "Tangled Seaweed", size: [5, 25] as const },
    { name: "Broken Rod", size: [5, 25] as const },
    { name: "Empty Bottle", size: [5, 25] as const },
  ],
  COMMON: [
    { name: "Common Carp", size: [15, 45] as const },
    { name: "Bluegill", size: [15, 45] as const },
    { name: "Perch", size: [15, 45] as const },
    { name: "Catfish", size: [15, 45] as const },
    { name: "Bass", size: [15, 45] as const },
    { name: "Trout", size: [15, 45] as const },
  ],
  RARE: [
    { name: "Golden Trout", size: [30, 80] as const },
    { name: "Rainbow Koi", size: [30, 80] as const },
    { name: "Silver Salmon", size: [30, 80] as const },
    { name: "Electric Eel", size: [30, 80] as const },
  ],
  LEGENDARY: [
    { name: "Legendary Koi", size: [50, 150] as const },
    { name: "Ancient Sturgeon", size: [50, 150] as const },
    { name: "Mythic Moonfish", size: [50, 150] as const },
  ],
} as const;

// Rarity thresholds (out of 100)
export const RARITY_THRESHOLDS = {
  JUNK: 10, // 0-9 (10%)
  COMMON: 65, // 10-64 (55%)
  RARE: 90, // 65-89 (25%)
  LEGENDARY: 100, // 90-99 (10%)
} as const;

// UI Tailwind classes
export const UI_RARITY_COLORS: Record<FishRarity, string> = {
  JUNK: "text-gray-500",
  COMMON: "text-orange-400",
  RARE: "text-yellow-400",
  LEGENDARY: "text-purple-400",
};

export const UI_RARITY_BG: Record<FishRarity, string> = {
  JUNK: "bg-gray-800",
  COMMON: "bg-orange-900/30",
  RARE: "bg-yellow-900/30",
  LEGENDARY: "bg-purple-900/30",
};
