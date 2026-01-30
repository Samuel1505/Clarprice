/**
 * Node.js-compatible version of TransactionHelper
 * For use in backend services, scripts, and server-side applications
 * This version uses @stacks/transactions directly without browser dependencies
 */

import {
  AnchorMode,
  broadcastTransaction,
  makeContractCall,
  makeStandardSTXPostCondition,
  PostConditionMode,
  StacksTransaction,
  standardPrincipalCV,
  stringAsciiCV,
  uintCV,
  FungibleConditionCode,
  getAddressFromPrivateKey,
  TransactionVersion,
} from '@stacks/transactions';

export interface NetworkConfig {
  address: string;
  coreApiUrl: string;
}

export const TESTNET_CONFIG: NetworkConfig = {
  address: 'https://api.testnet.hiro.so',
  coreApiUrl: 'https://api.testnet.hiro.so',
};

export const MAINNET_CONFIG: NetworkConfig = {
  address: 'https://api.hiro.so',
  coreApiUrl: 'https://api.hiro.so',
};

/**
 * Node.js-compatible helper class for building and sending transactions
 * Use this for backend services, scripts, and automated transactions
 */
export class TransactionHelperNode {
  private network: NetworkConfig;

  constructor(network: 'mainnet' | 'testnet' = 'testnet') {
    this.network = network === 'mainnet' ? MAINNET_CONFIG : TESTNET_CONFIG;
  }

  /**
   * Get the current network configuration
   */
  getNetwork(): NetworkConfig {
    return this.network;
  }

  /**
   * Get address from private key
   */
  getAddressFromPrivateKey(privateKey: string, network: 'mainnet' | 'testnet' = 'testnet'): string {
    const version = network === 'mainnet' 
      ? TransactionVersion.Mainnet 
      : TransactionVersion.Testnet;
    return getAddressFromPrivateKey(privateKey, version);
  }

  /**
   * Build a contract call transaction
   */
  async buildContractCall(
    contractAddress: string,
    contractName: string,
    functionName: string,
    functionArgs: any[],
    senderKey: string
  ): Promise<StacksTransaction> {
    const txOptions = {
      contractAddress,
      contractName,
      functionName,
      functionArgs,
      senderKey,
      network: this.network,
      anchorMode: AnchorMode.Any,
      postConditionMode: PostConditionMode.Allow,
    };

    return await makeContractCall(txOptions);
  }

  /**
   * Create a market (admin function)
   */
  async createMarket(
    privateKey: string,
    contractAddress: string,
    category: string,
    question: string,
    outcomeA: string,
    outcomeB: string,
    endTime: number
  ): Promise<string> {
    const transaction = await this.buildContractCall(
      contractAddress,
      'prediction-market',
      'create-market',
      [
        stringAsciiCV(category),
        stringAsciiCV(question),
        stringAsciiCV(outcomeA),
        stringAsciiCV(outcomeB),
        uintCV(endTime),
      ],
      privateKey
    );

    return await this.broadcastTransaction(transaction);
  }

  /**
   * Place a bet
   */
  async placeBet(
    privateKey: string,
    contractAddress: string,
    marketId: number,
    outcome: string,
    amount: bigint
  ): Promise<string> {
    const senderAddress = this.getAddressFromPrivateKey(
      privateKey,
      this.network === MAINNET_CONFIG ? 'mainnet' : 'testnet'
    );

    const transaction = await makeContractCall({
      contractAddress,
      contractName: 'prediction-market',
      functionName: 'place-bet',
      functionArgs: [
        uintCV(marketId),
        stringAsciiCV(outcome),
        uintCV(amount),
      ],
      senderKey: privateKey,
      network: this.network,
      anchorMode: AnchorMode.Any,
      postConditionMode: PostConditionMode.Allow,
      postConditions: [
        makeStandardSTXPostCondition(
          senderAddress,
          FungibleConditionCode.Equal,
          amount
        ),
      ],
    });

    return await this.broadcastTransaction(transaction);
  }

  /**
   * Claim winnings
   */
  async claimWinnings(
    privateKey: string,
    contractAddress: string,
    marketId: number
  ): Promise<string> {
    const transaction = await this.buildContractCall(
      contractAddress,
      'prediction-market',
      'claim-winnings',
      [uintCV(marketId)],
      privateKey
    );

    return await this.broadcastTransaction(transaction);
  }

  /**
   * Resolve a market (admin function)
   */
  async resolveMarket(
    privateKey: string,
    contractAddress: string,
    marketId: number,
    winningOutcome: string
  ): Promise<string> {
    const transaction = await this.buildContractCall(
      contractAddress,
      'prediction-market',
      'resolve-market',
      [
        uintCV(marketId),
        stringAsciiCV(winningOutcome),
      ],
      privateKey
    );

    return await this.broadcastTransaction(transaction);
  }

  /**
   * Fund treasury (admin function)
   */
  async fundTreasury(
    privateKey: string,
    contractAddress: string,
    amount: bigint
  ): Promise<string> {
    const senderAddress = this.getAddressFromPrivateKey(
      privateKey,
      this.network === MAINNET_CONFIG ? 'mainnet' : 'testnet'
    );

    const transaction = await makeContractCall({
      contractAddress,
      contractName: 'prediction-market',
      functionName: 'fund-treasury',
      functionArgs: [uintCV(amount)],
      senderKey: privateKey,
      network: this.network,
      anchorMode: AnchorMode.Any,
      postConditionMode: PostConditionMode.Allow,
      postConditions: [
        makeStandardSTXPostCondition(
          senderAddress,
          FungibleConditionCode.Equal,
          amount
        ),
      ],
    });

    return await this.broadcastTransaction(transaction);
  }

  /**
   * Broadcast a transaction
   */
  async broadcastTransaction(transaction: StacksTransaction): Promise<string> {
    const response = await broadcastTransaction(transaction, this.network);
    if (response.error) {
      throw new Error(`Transaction failed: ${response.error}`);
    }
    return response.txid;
  }

  /**
   * Read contract data (read-only call)
   */
  async readContract(
    contractAddress: string,
    contractName: string,
    functionName: string,
    functionArgs: any[],
    senderAddress: string
  ): Promise<any> {
    const apiUrl = `${this.network.coreApiUrl}/v2/contracts/call-read/${contractAddress}/${contractName}/${functionName}`;

    const serializedArgs = functionArgs.map(arg => {
      // Convert Cl values to hex
      if (arg && typeof arg.serialize === 'function') {
        return arg.serialize().toString('hex');
      }
      return arg;
    });

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sender: senderAddress,
        arguments: serializedArgs,
      }),
    });

    if (!response.ok) {
      throw new Error(`API call failed: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Get market data
   */
  async getMarket(
    contractAddress: string,
    marketId: number,
    senderAddress: string
  ): Promise<any> {
    return await this.readContract(
      contractAddress,
      'prediction-market',
      'get-market',
      [uintCV(marketId)],
      senderAddress
    );
  }

  /**
   * Get user bet data
   */
  async getBet(
    contractAddress: string,
    marketId: number,
    userAddress: string,
    senderAddress: string
  ): Promise<any> {
    return await this.readContract(
      contractAddress,
      'prediction-market',
      'get-bet',
      [uintCV(marketId), standardPrincipalCV(userAddress)],
      senderAddress
    );
  }

  /**
   * Get user statistics
   */
  async getUserStats(
    contractAddress: string,
    userAddress: string,
    senderAddress: string
  ): Promise<any> {
    return await this.readContract(
      contractAddress,
      'prediction-market',
      'get-user-stats',
      [standardPrincipalCV(userAddress)],
      senderAddress
    );
  }
}
