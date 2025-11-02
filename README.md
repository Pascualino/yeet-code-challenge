Hello dear reviewer! And welcome to this window to my brain, I hope you enjoy it.

## Things you probably wanna know

* **Ledger design**: Main design consists of two tables (`balances` and `actions_ledger`) that are atomically updated. More details in the [Ledger Design](#ledger-design) section below

* **Strong typing**: I've strongly typed Actions and other models depending on its type. You can find them in [Action types](https://github.com/Pascualino/yeet-code-challenge/blob/main/src/aggregator/types/actions.ts) and [schema](https://github.com/Pascualino/yeet-code-challenge/blob/main/src/database/schema.ts#L30)

* **HMAC Authentication** is handled as a NestJs guard annotation, [HmacAuthGuard](https://github.com/Pascualino/yeet-code-challenge/blob/main/src/aggregator/hmac-auth.guard.ts)

* **Functional tests** use Playwright include all scenarios provided and multiple additional more complex ones, and can be found [in the *integration* folder](https://github.com/Pascualino/yeet-code-challenge/tree/main/tests/integration). **Performance tests** use K6 with different levels of intensity, easy ones are used on the CI pipeline automation and harder ones are for stress testing. They can be found [in the *performance* folder](https://github.com/Pascualino/yeet-code-challenge/tree/main/tests/performance)

* You can check the **performance results**, executed with K6, in [this section](#performance-results) and you have a [quickstart](#quick-start) allowing you to test it yourself.

* **Couple of extras:**
 * **Full CI pipeline**: Complete GitHub Actions pipeline including Docker spin up, integration tests, and performance tests automation. Includes DB seeds to spin up from scratch testing environments. Automatically executed every commit push to main, you can see it on [github commits](https://github.com/Pascualino/yeet-code-challenge/commits/main/) or an [execution example](https://github.com/Pascualino/yeet-code-challenge/actions/runs/19013825226/job/54298713486)
 * **Couple of games to generate data, easy to add more**: I've added a couple of probabilistic games, a [really thick coin flip](https://github.com/Pascualino/yeet-code-challenge/blob/main/tests/performance/games/flippingCoin.js) and a [roulette game](https://github.com/Pascualino/yeet-code-challenge/blob/main/tests/performance/games/roulette.js) with a small probabilistic bonus to the user. Both have expected RTP 95%. More info on [random game generation](#random-games)


## Assumptions

(These are things I'd normally ask or clarify, but here I took assumptions instead to do the work fully asynchronously)

* The doc mentions "There is only a single endpoint". I've interpreted it's meant for the processing actions only, but created separate endpoints for RTP reports (`/aggregator/takehome/rtp` for casino-wide and `/aggregator/takehome/rtp/{user_id}` for per-user)

* On the RTP report, I've assumed "rounds" is defined as "placed bets" actions (i.e., the total count of `bet` type actions)

* On the same RTP report endpoint, if the denominator (total_bet) is 0, we return `null` for RTP

* For the RTP and game simulation, I needed users to have some initial balance which was excluded from the RTP calculation. As I wanted the initial balance to be also dynamic and random, I set up an "initial-balance" gameId value which is excluded from RTP calculations

* I've assumed we will not have a huge number of actions sent on a single `/process` endpoint call. I've therefore prioritized readability vs optimizing for large `/process` payloads

* All actions in a /process call are executed at the same time. That means that even if a first "action" in a batch is a bet that would put the user under 0, but there's a win action later **in the same batch call*** that puts them above 0 again, we don't fail and it's a valid use case.

## Frameworks and tech decisions

* **NestJS** as a framework on top of Node.js, as annotations make it easy to set up routes and guards like HMAC

* **Drizzle ORM** because I was recently told it is faster than others like TypeORM and it's what cool people use :P

* **Playwright** for integration tests, which is mostly used for UI testing but I'm comfortable with. In a real production environment, I might use one more focused on API testing

* **K6** for load testing: Lightweight, easy to use, widely supported

* **GitHub Actions** for CI, because it's easy to integrate and see the results by a reviewer

## Ledger Design

The ledger system is built around an **event sourcing pattern** with two core tables that are atomically updated:

### Tables

1. **`actions_ledger`**: An append-only log of all actions (bets, wins, rollbacks)
   - Each action has a unique `action_id` (enforced by unique constraint) for idempotency
   - Stores action metadata: `user_id`, `currency`, `amount`, `type`, `game`, `game_id`, `created_at`
   - Rollback actions reference their original action via `original_action_id`

2. **`balances`**: Denormalized balance cache for fast lookups
   - Primary key: `user_id`
   - `balance` field with a database-level check constraint ensuring it's never negative (`balance >= 0`)

### Atomic Updates

All write operations happen within a single database transaction in `AtomicLedgerUpdateService`:

1. **Idempotency check**: Query existing actions by `action_id` to filter out duplicates, and filter those out to avoid re-processing
2. **Rollback resolution**: 
   - Find rollbacks that reference new actions (pre-rollbacks becoming active)
   - Find rollbacks in the current batch that reference previous or current actions
3. **Balance delta calculation**: 
   - Process new bet/win actions (subtract bets, add wins)
   - Apply rollbacks effects
4. **Atomic commit**: 
   - Insert new actions into `actions_ledger`
   - Update/insert balance with row-level lock
   - All-or-nothing: if balance would go negative, the entire transaction rolls back

### Rollback Handling

The system handles two types of rollbacks:

1. **Regular rollback**: Rollback of an existing action
   - Reverse the balance change from the original action
   - Record both the original action and the rollback in the ledger
   - Rollback entry amount is the reverse of the action it refers to

2. **Pre-rollback**: Rollback received before the original action
   - Record the rollback immediately (no balance change)
   - When the original action arrives later, it's detected as pre-rolled-back and has no effect on balance
   - Still generates a `tx_id` for idempotency purposes
   - Rollback entry amount is 0, and when the action comes it's marked as amount 0 as well. This is *ahem* **super convenient** for the stats endpoints working while keeping the ledger append only (and not having to update past pre-rollback operation amounts)

### Balance Integrity

* **Non-negative constraint**: Enforced at both application level (throws `InsufficientFundsException`) and database level (check constraint)
* **Row-level locking**: Balance row is locked with `.for('update')` to prevent concurrent modifications

## Quick Start

### Docker

```bash
# Start services (API + Database)
docker compose up -d

# View logs
docker compose logs -f api

# Reset database (truncates tables and reseeds with test data)
./scripts/reset-test-db.sh

# Stop services
docker compose down
```

The API will be available at `http://localhost:3000`

## Running Tests

```bash
# Integration tests (Playwright)
npm run test:integration

# Performance tests (K6)
LOAD_PROFILE=easy|mid|hard ./scripts/run-k6.sh
```

## Random Games

### Flipping Coin Game

A "really thick coin" that can land on its edge, introducing a 2.5% skew:

- **Win probability**: 47.5% chance to double the bet (2x payout)
- **Lose probability**: 52.5% chance to lose (includes edge landings)
- **RTP calculation**: 47.5% × 2x = **95% RTP**

### Roulette Game

A classic roulette with both 0 and 00, enhanced with a promotional bonus:

- **Bet types**:
  - **Number bet**: Pick a specific number (0, 00, or 1-36) → 36x payout if you win
  - **Color bet**: Pick red or black → 2x payout if you win (loses on 0 or 00)
- **Base RTP**: 94.74% (standard roulette with 0 and 00)
- **Bonus**: Special promotional bonus of 0.274% on the bet amount
- **Final RTP**: 1.00274 * 0.9474 = **94.9995% RTP**
- **Winning amounts**: As the bonus introduces decimals and the amounts can only be integers, we round probabilistically (e.g., if the calculated win is 123.4, there's a 40% chance it rounds up to 124, 60% chance it rounds down to 123)

Both games use the `CasinoGame` interface, making it easy to add more games following the same pattern.
