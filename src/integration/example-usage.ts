/**
 * Example usage of @stacks/connect and @stacks/transactions integration
 * This file demonstrates various use cases for the prediction market contract
 */

import { TransactionHelper } from './transaction-helper';
import {
  Cl,
  makeContractCall,
  broadcastTransaction,
  AnchorMode,
  PostConditionMode,
  standardPrincipalCV,
  uintCV,
  stringAsciiCV,
} from '@stacks/transactions';

/**
 * Example 1: Using @stacks/connect for wallet-based transactions
 * This is the recommended approach for web applications
 */
export async function exampleWalletIntegration() {
  const helper = new TransactionHelper();

  // Check if user is authenticated
  if (!helper.isAuthenticated()) {
    // Connect wallet
    await helper.connectWallet();
    return;
  }

  const userData = helper.getUserData();
  console.log('Connected user:', userData?.profile.stxAddress);

  // Example: Create a market
  try {
    await helper.createMarket(
      'CRYPTO',
      'Will BTC hit 100k?',
      'YES',
      'NO',
      10000 // end time
    );
  } catch (error) {
    console.error('Error creating market:', error);
  }

  // Example: Place a bet
  try {
    await helper.placeBet(
      1, // market ID
      'YES', // outcome
      BigInt(1000000), // amount in microSTX (1 STX)
      'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM' // contract address
    );
  } catch (error) {
    console.error('Error placing bet:', error);
  }

  // Example: Claim winnings
  try {
    await helper.claimWinnings(
      1, // market ID
      'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM' // contract address
    );
  } catch (error) {
    console.error('Error claiming winnings:', error);
  }
}

/**
 * Example 2: Using @stacks/transactions for programmatic transactions
 * This is useful for backend services or automated scripts
 */
export async function exampleProgrammaticTransactions(
  privateKey: string,
  contractAddress: string
) {
  // Build transaction using @stacks/transactions
  const transaction = await makeContractCall({
    contractAddress,
    contractName: 'prediction-market',
    functionName: 'place-bet',
    functionArgs: [
      uintCV(1), // market ID
      stringAsciiCV('YES'), // outcome
      uintCV(1000000), // amount in microSTX
    ],
    senderKey: privateKey,
    network: {
      address: 'https://api.testnet.hiro.so',
      coreApiUrl: 'https://api.testnet.hiro.so',
    },
    anchorMode: AnchorMode.Any,
    postConditionMode: PostConditionMode.Allow,
  });

  // Broadcast transaction
  try {
    const txid = await broadcastTransaction(transaction, {
      address: 'https://api.testnet.hiro.so',
      coreApiUrl: 'https://api.testnet.hiro.so',
    });
    console.log('Transaction broadcasted:', txid);
    return txid;
  } catch (error) {
    console.error('Error broadcasting transaction:', error);
    throw error;
  }
}

/**
 * Example 3: Reading contract data
 * This doesn't require authentication, just network access
 */
export async function exampleReadOnlyCalls(contractAddress: string) {
  // For read-only calls, you can use the Stacks API directly
  const marketId = 1;
  const apiUrl = `https://api.testnet.hiro.so/v2/contracts/call-read/${contractAddress}/prediction-market/get-market`;

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sender: contractAddress,
        arguments: [Cl.uint(marketId).serialize().toString('hex')],
      }),
    });

    const data = await response.json();
    console.log('Market data:', data);
    return data;
  } catch (error) {
    console.error('Error reading market data:', error);
    throw error;
  }
}

/**
 * Example 4: Complete workflow
 * Creating a market, placing bets, and resolving
 */
export async function exampleCompleteWorkflow(
  contractAddress: string,
  adminPrivateKey: string,
  userPrivateKey: string
) {
  // Step 1: Admin creates a market
  const createMarketTx = await makeContractCall({
    contractAddress,
    contractName: 'prediction-market',
    functionName: 'create-market',
    functionArgs: [
      stringAsciiCV('SPORTS'),
      stringAsciiCV('Team A vs Team B'),
      stringAsciiCV('A'),
      stringAsciiCV('B'),
      uintCV(10000),
    ],
    senderKey: adminPrivateKey,
    network: {
      address: 'https://api.testnet.hiro.so',
      coreApiUrl: 'https://api.testnet.hiro.so',
    },
    anchorMode: AnchorMode.Any,
    postConditionMode: PostConditionMode.Allow,
  });

  const createTxid = await broadcastTransaction(createMarketTx, {
    address: 'https://api.testnet.hiro.so',
    coreApiUrl: 'https://api.testnet.hiro.so',
  });
  console.log('Market created:', createTxid);

  // Step 2: User places a bet
  const betTx = await makeContractCall({
    contractAddress,
    contractName: 'prediction-market',
    functionName: 'place-bet',
    functionArgs: [
      uintCV(1), // Assuming market ID is 1
      stringAsciiCV('A'),
      uintCV(1000000), // 1 STX
    ],
    senderKey: userPrivateKey,
    network: {
      address: 'https://api.testnet.hiro.so',
      coreApiUrl: 'https://api.testnet.hiro.so',
    },
    anchorMode: AnchorMode.Any,
    postConditionMode: PostConditionMode.Allow,
  });

  const betTxid = await broadcastTransaction(betTx, {
    address: 'https://api.testnet.hiro.so',
    coreApiUrl: 'https://api.testnet.hiro.so',
  });
  console.log('Bet placed:', betTxid);

  // Step 3: Admin resolves market
  const resolveTx = await makeContractCall({
    contractAddress,
    contractName: 'prediction-market',
    functionName: 'resolve-market',
    functionArgs: [
      uintCV(1),
      stringAsciiCV('A'),
    ],
    senderKey: adminPrivateKey,
    network: {
      address: 'https://api.testnet.hiro.so',
      coreApiUrl: 'https://api.testnet.hiro.so',
    },
    anchorMode: AnchorMode.Any,
    postConditionMode: PostConditionMode.Allow,
  });

  const resolveTxid = await broadcastTransaction(resolveTx, {
    address: 'https://api.testnet.hiro.so',
    coreApiUrl: 'https://api.testnet.hiro.so',
  });
  console.log('Market resolved:', resolveTxid);

  // Step 4: User claims winnings
  const claimTx = await makeContractCall({
    contractAddress,
    contractName: 'prediction-market',
    functionName: 'claim-winnings',
    functionArgs: [uintCV(1)],
    senderKey: userPrivateKey,
    network: {
      address: 'https://api.testnet.hiro.so',
      coreApiUrl: 'https://api.testnet.hiro.so',
    },
    anchorMode: AnchorMode.Any,
    postConditionMode: PostConditionMode.Allow,
  });

  const claimTxid = await broadcastTransaction(claimTx, {
    address: 'https://api.testnet.hiro.so',
    coreApiUrl: 'https://api.testnet.hiro.so',
  });
  console.log('Winnings claimed:', claimTxid);
}
