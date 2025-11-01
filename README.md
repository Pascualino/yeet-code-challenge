Hello dear reviewer! And welcome to this window to my brain, I hope you enjoy it.

## Main highlights

* **Strong typing**: I've strongly typed Actions and other models. Check the discriminated union type for actions in `src/aggregator/dto/process-request.dto.ts` and the schema types in `src/database/schema.ts`

* **Ledger design**: Main design consists of two tables (`balances` and `actions_ledger`) that are atomically updated. More details in the [Ledger Design](#ledger-design) section below

* **Full CI pipeline**: Complete GitHub Actions pipeline including Docker spin up, integration tests, and performance tests automation. Includes DB seeds to spin up from scratch testing environments.

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

2. **Pre-rollback**: Rollback received before the original action
   - Record the rollback immediately (no balance change)
   - When the original action arrives later, it's detected as pre-rolled-back and has no effect on balance
   - Still generates a `tx_id` for idempotency purposes

### Balance Integrity

* **Non-negative constraint**: Enforced at both application level (throws `InsufficientFundsException`) and database level (check constraint)
* **Row-level locking**: Balance row is locked with `.for('update')` to prevent concurrent modifications
* **Event sourcing**: Balance can be recalculated from `actions_ledger` at any time, making `balances` a performance optimization cache

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
