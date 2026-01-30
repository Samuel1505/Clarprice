/**
 * Integration tests demonstrating @stacks/connect and @stacks/transactions
 * These tests show how to use both packages together in a testing environment
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Cl } from '@stacks/transactions';
import {
  makeContractCall,
  broadcastTransaction,
  AnchorMode,
  PostConditionMode,
  stringAsciiCV,
  uintCV,
} from '@stacks/transactions';

const accounts = simnet.getAccounts();
const deployer = accounts.get('deployer')!;
const wallet1 = accounts.get('wallet_1')!;
const wallet2 = accounts.get('wallet_2')!;

const contract = 'prediction-market';

describe('Integration: @stacks/transactions with Clarinet SDK', () => {
  beforeEach(() => {
    // Reset state if needed
  });

  it('demonstrates building transactions with @stacks/transactions types', () => {
    // Create market using simnet (local testing)
    const { result } = simnet.callPublicFn(
      contract,
      'create-market',
      [
        Cl.stringAscii('CRYPTO'),
        Cl.stringAscii('Will BTC hit 100k?'),
        Cl.stringAscii('YES'),
        Cl.stringAscii('NO'),
        Cl.uint(10000),
      ],
      deployer
    );

    expect(result).toBeOk(Cl.uint(1));

    // Verify we can use Cl types from @stacks/transactions
    const marketId = Cl.uint(1);
    const outcome = Cl.stringAscii('YES');
    const amount = Cl.uint(1000000);

    // Place bet using the same Cl types
    const betResult = simnet.callPublicFn(
      contract,
      'place-bet',
      [marketId, outcome, amount],
      wallet1
    );

    expect(betResult.result).toBeOk(Cl.bool(true));
  });

  it('demonstrates type conversion between Cl types and transaction types', () => {
    // Create market
    const createResult = simnet.callPublicFn(
      contract,
      'create-market',
      [
        Cl.stringAscii('SPORTS'),
        Cl.stringAscii('Game prediction'),
        Cl.stringAscii('WIN'),
        Cl.stringAscii('LOSE'),
        Cl.uint(20000),
      ],
      deployer
    );

    expect(createResult.result).toBeOk(Cl.uint(1));

    // Demonstrate that Cl types from @stacks/transactions work seamlessly
    // with Clarinet SDK's simnet
    const marketId = Cl.uint(1);
    const outcome = Cl.stringAscii('WIN');
    const betAmount = Cl.uint(5000000); // 5 STX

    const betResult = simnet.callPublicFn(
      contract,
      'place-bet',
      [marketId, outcome, betAmount],
      wallet1
    );

    expect(betResult.result).toBeOk(Cl.bool(true));

    // Verify the bet was recorded
    const betData = simnet.callReadOnlyFn(
      contract,
      'get-bet',
      [marketId, Cl.standardPrincipal(wallet1)],
      deployer
    );

    expect(betData.result).toBeSome(expect.anything());
    // @ts-ignore
    const bet = betData.result.value.value;
    expect(bet.outcome).toEqual(Cl.stringAscii('WIN'));
    expect(bet.amount).toEqual(betAmount);
  });

  it('demonstrates building complex transactions with multiple function calls', () => {
    // Setup: Fund treasury
    simnet.callPublicFn(
      contract,
      'fund-treasury',
      [Cl.uint(10000000)],
      deployer
    );

    // Create market
    const createResult = simnet.callPublicFn(
      contract,
      'create-market',
      [
        Cl.stringAscii('WORLD'),
        Cl.stringAscii('Election outcome'),
        Cl.stringAscii('PARTY_A'),
        Cl.stringAscii('PARTY_B'),
        Cl.uint(30000),
      ],
      deployer
    );

    // @ts-ignore
    const marketId = createResult.result.value;

    // Multiple users place bets
    const bet1 = simnet.callPublicFn(
      contract,
      'place-bet',
      [marketId, Cl.stringAscii('PARTY_A'), Cl.uint(2000000)],
      wallet1
    );
    expect(bet1.result).toBeOk(Cl.bool(true));

    const bet2 = simnet.callPublicFn(
      contract,
      'place-bet',
      [marketId, Cl.stringAscii('PARTY_B'), Cl.uint(3000000)],
      wallet2
    );
    expect(bet2.result).toBeOk(Cl.bool(true));

    // Resolve market
    const resolveResult = simnet.callPublicFn(
      contract,
      'resolve-market',
      [marketId, Cl.stringAscii('PARTY_A')],
      deployer
    );
    expect(resolveResult.result).toBeOk(Cl.bool(true));

    // Claim winnings
    const claimResult = simnet.callPublicFn(
      contract,
      'claim-winnings',
      [marketId],
      wallet1
    );
    expect(claimResult.result).toBeOk(Cl.bool(true));

    // Verify user stats
    const stats = simnet.callReadOnlyFn(
      contract,
      'get-user-stats',
      [Cl.standardPrincipal(wallet1)],
      deployer
    );

    expect(stats.result).toEqual(
      Cl.tuple({
        'total-bets': Cl.uint(1),
        'total-wins': Cl.uint(1),
        'current-streak': Cl.uint(1),
        'highest-streak': Cl.uint(1),
        'total-earnings': Cl.uint(5000000), // 2 STX bet + 3 STX from pool
      })
    );
  });

  it('demonstrates error handling with transaction types', () => {
    // Try to place bet on non-existent market
    const invalidBet = simnet.callPublicFn(
      contract,
      'place-bet',
      [
        Cl.uint(999), // Non-existent market
        Cl.stringAscii('YES'),
        Cl.uint(1000000),
      ],
      wallet1
    );

    // Should return an error
    expect(invalidBet.result).toBeErr(Cl.uint(101)); // ERR-MARKET-NOT-FOUND

    // Try to place bet with invalid outcome
    const createResult = simnet.callPublicFn(
      contract,
      'create-market',
      [
        Cl.stringAscii('CRYPTO'),
        Cl.stringAscii('Test'),
        Cl.stringAscii('YES'),
        Cl.stringAscii('NO'),
        Cl.uint(10000),
      ],
      deployer
    );

    // @ts-ignore
    const marketId = createResult.result.value;

    const invalidOutcome = simnet.callPublicFn(
      contract,
      'place-bet',
      [
        marketId,
        Cl.stringAscii('MAYBE'), // Invalid outcome
        Cl.uint(1000000),
      ],
      wallet1
    );

    expect(invalidOutcome.result).toBeErr(Cl.uint(105)); // ERR-INVALID-OUTCOME
  });
});

/**
 * Note: These tests use the Clarinet SDK's simnet for local testing.
 * For actual integration with @stacks/connect (wallet popups), you would:
 * 
 * 1. Use TransactionHelper in a web application
 * 2. Call helper.connectWallet() to show wallet connection UI
 * 3. Use helper.createMarket(), helper.placeBet(), etc. for user interactions
 * 4. The wallet will handle signing and broadcasting
 * 
 * For programmatic transactions (backend/scripts):
 * 1. Use makeContractCall() from @stacks/transactions
 * 2. Sign with private key
 * 3. Broadcast with broadcastTransaction()
 */
