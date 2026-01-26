;; Gamified Prediction Market
;; Sophisticated betting on Crypto, Sports, and World Events with streak-based multipliers

;; Constants
(define-constant CONTRACT-OWNER tx-sender)
(define-constant ERR-NOT-AUTHORIZED (err u100))
(define-constant ERR-MARKET-NOT-FOUND (err u101))
(define-constant ERR-MARKET-CLOSED (err u102))
(define-constant ERR-MARKET-ALREADY-RESOLVED (err u103))
(define-constant ERR-INSUFFICIENT-FUNDS (err u104))
(define-constant ERR-INVALID-OUTCOME (err u105))
(define-constant ERR-ALREADY-CLAIMED (err u106))

;; Categories
(define-constant CATEGORY-CRYPTO "CRYPTO")
(define-constant CATEGORY-SPORTS "SPORTS")
(define-constant CATEGORY-WORLD "WORLD")

;; Data Variables
(define-data-var market-id-nonce uint u0)
(define-data-var treasury-balance uint u0)

;; Maps

;; Market Definition
(define-map markets 
    uint 
    {
        category: (string-ascii 20),
        question: (string-ascii 100),
        outcome-a: (string-ascii 50),
        outcome-b: (string-ascii 50),
        pool-a: uint,
        pool-b: uint,
        start-time: uint,
        end-time: uint,
        resolved: bool,
        winning-outcome: (optional (string-ascii 50)),
        status: (string-ascii 10) ;; "OPEN", "CLOSED", "RESOLVED"
    }
)

;; User Bets: market-id, user -> { outcome, amount, claimed }
(define-map bets 
    { market-id: uint, user: principal }
    {
        outcome: (string-ascii 50),
        amount: uint,
        claimed: bool
    }
)

;; User Stats for Leaderboard & Gamification
(define-map user-stats
    principal
    {
        total-bets: uint,
        total-wins: uint,
        current-streak: uint,
        highest-streak: uint,
        total-earnings: uint
    }
)

;; Administrative Functions

(define-public (create-market (category (string-ascii 20)) (question (string-ascii 100)) (outcome-a (string-ascii 50)) (outcome-b (string-ascii 50)) (end-time uint))
    (let
        (
            (market-id (+ (var-get market-id-nonce) u1))
        )
        (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
        
        (map-set markets market-id {
            category: category,
            question: question,
            outcome-a: outcome-a,
            outcome-b: outcome-b,
            pool-a: u0,
            pool-b: u0,
            start-time: block-height,
            end-time: end-time,
            resolved: false,
            winning-outcome: none,
            status: "OPEN"
        })
        
        (var-set market-id-nonce market-id)
        (ok market-id)
    )
)

(define-public (resolve-market (market-id uint) (winning-outcome (string-ascii 50)))
    (let
        (
            (market (unwrap! (map-get? markets market-id) ERR-MARKET-NOT-FOUND))
        )
        (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
        (asserts! (not (get resolved market)) ERR-MARKET-ALREADY-RESOLVED)
        
        ;; Check if winning outcome is valid
        (asserts! (or (is-eq winning-outcome (get outcome-a market)) (is-eq winning-outcome (get outcome-b market))) ERR-INVALID-OUTCOME)

        (map-set markets market-id (merge market {
            resolved: true,
            winning-outcome: (some winning-outcome),
            status: "RESOLVED"
        }))
        
        (ok true)
    )
)

;; Read Only

(define-read-only (get-market (market-id uint))
    (map-get? markets market-id)
)

(define-read-only (get-bet (market-id uint) (user principal))
    (map-get? bets { market-id: market-id, user: user })
)

(define-read-only (get-user-stats (user principal))
    (default-to 
        { total-bets: u0, total-wins: u0, current-streak: u0, highest-streak: u0, total-earnings: u0 }
        (map-get? user-stats user)
    )
)

;; Gamification Logic

(define-private (calculate-multiplier (streak uint))
    ;; Multiplier logic: +10% for every 3 wins, max 100%
    (let
        (
            (bonus-steps (/ streak u3))
            ;; Cap at 10 steps (10 * 10% = 100%)
            (capped-steps (if (> bonus-steps u10) u10 bonus-steps))
        )
        (* capped-steps u10) ;; Returns percentage bonus (e.g., 10, 20, ... 100)
    )
)

;; Core Functions

(define-public (place-bet (market-id uint) (outcome (string-ascii 50)) (amount uint))
    (let
        (
            (market (unwrap! (map-get? markets market-id) ERR-MARKET-NOT-FOUND))
            (current-stats (get-user-stats tx-sender))
        )
        ;; Validations
        (asserts! (is-eq (get status market) "OPEN") ERR-MARKET-CLOSED)
        (asserts! (< block-height (get end-time market)) ERR-MARKET-CLOSED)
        (asserts! (or (is-eq outcome (get outcome-a market)) (is-eq outcome (get outcome-b market))) ERR-INVALID-OUTCOME)
        (asserts! (> amount u0) ERR-INSUFFICIENT-FUNDS)

        ;; Transfer STX to contract
        (try! (stx-transfer? amount tx-sender (as-contract tx-sender)))

        ;; Update Market
        (let
            (
                (is-a (is-eq outcome (get outcome-a market)))
                (new-pool-a (if is-a (+ (get pool-a market) amount) (get pool-a market)))
                (new-pool-b (if is-a (get pool-b market) (+ (get pool-b market) amount)))
            )
            (map-set markets market-id (merge market {
                pool-a: new-pool-a,
                pool-b: new-pool-b
            }))
        )

        ;; Record Bet
        ;; Note: Simplification - one bet per user per market for this version
        (map-set bets { market-id: market-id, user: tx-sender } {
            outcome: outcome,
            amount: amount,
            claimed: false
        })

        ;; Update User Stats (increment total bets)
        (map-set user-stats tx-sender (merge current-stats {
            total-bets: (+ (get total-bets current-stats) u1)
        }))

        (ok true)
    )
)

(define-public (claim-winnings (market-id uint))
    (let
        (
            (market (unwrap! (map-get? markets market-id) ERR-MARKET-NOT-FOUND))
            (bet (unwrap! (map-get? bets { market-id: market-id, user: tx-sender }) ERR-NOT-AUTHORIZED))
            (winning-outcome (unwrap! (get winning-outcome market) ERR-MARKET-NOT-FOUND))
            (user-history (get-user-stats tx-sender))
        )
        ;; Validations
        (asserts! (get resolved market) ERR-MARKET-CLOSED)
        (asserts! (not (get claimed bet)) ERR-ALREADY-CLAIMED)
        
        ;; Check if user won
        (if (is-eq (get outcome bet) winning-outcome)
            (begin
                ;; User Won
                (let
                    (
                        ;; Calculate Share
                        (total-pool (+ (get pool-a market) (get pool-b market)))
                        (winning-pool (if (is-eq winning-outcome (get outcome-a market)) (get pool-a market) (get pool-b market)))
                        (share (/ (* (get amount bet) total-pool) winning-pool))
                        
                        ;; Streak Logic
                        (new-streak (+ (get current-streak user-history) u1))
                        (multiplier (calculate-multiplier new-streak)) ;; e.g., 20 for 20%
                        (bonus (/ (* share multiplier) u100))
                        
                        ;; Ensure treasury can pay bonus, otherwise 0
                        (actual-bonus (if (>= (var-get treasury-balance) bonus) bonus u0))
                        (total-payout (+ share actual-bonus))
                    )
                    ;; Transfer Payout
                    (try! (as-contract (stx-transfer? total-payout tx-sender (get user bet))))
                    
                    ;; Update Treasury if bonus paid
                    (if (> actual-bonus u0)
                        (var-set treasury-balance (- (var-get treasury-balance) actual-bonus))
                        true
                    )

                    ;; Update Stats
                    (map-set user-stats tx-sender (merge user-history {
                        total-wins: (+ (get total-wins user-history) u1),
                        current-streak: new-streak,
                        highest-streak: (if (> new-streak (get highest-streak user-history)) new-streak (get highest-streak user-history)),
                        total-earnings: (+ (get total-earnings user-history) total-payout)
                    }))
                )
            )
            (begin
                ;; User Lost - Reset Streak
                (map-set user-stats tx-sender (merge user-history {
                    current-streak: u0
                }))
            )
        )

        ;; Mark as claimed (even if lost, to prevent re-entrancy/re-processing logic if we expanded it)
        (map-set bets { market-id: market-id, user: tx-sender } (merge bet {
            claimed: true
        }))

        (ok true)
    )
)

;; Admin - Fund Treasury for Multipliers
(define-public (fund-treasury (amount uint))
    (begin
        (try! (stx-transfer? amount tx-sender (as-contract tx-sender)))
        (var-set treasury-balance (+ (var-get treasury-balance) amount))
        (ok true)
    )
)
