/**
 * Integration helper for @stacks/connect and @stacks/transactions
 * This file demonstrates how to use both packages together to build
 * and broadcast transactions with wallet authentication.
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
  createAssetInfo,
  FungibleConditionCode,
} from '@stacks/transactions';
import {
  openContractCall,
  openSTXTransfer,
  UserSession,
  showConnect,
  AppConfig,
  UserData,
} from '@stacks/connect';

// Network configuration
export const appConfig: AppConfig = {
  appDetails: {
    name: 'Clarprice Prediction Market',
    icon: window.location.origin + '/logo.png',
  },
  // Use testnet for development, mainnet for production
  network: {
    address: 'https://api.testnet.hiro.so',
    coreApiUrl: 'https://api.testnet.hiro.so',
  },
};

/**
 * Helper class for building and sending transactions
 */
export class TransactionHelper {
  private userSession: UserSession;

  constructor() {
    this.userSession = new UserSession({ appConfig });
  }

  /**
   * Get the current user session
   */
  getUserSession(): UserSession {
    return this.userSession;
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return this.userSession.isUserSignedIn();
  }

  /**
   * Get current user data
   */
  getUserData(): UserData | undefined {
    return this.userSession.loadUserData();
  }

  /**
   * Connect wallet using @stacks/connect
   */
  async connectWallet(): Promise<void> {
    await showConnect({
      appDetails: {
        name: 'Clarprice Prediction Market',
        icon: window.location.origin + '/logo.png',
      },
      redirectTo: '/',
      onFinish: () => {
        window.location.reload();
      },
      userSession: this.userSession,
    });
  }

  /**
   * Disconnect wallet
   */
  disconnectWallet(): void {
    this.userSession.signUserOut();
  }

  /**
   * Build a contract call transaction using @stacks/transactions
   */
  async buildContractCall(
    contractAddress: string,
    contractName: string,
    functionName: string,
    functionArgs: any[],
    senderKey: string,
    network: 'mainnet' | 'testnet' = 'testnet'
  ): Promise<StacksTransaction> {
    const networkConfig = network === 'mainnet'
      ? { address: 'https://api.hiro.so', coreApiUrl: 'https://api.hiro.so' }
      : { address: 'https://api.testnet.hiro.so', coreApiUrl: 'https://api.testnet.hiro.so' };

    const txOptions = {
      contractAddress,
      contractName,
      functionName,
      functionArgs,
      senderKey,
      network: networkConfig,
      anchorMode: AnchorMode.Any,
      postConditionMode: PostConditionMode.Allow,
    };

    return await makeContractCall(txOptions);
  }

  /**
   * Create a market using @stacks/connect (wallet popup)
   */
  async createMarket(
    category: string,
    question: string,
    outcomeA: string,
    outcomeB: string,
    endTime: number
  ): Promise<void> {
    const userData = this.getUserData();
    if (!userData) {
      throw new Error('User not authenticated');
    }

    await openContractCall({
      contractAddress: userData.profile.stxAddress.testnet,
      contractName: 'prediction-market',
      functionName: 'create-market',
      functionArgs: [
        stringAsciiCV(category),
        stringAsciiCV(question),
        stringAsciiCV(outcomeA),
        stringAsciiCV(outcomeB),
        uintCV(endTime),
      ],
      network: appConfig.network,
      appDetails: appConfig.appDetails,
      onFinish: (data) => {
        console.log('Transaction submitted:', data);
      },
      onCancel: () => {
        console.log('Transaction cancelled');
      },
    });
  }

  /**
   * Place a bet using @stacks/connect (wallet popup)
   */
  async placeBet(
    marketId: number,
    outcome: string,
    amount: bigint,
    contractAddress: string
  ): Promise<void> {
    const userData = this.getUserData();
    if (!userData) {
      throw new Error('User not authenticated');
    }

    await openContractCall({
      contractAddress,
      contractName: 'prediction-market',
      functionName: 'place-bet',
      functionArgs: [
        uintCV(marketId),
        stringAsciiCV(outcome),
        uintCV(amount),
      ],
      network: appConfig.network,
      appDetails: appConfig.appDetails,
      postConditions: [
        makeStandardSTXPostCondition(
          userData.profile.stxAddress.testnet,
          FungibleConditionCode.Equal,
          amount
        ),
      ],
      onFinish: (data) => {
        console.log('Bet placed:', data);
      },
      onCancel: () => {
        console.log('Bet cancelled');
      },
    });
  }

  /**
   * Claim winnings using @stacks/connect (wallet popup)
   */
  async claimWinnings(
    marketId: number,
    contractAddress: string
  ): Promise<void> {
    await openContractCall({
      contractAddress,
      contractName: 'prediction-market',
      functionName: 'claim-winnings',
      functionArgs: [uintCV(marketId)],
      network: appConfig.network,
      appDetails: appConfig.appDetails,
      onFinish: (data) => {
        console.log('Winnings claimed:', data);
      },
      onCancel: () => {
        console.log('Claim cancelled');
      },
    });
  }

  /**
   * Resolve a market (admin only) using @stacks/connect
   */
  async resolveMarket(
    marketId: number,
    winningOutcome: string,
    contractAddress: string
  ): Promise<void> {
    await openContractCall({
      contractAddress,
      contractName: 'prediction-market',
      functionName: 'resolve-market',
      functionArgs: [
        uintCV(marketId),
        stringAsciiCV(winningOutcome),
      ],
      network: appConfig.network,
      appDetails: appConfig.appDetails,
      onFinish: (data) => {
        console.log('Market resolved:', data);
      },
      onCancel: () => {
        console.log('Resolution cancelled');
      },
    });
  }

  /**
   * Transfer STX using @stacks/connect
   */
  async transferSTX(
    recipient: string,
    amount: bigint
  ): Promise<void> {
    const userData = this.getUserData();
    if (!userData) {
      throw new Error('User not authenticated');
    }

    await openSTXTransfer({
      recipient,
      amount: amount.toString(),
      network: appConfig.network,
      appDetails: appConfig.appDetails,
      onFinish: (data) => {
        console.log('STX transferred:', data);
      },
      onCancel: () => {
        console.log('Transfer cancelled');
      },
    });
  }

  /**
   * Broadcast a transaction using @stacks/transactions
   * (Useful for programmatic transactions with private keys)
   */
  async broadcastTransaction(
    transaction: StacksTransaction,
    network: 'mainnet' | 'testnet' = 'testnet'
  ): Promise<string> {
    const networkConfig = network === 'mainnet'
      ? { address: 'https://api.hiro.so', coreApiUrl: 'https://api.hiro.so' }
      : { address: 'https://api.testnet.hiro.so', coreApiUrl: 'https://api.testnet.hiro.so' };

    const response = await broadcastTransaction(transaction, networkConfig);
    return response.txid;
  }
}
