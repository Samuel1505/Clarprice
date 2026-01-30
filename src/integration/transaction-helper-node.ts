/**
 * Node.js-compatible version of TransactionHelper
 * For use in backend services, scripts, and server-side applications
 * This version uses @stacks/transactions directly without browser dependencies
 */

import {
  broadcastTransaction,
  makeContractCall,
  PostConditionMode,
  StacksTransactionWire,
  standardPrincipalCV,
  stringAsciiCV,
  uintCV,
  StxPostCondition,
  getAddressFromPrivateKey,
} from '@stacks/transactions';
import { StacksNetworkName } from '@stacks/network';

/**
 * Node.js-compatible helper class for building and sending transactions
 * Use this for backend services, scripts, and automated transactions
 */
export class TransactionHelperNode {
  private network: StacksNetworkName;

  constructor(network: 'mainnet' | 'testnet' = 'testnet') {
    this.network = network;
  }

  /**
   * Get the current network configuration
   */
  getNetwork(): StacksNetworkName {
    return this.network;
  }

  /**
   * Get address from private key
   */
  getAddressFromPrivateKey(privateKey: string, network?: 'mainnet' | 'testnet'): string {
    const networkParam = (network || this.network) as 'mainnet' | 'testnet';
    return getAddressFromPrivateKey(privateKey, networkParam);
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
  ): Promise<StacksTransactionWire> {
    const txOptions = {
      contractAddress,
      contractName,
      functionName,
      functionArgs,
      senderKey,
      network: this.network,
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
      this.network as 'mainnet' | 'testnet'
    );

    const postCondition: StxPostCondition = {
      type: 'stx-postcondition',
      address: senderAddress,
      condition: 'eq',
      amount: amount,
    };

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
      postConditionMode: PostConditionMode.Allow,
      postConditions: [postCondition],
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
      this.network as 'mainnet' | 'testnet'
    );

    const postCondition: StxPostCondition = {
      type: 'stx-postcondition',
      address: senderAddress,
      condition: 'eq',
      amount: amount,
    };

    const transaction = await makeContractCall({
      contractAddress,
      contractName: 'prediction-market',
      functionName: 'fund-treasury',
      functionArgs: [uintCV(amount)],
      senderKey: privateKey,
      network: this.network,
      postConditionMode: PostConditionMode.Allow,
      postConditions: [postCondition],
    });

    return await this.broadcastTransaction(transaction);
  }

  /**
   * Broadcast a transaction
   */
  async broadcastTransaction(transaction: StacksTransactionWire): Promise<string> {
    const response = await broadcastTransaction({ transaction, network: this.network });
    if ('error' in response) {
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
    const baseUrl = this.network === 'mainnet' 
      ? 'https://api.hiro.so' 
      : 'https://api.testnet.hiro.so';
    const apiUrl = `${baseUrl}/v2/contracts/call-read/${contractAddress}/${contractName}/${functionName}`;

    const { serializeCV } = await import('@stacks/transactions');
    const serializedArgs = functionArgs.map(arg => {
      // Convert Cl values to hex
      try {
        const serialized = serializeCV(arg);
        return Buffer.from(serialized).toString('hex');
      } catch {
        return arg;
      }
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
