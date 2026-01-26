# ClarPrecise

A decentralized prediction market implementation built on Stacks using Clarity.

## Overview

ClarPrecise is a smart contract based prediction market where users can:
- **Create Markets**: Define a prediction market with a category, question, two possible outcomes (e.g., YES/NO, A/B), and an end time.
- **Place Bets**: Wager STX on their preferred outcome.
- **Earn Rewards**: Winners claim their share of the losing pool.
- **Build Streaks**: Users can earn multipliers on their winnings by building a streak of consecutive correct predictions.

## Features

- **Decentralized & Trustless**: All logic is handled by the `prediction-market` smart contract.
- **Streak Multipliers**: Incentivizes consistent correct predictions with payout bonuses.
- **Treasury Management**: A treasury fund supports the bonus payouts.
- **Input Validation**: Robust checks ensure market integrity (e.g., valid end times, non-empty data).

## Contracts

- `contracts/prediction-market.clar`: The core logic for market creation, betting, resolution, and claiming.
- `contracts/predict.clar`: (Helper/Stub contract if applicable, or remove if unused).

## Prerequisites

To run this project, you need:

- [Clarinet](https://github.com/hirosystems/clarinet): A Clarity runtime and testing harness.
- [Node.js](https://nodejs.org/) & `npm`: For running the TypeScript test suite.

## Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd ClarPrecise
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

## Development

### Check Contracts

Run the Clarinet check tool to verify contract syntax and types:
```bash
clarinet check
```

### Run Tests

Execute the comprehensive test suite written in TypeScript/Vitest:
```bash
npm test
```

### Console

Interact with the contracts simply in a simulated environment:
```bash
clarinet console
```

## Project Structure

- `contracts/`: Clarity smart contract source files.
- `tests/`: TypeScript test files using `vitest` and `@stacks/clarinet-sdk`.
- `settings/`: Configuration for different network environments (Devnet, Testnet, Mainnet).
- `Clarinet.toml`: Project configuration and dependency management.

## License

[MIT](LICENSE)
