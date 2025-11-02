Hello dear reviewer! And welcome to this window to my brain, I hope you enjoy it.

## Things you probably wanna know

* **Ledger design**: Main design consists of two tables (`balances` and `actions_ledger`) that are atomically updated. More details in the [Ledger Design](#ledger-design) section below

* **Strong typing**: I've strongly typed Actions and other models depending on its type. You can find them in [Action types](https://github.com/Pascualino/yeet-code-challenge/blob/main/src/aggregator/types/actions.ts) and [schema](https://github.com/Pascualino/yeet-code-challenge/blob/main/src/database/schema.ts#L30)

* **HMAC Authentication** is handled as a NestJs guard annotation, [HmacAuthGuard](https://github.com/Pascualino/yeet-code-challenge/blob/main/src/aggregator/hmac-auth.guard.ts)

* **Functional tests** use Playwright include all scenarios provided and multiple additional more complex ones, and can be found [in the *integration* folder](https://github.com/Pascualino/yeet-code-challenge/tree/main/tests/integration). **Performance tests** use K6 with different levels of intensity, easy ones are used on the CI pipeline automation and harder ones are for stress testing. They can be found [in the *performance* folder](https://github.com/Pascualino/yeet-code-challenge/tree/main/tests/performance)

* You can check the **performance results**, executed with K6, in [this section](#performance-results) and you have a [how to reproduce](#how-to-reproduce) allowing you to test it yourself.

* **Couple of extras:**
    - **Full CI pipeline**: Complete GitHub Actions pipeline including Docker spin up, integration tests, and performance tests automation. Includes DB seeds to spin up from scratch testing environments. Automatically executed every commit push to main, you can see it on [github commits](https://github.com/Pascualino/yeet-code-challenge/commits/main/) or an [execution example](https://github.com/Pascualino/yeet-code-challenge/actions/runs/19013825226/job/54298713486)
    - **Couple of games to generate data, easy to add more**: I've added a couple of probabilistic games, a [really thick coin flip](https://github.com/Pascualino/yeet-code-challenge/blob/main/tests/performance/games/flippingCoin.js) and a [roulette game](https://github.com/Pascualino/yeet-code-challenge/blob/main/tests/performance/games/roulette.js) with a small probabilistic bonus to the user. Both have expected RTP 95%. More info on [random game generation](#random-games)

* I've included my [assumptions](#assumptions) through the challenge implementation from the provided requirements, a [future improvements](#future-improvents) section and an explicit section about [AI Usage](#ai-usage)

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

## Performance Results

Performance testing results vary significantly based on the execution environment:

### GitHub Actions (Easy Profile)

The CI pipeline runs the "easy" load profile, which is optimized for the GitHub Actions runner capabilities. This provides basic validation that the system handles concurrent load without failures.

### Local Development (MacBook Pro)

On a local MacBook Pro, the system demonstrates strong performance characteristics:

**Single action per request (non-batched):**
- **>1,000 `/process` API calls per second** sustained throughput
- Tested with "mid" and "hard" load profiles
- Each request contains a single action (bet or win)
- Tested with [performance/process-endpoint.js](https://github.com/Pascualino/yeet-code-challenge/blob/main/tests/performance/process-endpoint.js)

**Batched requests (data generation pattern):**
- **>30,000 actions per second** when batching ~1,000 actions per `/process` call
- In this mode, the bottleneck shifts to **payload size** rather than API processing
- Demonstrates the system's efficiency at processing large batches atomically
- Tested with [performance/data-generator.js](https://github.com/Pascualino/yeet-code-challenge/blob/main/tests/performance/data-generator.js)

### RTP tolerance

Honestly it get pretty close to 95% RTP, I'm targeting a 0.1% tolerance which for the data-generation.js script I generally get. Easy-mode performance test has much more error margin of course, but generally get within 1%.

## How to reproduce
```bash
# Set up environment
docker compose up -d

# Install dependencies
npm install 

# Use default env
cp default-env .env

# Reset and prepare db
npm run db:reset

# Run data generation (Can configure load on data-generation.js -> options)
npm run test:generate

# Check the number of db rows added
npm run db:count
```

## Quick Start

### Set up
```bash
# Install dependencies
npm install 

# Use default env
cp default-env .env
```
### Docker

```bash
# Install dependencies
npm install 

# Start services (API + Database)
docker compose up -d

# View logs
docker compose logs -f api

# Reset database (truncates tables and reseeds with test data)
npm run db:reset

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

# Data generation with random games
npm run test:generate
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

## Assumptions

(These are things I'd normally ask or clarify, but here I took assumptions instead to do the work fully asynchronously)

* The doc mentions "There is only a single endpoint". I've interpreted it's meant for the processing actions only, but created separate endpoints for RTP reports (`/aggregator/takehome/rtp` for casino-wide and `/aggregator/takehome/rtp/{user_id}` for per-user)

* On the RTP report, I've assumed "rounds" is defined as "placed bets" actions (i.e., the total count of `bet` type actions)

* On the same RTP report endpoint, if the denominator (total_bet) is 0, we return `null` for RTP

* For the RTP and game simulation, I needed users to have some initial balance which was excluded from the RTP calculation. As I wanted the initial balance to be also dynamic and random, **I set up an "initial-balance" gameId value which is excluded from RTP calculations**
    - The alternative was to first create the users with some balance (either default to an initial balance on user first entry or pre-create with some other special endpoint), but this way allowed me to play with more numbers (initial balances, # of users, etc.)

* I've assumed we will not have a huge number of actions sent on a single `/process` endpoint call. I've therefore prioritized readability vs optimizing for large `/process` payloads

* All actions in a /process call are executed at the same time. That means that even if a first "action" in a batch is a bet that would put the user under 0, but there's a win action later **in the same batch call*** that puts them above 0 again, we don't fail and it's a valid use case. Same logic applies for rollbacks that apply to actions within the same batch, regardless of the order they're never considered "pre-rollbacks".

* Some fields, like *finished*, *gameId* or *currency* were kinda weird and not really used. I have my guesses of what we could use them for in a real system, but I've mostly ignored them honestly. In a real job I'd have an actual discussion with somebody about it :P

* Amounts are always in full dollars, we do not support cents. If we were, I'd just measure amount in cents

## Future Improvements

Things I'd improve or consider in a production environment:

* **Parallelizing tests**: Some tests (like the global RTP tests) cannot run in parallel to other tests. For now, I've just disabled parallel test execution because they're super fast anyway (3-5 seconds the whole suit), but we could just run them in an independent test batch at the end.

* **InputValidationService improvements**: The current validation is pretty rudimentary. For scaling, I'd probably implement framework-level validation (e.g., using class-validator decorators, Zod, or similar) to handle validation declaratively and reduce boilerplate.

* **Utilize unused fields**: Fields like `currency`, `gameId`, and `finished` are currently mostly ignored.

* **RTP calculation performance**: The current RTP calculation queries the entire `actions_ledger` table for the time range. For production at scale, if we had frequent reads, we could cache common ones or use some more complex pre-aggregated segments (hourly/daily rollups) to speed them up.
  
* **Environment variable defaults**: Some environment variables currently have default values for local/development convenience, I'd refine them in a real environment

## AI Usage

So... I've definitely used AI for the challenge, and it has helped me go much faster. I've read everything that the AI has written and I've refined most of it. 

Having said that, I've paid much more attention to the core parts (Controllers, ledger control, etc.) and done more manual stuff there, than on the infrastructure, automated tests, github actions set up and so on. Ah, and every other doc but this README has been mostly AI generated, as it helps the AI itself execute better. Just don't read them please.

In general, in the commits that have been heavily AI generated, I've stated so in the commit description for transparency. Just wanted to clear that out :)