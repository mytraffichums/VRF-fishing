# VRF Fishing

A fishing game with provably fair on-chain randomness using Pyth Entropy on Monad Testnet.

## How to Play

1. **Tap to Cast** — Your line flies into the water
2. **Wait for Bite** — Watch for the "TAP!" indicator
3. **Tap to Hook** — Quick! Tap before it escapes
4. **Reel it In** — Hold to reel, release to ease tension

> **During Fights:** Keep tension in the green ZONE or lose progress!

> **Staking:** Coming soon! On-chain staking will be implemented in a future update.

## Pyth Entropy VRF

This game uses **Pyth Entropy** for provably fair on-chain randomness on **Monad Testnet**.

### How it works:

- Player successfully reels in fish
- Contract requests random number from Pyth
- Pyth Entropy generates verifiable randomness
- Fish rarity & type determined on-chain

**Why it matters:** Randomness is generated AFTER successful gameplay, ensuring fair outcomes that can't be predicted or manipulated.

No on-chain cost for failed attempts — only successful catches trigger the VRF call.

## Tech Stack

- **Monad Testnet** — High-performance EVM chain
- **Pyth Entropy** — Verifiable random function
- **Privy Auth** — Wallet authentication
- **Next.js** — React framework
- **wagmi** — Ethereum hooks

## Acknowledgments

This project is based on [missionx-example-app](https://github.com/portdeveloper/missionx-example-app) by portdeveloper.
