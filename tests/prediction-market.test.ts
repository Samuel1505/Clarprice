
import { describe, it, expect, beforeEach } from 'vitest';
import { Cl, CV } from '@stacks/transactions';

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const wallet1 = accounts.get("wallet_1")!;
const wallet2 = accounts.get("wallet_2")!;
const wallet3 = accounts.get("wallet_3")!;

const contract = "prediction-market";

describe('Prediction Market Contract', () => {

  it('allows admin to create a market', () => {
    const { result } = simnet.callPublicFn(
      contract,
      "create-market",
      [
        Cl.stringAscii("CRYPTO"),
        Cl.stringAscii("Will BTC hit 100k?"),
        Cl.stringAscii("YES"),
        Cl.stringAscii("NO"),
        Cl.uint(10000) // end-time
      ],
      deployer
    );
    expect(result).toBeOk(Cl.uint(1));


    // 3. Verify Market Pools
    const market = simnet.callReadOnlyFn(contract, "get-market", [marketId], deployer);
    expect(market.result).toBeSome(expect.objectContaining({
      "pool-a": Cl.uint(1000),
      "pool-b": Cl.uint(1000)
    }));
  });

  it('handles resolution and claiming with streaks', () => {
    // Setup: Fund Treasury
    simnet.callPublicFn(contract, "fund-treasury", [Cl.uint(100000)], deployer);

    // 1. Create Market
    simnet.callPublicFn(contract, "create-market", [Cl.stringAscii("WORLD"), Cl.stringAscii("Election?"), Cl.stringAscii("X"), Cl.stringAscii("Y"), Cl.uint(10000)], deployer);

    // 2. Bet: Wallet1 bets 1000 on Win, Wallet2 bets 1000 on Loss
    simnet.callPublicFn(contract, "place-bet", [Cl.uint(1), Cl.stringAscii("X"), Cl.uint(1000)], wallet1);
    simnet.callPublicFn(contract, "place-bet", [Cl.uint(1), Cl.stringAscii("Y"), Cl.uint(1000)], wallet2);

    // 3. Resolve Market (Winner X)
    const resolve = simnet.callPublicFn(contract, "resolve-market", [Cl.uint(1), Cl.stringAscii("X")], deployer);
    expect(resolve).toBeOk(Cl.bool(true));

    // 4. Claim Winnings for Winner (Wallet1)
    // Wallet1 wins 50% of pool (Total 2000). So share = 2000.
    // Streak: Before 0. After 1. Multiplier for 1 is 0. So no bonus yet.
    const claim1 = simnet.callPublicFn(contract, "claim-winnings", [Cl.uint(1)], wallet1);
    expect(claim1).toBeOk(Cl.bool(true));

    const stats1 = simnet.callReadOnlyFn(contract, "get-user-stats", [wallet1], deployer);
    expect(stats1.result).toStrictEqual(Cl.tuple({
      "total-bets": Cl.uint(1),
      "total-wins": Cl.uint(1),
      "current-streak": Cl.uint(1),
      "highest-streak": Cl.uint(1),
      "total-earnings": Cl.uint(2000)
    }));

    // 5. Claim for Loser (Wallet2) - Should allow tracking loss but no payout
    // Actually our contract allows claiming only if you picked winner?
    // Let's check code: (if (is-eq (get outcome bet) winning-outcome) ... else ... Reset Streak)
    // So if they claim, it records the loss and resets streak.
    const claim2 = simnet.callPublicFn(contract, "claim-winnings", [Cl.uint(1)], wallet2);
    expect(claim2).toBeOk(Cl.bool(true));

    const stats2 = simnet.callReadOnlyFn(contract, "get-user-stats", [wallet2], deployer);
    expect(stats2.result).toStrictEqual(Cl.tuple({
      "total-bets": Cl.uint(1),
      "total-wins": Cl.uint(0),
      "current-streak": Cl.uint(0),
      "highest-streak": Cl.uint(0),
      "total-earnings": Cl.uint(0)
    }));
  });

  it('calculates streak multipliers correctly', () => {
    // We can simulate a streak by manually setting data via multiple wins, 
    // or just trust the logic. Since we can't easily set private state without many txs, 
    // we will run a loop of fake markets.

    simnet.callPublicFn(contract, "fund-treasury", [Cl.uint(1000000)], deployer);

    // Win 3 times to get streak 3 -> 10% bonus
    for (let i = 1; i <= 3; i++) {
      simnet.callPublicFn(contract, "create-market", [Cl.stringAscii("TEST"), Cl.stringAscii("Q"), Cl.stringAscii("A"), Cl.stringAscii("B"), Cl.uint(10000)], deployer);
      simnet.callPublicFn(contract, "place-bet", [Cl.uint(i), Cl.stringAscii("A"), Cl.uint(1000)], wallet1);
      simnet.callPublicFn(contract, "resolve-market", [Cl.uint(i), Cl.stringAscii("A")], deployer);
      simnet.callPublicFn(contract, "claim-winnings", [Cl.uint(i)], wallet1);
    }

    // Check Stats: Streak 3
    const stats = simnet.callReadOnlyFn(contract, "get-user-stats", [wallet1], deployer);
    // 3 wins. 
    expect(stats.result).toEqual(Cl.tuple({
      "current-streak": Cl.uint(3),
      "total-bets": Cl.uint(3),
      "total-wins": Cl.uint(3),
      "highest-streak": Cl.uint(3),
      "total-earnings": Cl.uint(3000)
    }));

    // 4th Win -> calculated details
    // Market 4
    simnet.callPublicFn(contract, "create-market", [Cl.stringAscii("TEST"), Cl.stringAscii("Q"), Cl.stringAscii("A"), Cl.stringAscii("B"), Cl.uint(10000)], deployer);
    // Bet 1000 vs 1000 (total 2000)
    simnet.callPublicFn(contract, "place-bet", [Cl.uint(4), Cl.stringAscii("A"), Cl.uint(1000)], wallet1);
    simnet.callPublicFn(contract, "place-bet", [Cl.uint(4), Cl.stringAscii("B"), Cl.uint(1000)], wallet2); // Add loser to ensure pool is distinct
    simnet.callPublicFn(contract, "resolve-market", [Cl.uint(4), Cl.stringAscii("A")], deployer);

    // Claim. Streak becomes 4. Multiplier is still for "4 / 3 = 1" -> 10%.
    // Base Share = 2000.
    // Bonus = (2000 * 10) / 100 = 200.
    // Total Payout = 2200.
    // Previous earnings (assuming previous mkts had no other bets, so 1000->1000 payout? No, if only 1 bettor, pool is just theirs, payout=bet)
    // Actually in loop above: 
    // Market 1: Bet 1000. Pool 1000. Win 1000. (Streak 1, bonus 0)
    // ...
    // Total earnings from first 3 = 3000.
    // This claim adds 2200. Total = 5200.

    const claim = simnet.callPublicFn(contract, "claim-winnings", [Cl.uint(4)], wallet1);
    expect(claim).toBeOk(Cl.bool(true));

    const finalStats = simnet.callReadOnlyFn(contract, "get-user-stats", [wallet1], deployer);
    expect(finalStats.result).toEqual(Cl.tuple({
      "current-streak": Cl.uint(4),
      "total-bets": Cl.uint(4),
      "total-wins": Cl.uint(4),
      "highest-streak": Cl.uint(4),
      "total-earnings": Cl.uint(5200)
    }));
  });

});
