# Yeet Casino - Bet Processor Project Overview

## Project Goal

Build a production-grade bet processing system capable of handling:
- Bet transactions (bets, wins, rollbacks)
- Multi-user concurrent operations (thousands of users, millions of rounds)
- HMAC-SHA256 authentication
- Idempotency guarantees
- Non-negative balance enforcement
- RTP (Return to Player) reporting
- Scale to billions of transactions over time

**Expected RTP**: ~95% (global average across all users)

## Technology Stack

- **Required**: Node.js with TypeScript
- **Database**: PostgreSQL (preferred, but not required)
- **Deployment**: Docker Compose for both API and database
- **Framework**: Open choice (NestJS selected for this implementation)

## Core Requirements

### 1. Authentication (HMAC-SHA256)

Every API request must be authenticated using HMAC-SHA256:

```
Authorization: HMAC-SHA256 <hex-digest>
```

**Computation**: 
- `hex(HMAC_SHA256(secret, raw_request_body_bytes))`
- Signature must be verified against raw bytes (no re-serialization)
- Use constant-time comparison to prevent timing attacks
- Invalid/missing signatures → HTTP 403 Forbidden

**Example**:
- Secret: `test`
- Body: `{"user_id":"8|USDT|USD","currency":"USD","game":"acceptance:test"}`
- Signature: `442c4cd8926008096225416b21f5a1862fbf4fc4e5224362e3b463e85a39f40a`

### 2. Idempotency

- Every action has a unique `action_id` (UUID)
- Re-submissions of the same `action_id` must:
  - Not apply balance changes twice
  - Return the original `tx_id` from the first submission
  - Still appear in the transaction list

### 3. Non-Negative Balance Constraint

- Bets must never take a user's balance below zero
- Insufficient funds → HTTP 4xx with error code 100:
  ```json
  {
    "code": 100,
    "message": "Player has not enough funds to process an action"
  }
  ```

### 4. Rollback Support

**Standard Rollback**:
- Reverses a previously applied action
- Restores the balance to its pre-action state
- Creates a new transaction record

**Pre-Rollback** (Critical Feature):
- If a rollback arrives BEFORE the original action:
  - Record the rollback
  - When the original action later arrives, it becomes a no-op (no balance change)
  - Still generate and return a `tx_id` for the original action
  - Balance remains unchanged

### 5. Atomic Processing

- All actions in a single request must be processed atomically
- Process actions in the order they appear in the request
- If any action fails (e.g., insufficient funds), the entire request should fail
- Return transactions in the same order as actions

## API Design

### Single Endpoint: `/aggregator/takehome/process`

All operations (bets, wins, rollbacks, balance lookups) go through this endpoint.

#### Request Structure

```json
{
  "user_id": "string",
  "currency": "string",
  "game": "provider:game",
  "game_id": "string",
  "finished": boolean,
  "actions": [
    {
      "action": "bet",
      "action_id": "uuid",
      "amount": 100
    },
    {
      "action": "win",
      "action_id": "uuid",
      "amount": 250
    },
    {
      "action": "rollback",
      "action_id": "uuid",
      "original_action_id": "uuid"
    }
  ]
}
```

#### Response Structures

**With Actions**:
```json
{
  "game_id": "string",
  "transactions": [
    {
      "action_id": "uuid",
      "tx_id": "uuid"
    }
  ],
  "balance": 74322001
}
```

**Balance-Only Request** (no actions array):
```json
{
  "balance": 74322001
}
```

**Error Response** (Insufficient Funds):
```json
{
  "code": 100,
  "message": "Player has not enough funds to process an action"
}
```

### Action Types

1. **bet**: Reduces user balance by the specified amount
2. **win**: Increases user balance by the specified amount
3. **rollback**: Reverses a previous action identified by `original_action_id`

## RTP Reporting

### Requirements

Two endpoints needed:
1. **Per-User RTP**: Returns RTP statistics for each user
2. **Casino-Wide RTP**: Returns aggregated RTP across all users

### Input Parameters

- `from`: Start datetime (ISO-8601 format)
- `to`: End datetime (ISO-8601 format)
- Optional: Pagination parameters

### Response Format

```json
{
  "user_id": "string",
  "currency": "string",
  "rounds": 123456,
  "total_bet": 123456789,
  "total_win": 117283950,
  "rtp": 0.9498
}
```

### RTP Calculation Rules

- **RTP Formula**: `total_win / total_bet`
- **Exclude rollbacks** from both numerator and denominator
- **Include rolled-back amounts** as a separate field showing what was reversed
- Handle division by zero (when total_bet = 0)
- Support pagination for large datasets

## Acceptance Scenarios

The system must pass these functional test cases:

| Scenario | Description |
|----------|-------------|
| A | Missing Authorization → 403 |
| B | Balance lookup (no actions) |
| C | Single bet with no win |
| D | Bet + win in same request |
| E | Insufficient funds rejection |
| F | Bet then win (separate calls) |
| G | Bet then rollback that bet |
| H | Duplicate action_id (idempotency) |
| I | Rollback arrives before bet (pre-rollback) |
| J | Multiple pre-rollbacks before actions |

See `docs/ACCEPTANCE_SCENARIOS.md` for detailed test cases.

## Data Model Considerations

### Scale Requirements

- System must handle **billions of rows** over time
- Never-ending stream of transactions
- Thousands of concurrent users
- Millions of rounds

### Design Considerations

- Efficient indexing for:
  - User lookups
  - Action ID uniqueness
  - Time-range queries (for RTP reports)
  - Game round tracking
- Partitioning strategy for large tables
- Balance calculation efficiency
- Transaction history retention

## Testing Requirements

### 1. Functional Tests

- Cover all acceptance scenarios (A-J)
- Test HMAC authentication
- Test idempotency edge cases
- Test rollback scenarios (including pre-rollback)
- Test atomic transaction processing

### 2. RTP Game Runner

A simulation tool that:
- Generates random game rounds with probabilistic wins
- Supports configurable number of users and rounds
- Achieves ~95% RTP through proper randomization (not trivial "always win 95%")
- Shows variance in results (realistic gambling behavior)
- Validates final RTP against expected value
- Allows arbitrary configuration of:
  - Number of users
  - Number of rounds
  - Bet amounts
  - Win probabilities

### 3. Benchmark Tests

- Measure throughput (requests/second)
- Measure latency (p50, p95, p99)
- Test concurrent user scenarios
- Document performance characteristics

## Deliverables Checklist

- [ ] API implementation with all required endpoints
- [ ] HMAC authentication middleware
- [ ] Database schema and migrations
- [ ] Docker Compose setup (API + DB)
- [ ] Seed data generator (thousands of users with initial balances)
- [ ] Functional tests (all acceptance scenarios)
- [ ] RTP Game Runner (simulation tool)
- [ ] Benchmark tests
- [ ] Comprehensive README with:
  - API documentation
  - Design decisions and rationale
  - How to run everything (Docker, tests, seeds, runner)
  - Assumptions and limitations
  - Performance results

## Evaluation Criteria

The project will be evaluated on:

1. **Correctness**
   - Atomicity of operations
   - Idempotency implementation
   - Rollback handling (especially pre-rollback)
   - Non-negative balance enforcement

2. **Scale Readiness**
   - Data model design for billions of rows
   - Query optimization
   - Indexing strategy

3. **Performance**
   - Throughput and latency measurements
   - Methodology and documentation

4. **Code Quality**
   - Structure and organization
   - Test coverage
   - Documentation clarity
   - Simplicity where possible

5. **API Quality**
   - Clear error handling
   - Proper pagination
   - Consistent response formats

6. **Operability**
   - Easy startup process
   - Environment configuration
   - Deterministic seeds for testing

## Key Technical Challenges

1. **Pre-Rollback Logic**: Handling rollbacks that arrive before their original actions
2. **Idempotency at Scale**: Efficient duplicate detection across billions of transactions
3. **Atomic Multi-Action Processing**: Ensuring all-or-nothing semantics
4. **Balance Consistency**: Preventing race conditions in concurrent operations
5. **RTP Reporting Performance**: Efficient aggregation over large time ranges
6. **HMAC Verification**: Secure, constant-time signature comparison

## Assumptions & Constraints

- Single endpoint for all operations (bet/win/rollback/balance)
- PostgreSQL preferred but not mandatory
- Docker Compose must work out of the box
- System is designed for continuous operation (never-ending data stream)
- Initial user balances are seeded
- Currency handling uses integer amounts (avoid floating-point)

