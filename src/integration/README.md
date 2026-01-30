# Integration Guide: @stacks/connect and @stacks/transactions

This directory contains integration examples and helpers for using `@stacks/connect` and `@stacks/transactions` with the Clarprice Prediction Market contract.

## Overview

- **@stacks/connect**: Provides wallet connection UI and transaction signing through user's wallet (Hiro Wallet, Xverse, etc.)
- **@stacks/transactions**: Provides low-level transaction building and broadcasting capabilities

## Files

### `transaction-helper.ts`
A comprehensive helper class that wraps both packages and provides easy-to-use methods for:
- Wallet connection and authentication
- Building contract call transactions
- Sending transactions via wallet popups
- Broadcasting transactions programmatically

### `transaction-helper-node.ts`
Node.js-compatible version of TransactionHelper for:
- Backend services and server-side applications
- Automated scripts and bots
- No browser dependencies

### `example-usage.ts`
Practical examples demonstrating:
- Wallet-based transactions (web app use case)
- Programmatic transactions (backend/script use case)
- Read-only contract calls
- Complete workflow examples

### `tests/integration.test.ts`
Integration tests showing how both packages work together with the Clarinet SDK.

## Usage

### For Web Applications (Frontend)

Use `@stacks/connect` for user-facing transactions:

```typescript
import { TransactionHelper } from './src/integration/transaction-helper';

const helper = new TransactionHelper();

// Connect wallet
if (!helper.isAuthenticated()) {
  await helper.connectWallet();
}

// Create a market
await helper.createMarket(
  'CRYPTO',
  'Will BTC hit 100k?',
  'YES',
  'NO',
  10000
);

// Place a bet
await helper.placeBet(
  1, // market ID
  'YES', // outcome
  BigInt(1000000), // 1 STX in microSTX
  'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM' // contract address
);
```

### For Backend Services / Scripts

Use `TransactionHelperNode` for Node.js environments:

```typescript
import { TransactionHelperNode } from './src/integration/transaction-helper-node';

const helper = new TransactionHelperNode('testnet');

// Create a market
const txid = await helper.createMarket(
  privateKey,
  contractAddress,
  'CRYPTO',
  'Will BTC hit 100k?',
  'YES',
  'NO',
  10000
);

// Place a bet
const betTxid = await helper.placeBet(
  privateKey,
  contractAddress,
  1, // market ID
  'YES', // outcome
  BigInt(1000000) // 1 STX
);

// Read contract data
const marketData = await helper.getMarket(
  contractAddress,
  1, // market ID
  senderAddress
);
```

Or use `@stacks/transactions` directly for programmatic transactions:

```typescript
import {
  makeContractCall,
  broadcastTransaction,
  AnchorMode,
  PostConditionMode,
  stringAsciiCV,
  uintCV,
} from '@stacks/transactions';

// Build transaction
const transaction = await makeContractCall({
  contractAddress: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM',
  contractName: 'prediction-market',
  functionName: 'place-bet',
  functionArgs: [
    uintCV(1),
    stringAsciiCV('YES'),
    uintCV(1000000),
  ],
  senderKey: privateKey,
  network: {
    address: 'https://api.testnet.hiro.so',
    coreApiUrl: 'https://api.testnet.hiro.so',
  },
  anchorMode: AnchorMode.Any,
  postConditionMode: PostConditionMode.Allow,
});

// Broadcast
const txid = await broadcastTransaction(transaction, {
  address: 'https://api.testnet.hiro.so',
  coreApiUrl: 'https://api.testnet.hiro.so',
});
```

## Network Configuration

The examples use **testnet** by default. For mainnet:

```typescript
const network = {
  address: 'https://api.hiro.so',
  coreApiUrl: 'https://api.hiro.so',
};
```

## Available Contract Functions

### Admin Functions
- `create-market`: Create a new prediction market
- `resolve-market`: Resolve a market with winning outcome
- `fund-treasury`: Fund the treasury for streak bonuses

### User Functions
- `place-bet`: Place a bet on a market outcome
- `claim-winnings`: Claim winnings after market resolution

### Read-Only Functions
- `get-market`: Get market details
- `get-bet`: Get user's bet for a market
- `get-user-stats`: Get user statistics (streaks, earnings, etc.)

## Testing

Run the integration tests:

```bash
npm test
```

The integration tests demonstrate:
- Building transactions with `@stacks/transactions` Cl types
- Using types seamlessly with Clarinet SDK
- Error handling
- Complex multi-step workflows

## Notes

- `transaction-helper.ts` uses browser APIs (`window`) and is intended for web applications
- For Node.js environments, use `@stacks/transactions` directly (see `example-usage.ts`)
- All amounts are in **microSTX** (1 STX = 1,000,000 microSTX)
- Always handle errors and user cancellations in production code

## Resources

- [@stacks/connect Documentation](https://github.com/hirosystems/connect)
- [@stacks/transactions Documentation](https://github.com/hirosystems/stacks.js/tree/master/packages/transactions)
- [Stacks Documentation](https://docs.stacks.co)
