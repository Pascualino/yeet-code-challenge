# Technical Architecture

## System Overview

The bet processor is designed as a high-throughput, transactional system capable of handling billions of records over time.

```
┌─────────────┐
│   Client    │
│  (Casino)   │
└──────┬──────┘
       │ HMAC-signed requests
       ▼
┌─────────────────────────────┐
│   API Layer (NestJS)        │
│                             │
│  ┌──────────────────────┐  │
│  │ HMAC Auth Middleware │  │
│  └──────────────────────┘  │
│           │                 │
│  ┌────────▼──────────────┐ │
│  │  Process Controller   │ │
│  └───────────────────────┘ │
│           │                 │
│  ┌────────▼──────────────┐ │
│  │   Bet Service         │ │
│  │  - Idempotency        │ │
│  │  - Balance Logic      │ │
│  │  - Rollback Handling  │ │
│  └───────────────────────┘ │
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│   PostgreSQL Database       │
│                             │
│  ┌────────────────┐         │
│  │ Users Table    │         │
│  ├────────────────┤         │
│  │ Transactions   │         │
│  ├────────────────┤         │
│  │ Rollbacks      │         │
│  └────────────────┘         │
└─────────────────────────────┘
```

## Core Components

### 1. Authentication Layer

**Responsibility**: Verify HMAC-SHA256 signatures on all incoming requests.

**Implementation**:
- Middleware that runs before all controller methods
- Extracts `Authorization` header
- Computes HMAC over raw request body
- Uses constant-time comparison to prevent timing attacks
- Returns 403 on auth failure

**Key Considerations**:
- Must access raw body bytes (before JSON parsing)
- Secret key stored in environment variables
- Support for multiple secrets (optional: key rotation)

### 2. Request Processing Pipeline

**Flow**:
1. Parse and validate request structure
2. Look up user and current balance
3. Begin database transaction
4. For each action:
   - Check idempotency (action_id seen before?)
   - Check pre-rollback status
   - Validate business rules (non-negative balance)
   - Apply balance changes
   - Record transaction
5. Commit or rollback database transaction
6. Return response with transactions and final balance

**Atomicity**:
- Use database transactions (BEGIN/COMMIT/ROLLBACK)
- All-or-nothing semantics for multi-action requests
- Isolation level: Read Committed or higher

### 3. Idempotency Mechanism

**Goal**: Ensure each `action_id` is processed exactly once.

**Approach**:
- Unique constraint on `action_id` column
- On duplicate: retrieve existing `tx_id` and skip processing
- Return original `tx_id` in response

**Storage**:
```sql
CREATE TABLE transactions (
  tx_id UUID PRIMARY KEY,
  action_id UUID UNIQUE NOT NULL,
  user_id VARCHAR NOT NULL,
  action_type VARCHAR NOT NULL,
  amount BIGINT NOT NULL,
  balance_after BIGINT NOT NULL,
  created_at TIMESTAMP NOT NULL,
  ...
);

CREATE INDEX idx_transactions_action_id ON transactions(action_id);
```

### 4. Pre-Rollback System

**Challenge**: Rollbacks can arrive before their original actions.

**Solution**:
- Maintain a separate `rollbacks` table
- When rollback arrives:
  - Check if original action exists
  - If yes: reverse it normally
  - If no: record the rollback as "pending"
- When original action arrives:
  - Check if it has a pending rollback
  - If yes: process action but don't change balance (mark as rolled-back)
  - Generate `tx_id` normally

**Storage**:
```sql
CREATE TABLE rollbacks (
  rollback_id UUID PRIMARY KEY,
  rollback_action_id UUID UNIQUE NOT NULL,
  original_action_id UUID NOT NULL,
  user_id VARCHAR NOT NULL,
  processed_at TIMESTAMP NOT NULL,
  ...
);

CREATE INDEX idx_rollbacks_original_action ON rollbacks(original_action_id);
```

### 5. Balance Management

**Options**:

#### Option A: Balance Column (Faster Reads)
```sql
CREATE TABLE users (
  user_id VARCHAR PRIMARY KEY,
  currency VARCHAR NOT NULL,
  balance BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMP NOT NULL,
  ...
);
```

**Pros**:
- Fast balance lookups (single row read)
- Simple queries

**Cons**:
- Requires row-level locking for updates
- Potential contention on hot users

#### Option B: Calculated Balance (Event Sourcing)
```sql
-- No balance column in users table
-- Balance computed from transaction history:
SELECT COALESCE(SUM(balance_delta), 0) as balance
FROM transactions
WHERE user_id = ?
  AND is_rolled_back = false;
```

**Pros**:
- No locking needed
- Full audit trail
- Easy to recalculate historical balances

**Cons**:
- Slower balance lookups (aggregation query)
- Requires optimization for performance

**Recommendation**: Use Option A with row-level locking for production. Consider Option B with materialized views for reporting.

### 6. Data Model

#### Users Table
```sql
CREATE TABLE users (
  user_id VARCHAR(255) PRIMARY KEY,
  currency VARCHAR(10) NOT NULL,
  balance BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_currency ON users(currency);
```

#### Transactions Table
```sql
CREATE TABLE transactions (
  tx_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_id UUID UNIQUE NOT NULL,
  user_id VARCHAR(255) NOT NULL REFERENCES users(user_id),
  game_id VARCHAR(255),
  game VARCHAR(255),
  action_type VARCHAR(20) NOT NULL, -- 'bet', 'win', 'rollback'
  amount BIGINT NOT NULL,
  balance_before BIGINT NOT NULL,
  balance_after BIGINT NOT NULL,
  is_rolled_back BOOLEAN NOT NULL DEFAULT false,
  rolled_back_by UUID, -- references rollback transaction
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_action_id ON transactions(action_id);
CREATE INDEX idx_transactions_created_at ON transactions(created_at);
CREATE INDEX idx_transactions_game_id ON transactions(game_id);
```

**Partitioning Strategy** (for billions of rows):
```sql
-- Partition by date range for efficient archival
CREATE TABLE transactions_2025_01 PARTITION OF transactions
  FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
```

#### Rollbacks Table
```sql
CREATE TABLE rollbacks (
  rollback_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rollback_action_id UUID UNIQUE NOT NULL,
  original_action_id UUID NOT NULL,
  user_id VARCHAR(255) NOT NULL REFERENCES users(user_id),
  original_tx_id UUID REFERENCES transactions(tx_id),
  status VARCHAR(20) NOT NULL, -- 'pending', 'completed'
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_rollbacks_original_action_id ON rollbacks(original_action_id);
CREATE INDEX idx_rollbacks_user_id ON rollbacks(user_id);
```

### 7. RTP Reporting

**Query Strategy**:

```sql
-- Per-user RTP
SELECT 
  user_id,
  currency,
  COUNT(DISTINCT game_id) as rounds,
  SUM(CASE WHEN action_type = 'bet' AND is_rolled_back = false THEN amount ELSE 0 END) as total_bet,
  SUM(CASE WHEN action_type = 'win' AND is_rolled_back = false THEN amount ELSE 0 END) as total_win,
  SUM(CASE WHEN action_type = 'bet' AND is_rolled_back = true THEN amount ELSE 0 END) as total_rollback_bet,
  SUM(CASE WHEN action_type = 'win' AND is_rolled_back = true THEN amount ELSE 0 END) as total_rollback_win
FROM transactions
WHERE created_at >= ? AND created_at < ?
GROUP BY user_id, currency
LIMIT ? OFFSET ?;
```

**Optimization**:
- Add composite index: `(created_at, user_id, action_type, is_rolled_back)`
- Consider materialized views for frequently-accessed time ranges
- Use read replicas for reporting queries

### 8. Concurrency Control

**User Balance Updates**:
```sql
-- Use SELECT FOR UPDATE to lock user row
BEGIN;
SELECT balance FROM users WHERE user_id = ? FOR UPDATE;
-- ... process actions ...
UPDATE users SET balance = ?, updated_at = NOW() WHERE user_id = ?;
COMMIT;
```

**Action Idempotency**:
```sql
-- Use INSERT ... ON CONFLICT for idempotency
INSERT INTO transactions (action_id, ...)
VALUES (?, ...)
ON CONFLICT (action_id) DO NOTHING
RETURNING tx_id;
```

## Scale Considerations

### Vertical Scaling (Single Node)
- Optimize queries with proper indexing
- Use connection pooling
- Enable query caching where appropriate
- Monitor slow query log

### Horizontal Scaling (Multi-Node)

**Read Scaling**:
- Read replicas for RTP reports
- Cache balance lookups (with invalidation)

**Write Scaling** (future):
- Shard by user_id (consistent hashing)
- Each shard handles a subset of users
- Requires distributed transaction coordination for cross-shard operations

### Data Archival

For billions of rows:
- Partition transactions by month/quarter
- Archive old partitions to cold storage
- Keep hot data (last 6-12 months) on fast storage
- Maintain summary tables for historical reporting

## Performance Targets

**Throughput**:
- Target: 1,000+ requests/second
- Peak: 5,000+ requests/second

**Latency**:
- P50: < 50ms
- P95: < 200ms
- P99: < 500ms

**Concurrency**:
- Support 10,000+ concurrent users
- Handle 100+ concurrent requests per user

## Security Considerations

1. **HMAC Verification**:
   - Constant-time comparison prevents timing attacks
   - Rotate secrets periodically
   - Use strong secrets (256-bit random)

2. **SQL Injection**:
   - Use parameterized queries (never string concatenation)
   - ORM with proper escaping

3. **Rate Limiting**:
   - Protect against abuse
   - Per-user and global limits

4. **Input Validation**:
   - Validate all inputs (amounts, UUIDs, formats)
   - Reject malformed requests early

## Monitoring & Observability

**Key Metrics**:
- Request rate (requests/second)
- Error rate (4xx, 5xx)
- Latency percentiles (P50, P95, P99)
- Database connection pool usage
- Active transactions count
- Balance consistency checks

**Logging**:
- Request/response logs (with HMAC headers redacted)
- Transaction audit trail
- Error logs with stack traces
- Performance slow query logs

**Alerting**:
- High error rate
- Increased latency
- Database connection pool exhaustion
- Balance inconsistencies detected

## Technology Choices

### NestJS Framework
**Pros**:
- TypeScript native
- Dependency injection
- Modular architecture
- Built-in testing support
- Excellent documentation

### PostgreSQL Database
**Pros**:
- ACID compliance (critical for financial transactions)
- Row-level locking
- Mature partitioning support
- JSON support for flexible fields
- Proven at scale

### TypeORM / Prisma
**Options for ORM**:
- TypeORM: Native NestJS integration
- Prisma: Type-safe, great DX
- Raw SQL: Maximum control for critical queries

## Error Handling Strategy

**Error Categories**:
1. **Client Errors (4xx)**:
   - Invalid HMAC (403)
   - Insufficient funds (400/422 with code 100)
   - Malformed request (400)
   - Not found (404)

2. **Server Errors (5xx)**:
   - Database connection failure
   - Unexpected exceptions
   - Transaction timeout

**Error Response Format**:
```typescript
{
  code: number;        // Application error code
  message: string;     // Human-readable message
  details?: any;       // Optional additional context (dev only)
}
```

## Testing Strategy

1. **Unit Tests**: Individual components (services, utilities)
2. **Integration Tests**: API endpoints with test database
3. **E2E Tests**: Full acceptance scenarios A-J
4. **Performance Tests**: Load testing with realistic workloads
5. **Chaos Tests**: Simulate failures (DB down, network issues)

