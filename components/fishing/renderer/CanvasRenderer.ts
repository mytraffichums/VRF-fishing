import type { GameStateData } from "../types";
import { COLORS, RARITY_COLORS, GAME_WIDTH, GAME_HEIGHT, GAMEPLAY } from "../constants";

interface TreeData {
  x: number;
  height: number;
  width: number;
  type: "pine" | "round";
}

export class CanvasRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private scale: number = 1;
  private offsetX: number = 0;
  private offsetY: number = 0;
  private time: number = 0;
  private trees: TreeData[] = [];
  private waveOffset: number = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not get canvas context");
    this.ctx = ctx;
    this.generateTrees();
    this.resize();
  }

  private generateTrees() {
    this.trees = [];
    let x = 0;
    while (x < GAME_WIDTH + 20) {
      const height = 25 + Math.random() * 20;
      const width = 12 + Math.random() * 10;
      const type = Math.random() > 0.3 ? "pine" : "round";
      this.trees.push({ x, height, width, type });
      x += 8 + Math.random() * 12;
    }
  }

  resize() {
    const windowWidth = this.canvas.parentElement?.clientWidth || window.innerWidth;
    const windowHeight = this.canvas.parentElement?.clientHeight || window.innerHeight;

    const gameRatio = GAME_WIDTH / GAME_HEIGHT;
    const windowRatio = windowWidth / windowHeight;

    if (windowRatio < gameRatio) {
      this.scale = windowWidth / GAME_WIDTH;
    } else {
      this.scale = windowHeight / GAME_HEIGHT;
    }

    this.canvas.width = windowWidth;
    this.canvas.height = windowHeight;

    this.offsetX = (windowWidth - GAME_WIDTH * this.scale) / 2;
    this.offsetY = (windowHeight - GAME_HEIGHT * this.scale) / 2;
  }

  render(state: GameStateData, deltaTime: number, options?: { insufficientBalance?: boolean }) {
    this.time += deltaTime;
    this.waveOffset = this.time / 500;

    const ctx = this.ctx;
    ctx.save();

    // Clear
    ctx.fillStyle = COLORS.sky;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Transform to game coordinates
    ctx.translate(this.offsetX, this.offsetY);
    ctx.scale(this.scale, this.scale);

    // Draw layers
    this.drawSky();
    this.drawWater();

    // Show insufficient balance overlay if needed (blocks normal gameplay UI)
    if (options?.insufficientBalance) {
      this.drawInsufficientBalanceOverlay();
      ctx.restore();
      return;
    }

    // Draw game elements based on state
    if (state.state !== "idle" && state.state !== "casting") {
      this.drawFishingLine(state);
      this.drawBobber(state);
    }

    this.drawSplashParticles(state);
    this.drawRod(state);

    // Draw UI based on state
    if (state.state === "idle") {
      this.drawStartPrompt();
    } else if (state.state === "waiting") {
      this.drawWaitingIndicator();
    } else if (state.state === "bite") {
      this.drawBiteIndicator(state);
    } else if (state.state === "reeling") {
      this.drawReelingUI(state);
    } else if (state.state === "revealing") {
      this.drawRevealingUI();
    } else if (state.state === "caught") {
      this.drawCaughtFish(state);
    } else if (state.state === "escaped") {
      this.drawEscapedMessage(state);
    }

    ctx.restore();
  }

  private drawSky() {
    const ctx = this.ctx;
    const horizonY = GAMEPLAY.HORIZON_Y;

    // Sky gradient
    const skyGradient = ctx.createLinearGradient(0, 0, 0, horizonY);
    skyGradient.addColorStop(0, COLORS.skyTop);
    skyGradient.addColorStop(1, COLORS.sky);
    ctx.fillStyle = skyGradient;
    ctx.fillRect(0, 0, GAME_WIDTH, horizonY);

    // Sun
    const sunX = GAME_WIDTH * 0.75;
    const sunY = GAME_HEIGHT * 0.1;
    const sunRadius = 25;

    // Sun glow
    const glowGradient = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, sunRadius * 3);
    glowGradient.addColorStop(0, "rgba(255, 236, 179, 0.6)");
    glowGradient.addColorStop(0.5, "rgba(255, 236, 179, 0.2)");
    glowGradient.addColorStop(1, "rgba(255, 236, 179, 0)");
    ctx.fillStyle = glowGradient;
    ctx.fillRect(sunX - sunRadius * 3, sunY - sunRadius * 3, sunRadius * 6, sunRadius * 6);

    // Sun body
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunRadius, 0, Math.PI * 2);
    ctx.fillStyle = "#FFEB3B";
    ctx.fill();

    // Horizon line
    ctx.fillStyle = COLORS.horizon;
    ctx.fillRect(0, horizonY - 3, GAME_WIDTH, 6);

    // Trees silhouette
    ctx.fillStyle = "#2D5016";
    for (const tree of this.trees) {
      const baseY = horizonY;
      if (tree.type === "pine") {
        ctx.fillRect(tree.x + tree.width * 0.35, baseY - 5, tree.width * 0.3, 5);
        for (let layer = 0; layer < 3; layer++) {
          const layerY = baseY - 5 - layer * (tree.height * 0.3);
          const layerWidth = tree.width * (1 - layer * 0.15);
          const layerHeight = tree.height * 0.45;
          ctx.beginPath();
          ctx.moveTo(tree.x + tree.width / 2, layerY - layerHeight);
          ctx.lineTo(tree.x + tree.width / 2 - layerWidth / 2, layerY);
          ctx.lineTo(tree.x + tree.width / 2 + layerWidth / 2, layerY);
          ctx.closePath();
          ctx.fill();
        }
      } else {
        ctx.fillRect(tree.x + tree.width * 0.35, baseY - tree.height * 0.4, tree.width * 0.3, tree.height * 0.4);
        ctx.beginPath();
        ctx.ellipse(tree.x + tree.width / 2, baseY - tree.height * 0.6, tree.width * 0.6, tree.height * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  private drawWater() {
    const ctx = this.ctx;
    const horizonY = GAMEPLAY.HORIZON_Y;
    const waterHeight = GAME_HEIGHT - horizonY;

    // Water gradient
    const waterGradient = ctx.createLinearGradient(0, horizonY, 0, GAME_HEIGHT);
    waterGradient.addColorStop(0, COLORS.water);
    waterGradient.addColorStop(0.3, COLORS.waterMid);
    waterGradient.addColorStop(0.6, COLORS.waterNear);
    waterGradient.addColorStop(1, COLORS.waterDeep);
    ctx.fillStyle = waterGradient;
    ctx.fillRect(0, horizonY, GAME_WIDTH, waterHeight);

    // Animated wave lines (matching reference: 8 lines)
    ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
    ctx.lineWidth = 1;
    for (let i = 0; i < 8; i++) {
      const y = horizonY + 20 + i * 25;
      ctx.beginPath();
      for (let x = 0; x <= GAME_WIDTH; x += 5) {
        const wave = Math.sin(x / 40 + this.waveOffset + i * 0.5) * (3 + i * 0.5);
        if (x === 0) {
          ctx.moveTo(x, y + wave);
        } else {
          ctx.lineTo(x, y + wave);
        }
      }
      ctx.stroke();
    }

    // Water sparkles (matching reference: 6 squares)
    ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
    for (let i = 0; i < 6; i++) {
      const sparkleX = ((this.time / 20 + i * 60) % GAME_WIDTH);
      const sparkleY = horizonY + 40 + (i * 50) % (waterHeight - 80);
      const sparkleSize = 2 + Math.sin(this.time / 200 + i * 2) * 1.5;
      ctx.fillRect(sparkleX - sparkleSize / 2, sparkleY - sparkleSize / 2, sparkleSize, sparkleSize);
    }
  }

  private drawRod(state: GameStateData) {
    const ctx = this.ctx;

    // Rod pivot at bottom center (matching reference exactly)
    const pivotX = GAMEPLAY.ROD_PIVOT_X;
    const pivotY = GAMEPLAY.ROD_PIVOT_Y;
    const rodLength = GAMEPLAY.ROD_LENGTH;
    const angle = state.rodAngle - Math.PI / 2; // Convert to screen angle

    // Calculate rod tip
    const tipX = pivotX + Math.cos(angle) * rodLength;
    const tipY = pivotY + Math.sin(angle) * rodLength;

    // Rod shadow
    ctx.strokeStyle = "rgba(0, 0, 0, 0.3)";
    ctx.lineWidth = 12;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(pivotX + 3, pivotY + 3);
    ctx.lineTo(tipX + 3, tipY + 3);
    ctx.stroke();

    // Rod body - thick section (handle)
    ctx.strokeStyle = COLORS.rod;
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(pivotX, pivotY);
    const mid1X = pivotX + Math.cos(angle) * rodLength * 0.25;
    const mid1Y = pivotY + Math.sin(angle) * rodLength * 0.25;
    ctx.lineTo(mid1X, mid1Y);
    ctx.stroke();

    // Rod body - mid section
    ctx.strokeStyle = COLORS.rodLight;
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(mid1X, mid1Y);
    const mid2X = pivotX + Math.cos(angle) * rodLength * 0.6;
    const mid2Y = pivotY + Math.sin(angle) * rodLength * 0.6;
    ctx.lineTo(mid2X, mid2Y);
    ctx.stroke();

    // Rod body - thin section (tip)
    ctx.strokeStyle = COLORS.rodDark;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(mid2X, mid2Y);
    ctx.lineTo(tipX, tipY);
    ctx.stroke();

    // Reel
    const reelX = pivotX + Math.cos(angle) * 40;
    const reelY = pivotY + Math.sin(angle) * 40;

    ctx.beginPath();
    ctx.arc(reelX, reelY, 14, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.reel;
    ctx.fill();
    ctx.strokeStyle = COLORS.reelDark;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Inner reel
    ctx.beginPath();
    ctx.arc(reelX, reelY, 8, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.reelDark;
    ctx.fill();

    // Reel handle (rotating, matching reference: time / 100)
    const handleAngle = this.time / 100;
    const handleX = reelX + Math.cos(handleAngle) * 16;
    const handleY = reelY + Math.sin(handleAngle) * 16;

    ctx.strokeStyle = COLORS.reelDark;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(reelX, reelY);
    ctx.lineTo(handleX, handleY);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(handleX, handleY, 5, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.handle;
    ctx.fill();

    // Line guides
    ctx.fillStyle = COLORS.reelDark;
    for (let i = 1; i <= 4; i++) {
      const guidePos = i * 0.2;
      const gx = pivotX + Math.cos(angle) * rodLength * guidePos;
      const gy = pivotY + Math.sin(angle) * rodLength * guidePos;
      ctx.beginPath();
      ctx.arc(gx, gy, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private getRodTipPosition(state: GameStateData): { x: number; y: number } {
    const pivotX = GAMEPLAY.ROD_PIVOT_X;
    const pivotY = GAMEPLAY.ROD_PIVOT_Y;
    const rodLength = GAMEPLAY.ROD_LENGTH;
    const angle = state.rodAngle - Math.PI / 2;
    return {
      x: pivotX + Math.cos(angle) * rodLength,
      y: pivotY + Math.sin(angle) * rodLength,
    };
  }

  private getBobberPosition(state: GameStateData): { x: number; y: number; scale: number } {
    // Parabolic equation for perspective (matching reference)
    // bobberDistance: 0 = closest, 100 = farthest
    const t = 1 - state.bobberDistance / 100; // Invert so closer = higher t
    const horizonY = GAMEPLAY.HORIZON_Y;
    const nearY = GAMEPLAY.NEAR_Y;

    // Parabolic Y: horizonY + (nearY - horizonY) * (1 - t²) when far, closer to nearY when close
    const y = horizonY + (nearY - horizonY) * t * t;

    // X position: centered with wobble
    const x = GAME_WIDTH / 2 + state.bobberX;

    // Scale: 0.5 when far, 1.3 when close
    const scale = 0.5 + t * 0.8;

    return { x, y, scale };
  }

  private drawFishingLine(state: GameStateData) {
    const ctx = this.ctx;
    const tip = this.getRodTipPosition(state);
    const bobber = this.getBobberPosition(state);

    // Line color based on tension
    let lineColor: string = COLORS.line;
    if (state.state === "reeling") {
      if (state.tension > GAMEPLAY.TENSION_HIGH_THRESHOLD) {
        lineColor = COLORS.tensionHigh;
      } else if (state.tension > GAMEPLAY.TENSION_LOW_THRESHOLD) {
        lineColor = COLORS.tensionMed;
      }
    }

    // Draw curved line
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(tip.x, tip.y);

    // Control point for curve
    const midX = (tip.x + bobber.x) / 2;
    const sag = 30 - (state.tension / 100) * 20;
    const midY = Math.max(tip.y, bobber.y) / 2 + sag;

    ctx.quadraticCurveTo(midX, midY, bobber.x, bobber.y);
    ctx.stroke();
  }

  private drawBobber(state: GameStateData) {
    const ctx = this.ctx;
    const pos = this.getBobberPosition(state);
    const scale = pos.scale;

    // Bobber bob animation
    const bobOffset = Math.sin(this.time / 400) * 3 * scale;

    ctx.save();
    ctx.translate(pos.x, pos.y + bobOffset);

    // Shadow
    ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
    ctx.beginPath();
    ctx.ellipse(0, 8 * scale, 10 * scale, 4 * scale, 0, 0, Math.PI * 2);
    ctx.fill();

    // White bottom section
    ctx.fillStyle = COLORS.bobberWhite;
    ctx.beginPath();
    ctx.ellipse(0, 5 * scale, 8 * scale, 10 * scale, 0, 0, Math.PI);
    ctx.fill();

    // Red top section
    ctx.fillStyle = COLORS.bobber;
    ctx.beginPath();
    ctx.ellipse(0, -5 * scale, 8 * scale, 10 * scale, 0, Math.PI, Math.PI * 2);
    ctx.fill();

    // Shine highlight
    ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
    ctx.beginPath();
    ctx.ellipse(-3 * scale, -8 * scale, 2 * scale, 3 * scale, -0.3, 0, Math.PI * 2);
    ctx.fill();

    // Ripple effect (matching reference: expanding ellipse)
    if (state.state === "waiting" || state.state === "bite") {
      const ripplePhase = (this.time / 500) % 1;
      const rippleRadius = 15 + ripplePhase * 20;
      const rippleAlpha = 1 - ripplePhase;
      ctx.strokeStyle = `rgba(255, 255, 255, ${rippleAlpha * 0.5})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(0, 5 * scale, rippleRadius * scale, (5 + ripplePhase * 8) * scale, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  }

  private drawSplashParticles(state: GameStateData) {
    const ctx = this.ctx;

    for (const particle of state.splashParticles) {
      const alpha = particle.life;
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
      // Square particles (matching reference)
      ctx.fillRect(particle.x - 3, particle.y - 3, 6, 6);
    }
  }

  private drawStartPrompt() {
    const ctx = this.ctx;
    const centerX = GAME_WIDTH / 2;
    const centerY = GAME_HEIGHT * 0.55;

    // Dark overlay
    ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Pulsing scale
    const pulse = 1 + Math.sin(this.time / 300) * 0.05;

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.scale(pulse, pulse);

    // Main text
    ctx.fillStyle = COLORS.text;
    ctx.font = "bold 28px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("TAP TO CAST", 0, 0);

    // Subtitle
    ctx.font = "14px monospace";
    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    ctx.fillText("Hold to reel in your catch", 0, 35);

    ctx.restore();
  }

  private drawInsufficientBalanceOverlay() {
    const ctx = this.ctx;
    const centerX = GAME_WIDTH / 2;
    const centerY = GAME_HEIGHT * 0.45;

    // Dark overlay
    ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Pulsing animation
    const pulse = 1 + Math.sin(this.time / 200) * 0.03;

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.scale(pulse, pulse);

    // Warning box background
    ctx.fillStyle = "rgba(180, 83, 9, 0.9)";
    ctx.beginPath();
    ctx.roundRect(-120, -70, 240, 140, 12);
    ctx.fill();

    // Border
    ctx.strokeStyle = "#F59E0B";
    ctx.lineWidth = 3;
    ctx.stroke();

    // Warning icon (triangle with !)
    ctx.fillStyle = "#FCD34D";
    ctx.beginPath();
    ctx.moveTo(0, -45);
    ctx.lineTo(-20, -15);
    ctx.lineTo(20, -15);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#78350F";
    ctx.font = "bold 18px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("!", 0, -27);

    // Main text
    ctx.fillStyle = "#FEF3C7";
    ctx.font = "bold 18px monospace";
    ctx.fillText("INSUFFICIENT", 0, 10);
    ctx.fillText("BALANCE", 0, 32);

    // Subtitle
    ctx.font = "12px monospace";
    ctx.fillStyle = "#FDE68A";
    ctx.fillText("Fund wallet to play", 0, 55);

    ctx.restore();
  }

  private drawWaitingIndicator() {
    const ctx = this.ctx;

    // Waiting dots animation
    const dots = Math.floor((this.time / 500) % 4);
    const text = "Waiting" + ".".repeat(dots);

    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.beginPath();
    ctx.roundRect(GAME_WIDTH / 2 - 60, 20, 120, 30, 8);
    ctx.fill();

    ctx.fillStyle = COLORS.text;
    ctx.font = "16px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, GAME_WIDTH / 2, 35);
  }

  private drawBiteIndicator(state: GameStateData) {
    const ctx = this.ctx;
    const bobber = this.getBobberPosition(state);

    // Pulsing scale (matching reference: time / 80)
    const pulse = 1 + Math.sin(this.time / 80) * 0.15;

    ctx.save();
    ctx.translate(bobber.x, bobber.y - 60);
    ctx.scale(pulse, pulse);

    // Golden circle
    ctx.fillStyle = "#FFD700";
    ctx.beginPath();
    ctx.arc(0, 0, 22, 0, Math.PI * 2);
    ctx.fill();

    // TAP text
    ctx.fillStyle = "#000";
    ctx.font = "bold 18px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("TAP!", 0, 0);

    ctx.restore();

    // Timer bar
    const timerWidth = 100;
    const timerHeight = 8;
    const timerX = GAME_WIDTH / 2 - timerWidth / 2;
    const timerY = GAME_HEIGHT * 0.85;
    const timerProgress = state.biteTimer / 1500;

    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.beginPath();
    ctx.roundRect(timerX - 5, timerY - 5, timerWidth + 10, timerHeight + 10, 5);
    ctx.fill();

    ctx.fillStyle = "#FFD700";
    ctx.beginPath();
    ctx.roundRect(timerX, timerY, timerWidth * timerProgress, timerHeight, 3);
    ctx.fill();
  }

  private drawReelingUI(state: GameStateData) {
    const ctx = this.ctx;

    // === Tension bar (right side, vertical) ===
    const tensionX = GAMEPLAY.TENSION_BAR_X;
    const tensionY = GAMEPLAY.TENSION_BAR_Y;
    const tensionWidth = GAMEPLAY.TENSION_BAR_WIDTH;
    const tensionHeight = GAMEPLAY.TENSION_BAR_HEIGHT;

    // Background
    ctx.fillStyle = COLORS.progressBg;
    ctx.beginPath();
    ctx.roundRect(tensionX - 3, tensionY - 3, tensionWidth + 6, tensionHeight + 6, 4);
    ctx.fill();

    // Danger zone (top 30%)
    ctx.fillStyle = "rgba(244, 67, 54, 0.3)";
    ctx.fillRect(tensionX, tensionY, tensionWidth, tensionHeight * 0.3);

    // Fighting zone indicator - shows target range during fights
    if (state.fishIsFighting) {
      const zoneMinY = tensionY + tensionHeight - (GAMEPLAY.FIGHT_ZONE_MIN / 100) * tensionHeight;
      const zoneMaxY = tensionY + tensionHeight - (GAMEPLAY.FIGHT_ZONE_MAX / 100) * tensionHeight;
      const zoneHeight = zoneMinY - zoneMaxY;

      // Check if player is in zone
      const inZone = state.tension >= GAMEPLAY.FIGHT_ZONE_MIN && state.tension <= GAMEPLAY.FIGHT_ZONE_MAX;

      // Pulsing glow effect for the zone
      const pulseAlpha = 0.3 + Math.sin(this.time / 150) * 0.15;

      // Zone background - green if in zone, red warning if outside
      ctx.fillStyle = inZone
        ? `rgba(76, 175, 80, ${pulseAlpha})`
        : `rgba(255, 152, 0, ${pulseAlpha})`;
      ctx.fillRect(tensionX, zoneMaxY, tensionWidth, zoneHeight);

      // Zone border markers
      ctx.strokeStyle = inZone ? "#4CAF50" : "#FF9800";
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(tensionX - 5, zoneMaxY);
      ctx.lineTo(tensionX + tensionWidth + 5, zoneMaxY);
      ctx.moveTo(tensionX - 5, zoneMinY);
      ctx.lineTo(tensionX + tensionWidth + 5, zoneMinY);
      ctx.stroke();
      ctx.setLineDash([]);

      // "ZONE" label
      ctx.fillStyle = inZone ? "#4CAF50" : "#FF9800";
      ctx.font = "bold 8px monospace";
      ctx.textAlign = "right";
      ctx.fillText("ZONE", tensionX - 8, zoneMaxY + zoneHeight / 2 + 3);
    }

    // Tension fill (from bottom)
    const tensionFillHeight = (state.tension / 100) * tensionHeight;
    let tensionColor: string = COLORS.tensionLow;
    if (state.tension > GAMEPLAY.TENSION_HIGH_THRESHOLD) {
      tensionColor = COLORS.tensionHigh;
    } else if (state.tension > GAMEPLAY.TENSION_LOW_THRESHOLD) {
      tensionColor = COLORS.tensionMed;
    }

    ctx.fillStyle = tensionColor;
    ctx.fillRect(tensionX, tensionY + tensionHeight - tensionFillHeight, tensionWidth, tensionFillHeight);

    // Border (flashes orange when fighting)
    ctx.strokeStyle = state.fishIsFighting && Math.sin(this.time / 60) > 0 ? "#FF9800" : "#FFFFFF";
    ctx.lineWidth = 2;
    ctx.strokeRect(tensionX, tensionY, tensionWidth, tensionHeight);

    // Label
    ctx.save();
    ctx.translate(tensionX - 8, tensionY + tensionHeight / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = COLORS.text;
    ctx.font = "10px monospace";
    ctx.textAlign = "center";
    ctx.fillText("TENSION", 0, 0);
    ctx.restore();

    // === Progress bar (bottom, horizontal) ===
    const progressX = GAMEPLAY.PROGRESS_BAR_X;
    const progressY = GAMEPLAY.PROGRESS_BAR_Y;
    const progressWidth = GAMEPLAY.PROGRESS_BAR_WIDTH;
    const progressHeight = GAMEPLAY.PROGRESS_BAR_HEIGHT;

    // Background
    ctx.fillStyle = COLORS.progressBg;
    ctx.beginPath();
    ctx.roundRect(progressX - 3, progressY - 3, progressWidth + 6, progressHeight + 6, 4);
    ctx.fill();

    // Progress fill
    const progressFillWidth = (state.progress / 100) * progressWidth;
    ctx.fillStyle = COLORS.progressBar;
    ctx.fillRect(progressX, progressY, progressFillWidth, progressHeight);

    // Border
    ctx.strokeStyle = "#FFFFFF";
    ctx.lineWidth = 2;
    ctx.strokeRect(progressX, progressY, progressWidth, progressHeight);

    // Mystery fish icon at progress position (fish identity unknown until caught!)
    const fishX = progressX + progressFillWidth + 20;
    const fishY = progressY + progressHeight / 2;

    // Show silhouette/mystery fish - dark gray with question mark feel
    ctx.fillStyle = "#4A5568";
    ctx.beginPath();
    ctx.ellipse(fishX, fishY, 12, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    // Tail
    ctx.beginPath();
    ctx.moveTo(fishX + 10, fishY);
    ctx.lineTo(fishX + 18, fishY - 6);
    ctx.lineTo(fishX + 18, fishY + 6);
    ctx.closePath();
    ctx.fill();

    // Question mark on fish
    ctx.fillStyle = "#A0AEC0";
    ctx.font = "bold 10px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("?", fishX - 2, fishY);

    // Fighting alert
    if (state.fishIsFighting) {
      const alertPulse = 1 + Math.sin(this.time / 80) * 0.1;

      ctx.save();
      ctx.translate(GAME_WIDTH / 2, 50);
      ctx.scale(alertPulse, alertPulse);

      ctx.fillStyle = "#FF9800";
      ctx.beginPath();
      ctx.roundRect(-50, -15, 100, 30, 8);
      ctx.fill();

      ctx.fillStyle = "#000";
      ctx.font = "bold 16px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("FIGHTING!", 0, 0);

      ctx.restore();
    }

    // Instructions
    ctx.font = "14px monospace";
    ctx.textAlign = "center";
    if (state.fishIsFighting) {
      const inZone = state.tension >= GAMEPLAY.FIGHT_ZONE_MIN && state.tension <= GAMEPLAY.FIGHT_ZONE_MAX;
      ctx.fillStyle = inZone ? "#4CAF50" : "#FF9800";
      const instruction = inZone
        ? "Keep it steady!"
        : "Get tension in the ZONE!";
      ctx.fillText(instruction, GAME_WIDTH / 2, GAME_HEIGHT - 30);
    } else {
      ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
      ctx.fillText("HOLD to reel • RELEASE to ease tension", GAME_WIDTH / 2, GAME_HEIGHT - 30);
    }
  }

  private drawRevealingUI() {
    const ctx = this.ctx;
    const centerX = GAME_WIDTH / 2;
    const centerY = GAME_HEIGHT * 0.4;

    // Dark overlay
    ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Pulsing effect for attention
    const pulse = 1 + Math.sin(this.time / 150) * 0.05;

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.scale(pulse, pulse);

    // "STOP CLICKING" warning - prominent
    ctx.fillStyle = "#FCD34D";
    ctx.font = "bold 28px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("STOP CLICKING!", 0, -40);

    // Hand/stop icon (simple circle with hand)
    ctx.strokeStyle = "#FCD34D";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 20, 30, 0, Math.PI * 2);
    ctx.stroke();

    // Palm icon inside
    ctx.fillStyle = "#FCD34D";
    ctx.font = "bold 30px monospace";
    ctx.fillText("✋", 0, 22);

    ctx.restore();

    // Subtext with animated dots
    const dots = Math.floor((this.time / 400) % 4);
    ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
    ctx.font = "16px monospace";
    ctx.textAlign = "center";
    ctx.fillText("Wallet prompt incoming" + ".".repeat(dots), centerX, centerY + 80);

    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    ctx.font = "12px monospace";
    ctx.fillText("Sign to reveal your catch", centerX, centerY + 105);
  }

  private drawCaughtFish(state: GameStateData) {
    const ctx = this.ctx;
    if (!state.lastCatch) return;

    const centerX = GAME_WIDTH / 2;
    const fishY = state.caughtFishY;

    // Dark overlay
    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Fish colors
    const fishColors = RARITY_COLORS[state.lastCatch.rarity];
    const fishSize = Math.min(state.lastCatch.size, 80);

    ctx.save();
    ctx.translate(centerX, fishY);

    // Glow effect for rare+ (matching reference)
    if (fishColors.glow) {
      const glowPulse = 1 + Math.sin(this.time / 200) * 0.2;
      ctx.shadowColor = fishColors.glow;
      ctx.shadowBlur = 30 * glowPulse;

      ctx.fillStyle = fishColors.glow + "40";
      ctx.beginPath();
      ctx.ellipse(0, 0, fishSize * 1.5, fishSize, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.shadowBlur = 0;
    }

    // Fish body
    ctx.fillStyle = fishColors.primary;
    ctx.beginPath();
    ctx.ellipse(0, 0, fishSize, fishSize * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Darker top half
    ctx.fillStyle = fishColors.secondary;
    ctx.beginPath();
    ctx.ellipse(0, 0, fishSize, fishSize * 0.6, 0, Math.PI, Math.PI * 2);
    ctx.fill();

    // Tail
    ctx.fillStyle = fishColors.primary;
    ctx.beginPath();
    ctx.moveTo(fishSize * 0.8, 0);
    ctx.lineTo(fishSize * 1.4, -fishSize * 0.5);
    ctx.lineTo(fishSize * 1.4, fishSize * 0.5);
    ctx.closePath();
    ctx.fill();

    // Dorsal fin
    ctx.fillStyle = fishColors.secondary;
    ctx.beginPath();
    ctx.moveTo(-fishSize * 0.2, -fishSize * 0.55);
    ctx.lineTo(fishSize * 0.3, -fishSize * 0.55);
    ctx.lineTo(fishSize * 0.1, -fishSize * 0.9);
    ctx.closePath();
    ctx.fill();

    // Scales (curved lines)
    ctx.strokeStyle = fishColors.secondary + "80";
    ctx.lineWidth = 1;
    for (let i = 0; i < 3; i++) {
      const scaleX = -fishSize * 0.3 + i * fishSize * 0.3;
      ctx.beginPath();
      ctx.arc(scaleX, 0, fishSize * 0.25, -0.5, 0.5);
      ctx.stroke();
    }

    // Eye
    ctx.fillStyle = "#FFFFFF";
    ctx.beginPath();
    ctx.arc(-fishSize * 0.55, -fishSize * 0.1, fishSize * 0.15, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#000000";
    ctx.beginPath();
    ctx.arc(-fishSize * 0.55, -fishSize * 0.1, fishSize * 0.08, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    // "NICE CATCH!" text
    ctx.fillStyle = "#4CAF50";
    ctx.font = "bold 28px monospace";
    ctx.textAlign = "center";
    ctx.fillText("NICE CATCH!", centerX, fishY - 100);

    // Rarity badge
    ctx.fillStyle = fishColors.primary;
    ctx.beginPath();
    ctx.roundRect(centerX - 50, fishY + 70, 100, 25, 5);
    ctx.fill();

    ctx.fillStyle = "#000";
    ctx.font = "bold 14px monospace";
    ctx.fillText(state.lastCatch.rarity, centerX, fishY + 82);

    // Fish name
    ctx.fillStyle = COLORS.text;
    ctx.font = "bold 20px monospace";
    ctx.fillText(state.lastCatch.name, centerX, fishY + 115);

    // Size
    ctx.font = "14px monospace";
    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    ctx.fillText(`${state.lastCatch.size} cm`, centerX, fishY + 140);

    // Payout display
    if (state.lastPayout !== null) {
      const isWin = state.lastPayout > 0;
      const payoutText = isWin ? `+${state.lastPayout}` : `-${state.stake}`;
      ctx.font = "bold 24px monospace";
      ctx.fillStyle = isWin ? "#4CAF50" : "#F44336";
      ctx.fillText(payoutText, centerX, fishY + 175);
    }

    // Tap to continue
    if (state.resultTimer <= 0) {
      const alpha = 0.5 + Math.sin(this.time / 300) * 0.3;
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.font = "14px monospace";
      ctx.fillText("Tap to continue", centerX, GAME_HEIGHT - 50);
    }
  }

  private drawEscapedMessage(state: GameStateData) {
    const ctx = this.ctx;
    const centerX = GAME_WIDTH / 2;
    const centerY = GAME_HEIGHT * 0.4;

    // Dark overlay
    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // "IT GOT AWAY!" text
    ctx.fillStyle = "#F44336";
    ctx.font = "bold 28px monospace";
    ctx.textAlign = "center";
    ctx.fillText("IT GOT AWAY!", centerX, centerY);

    // Advice
    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    ctx.font = "14px monospace";
    ctx.fillText("Watch your tension!", centerX, centerY + 40);

    // Lost stake display
    if (state.stake > 0) {
      ctx.font = "bold 24px monospace";
      ctx.fillStyle = "#F44336";
      ctx.fillText(`-${state.stake}`, centerX, centerY + 80);
    }

    // Tap to try again
    if (state.resultTimer <= 0) {
      const alpha = 0.5 + Math.sin(this.time / 300) * 0.3;
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.fillText("Tap to try again", centerX, GAME_HEIGHT - 50);
    }
  }
}
