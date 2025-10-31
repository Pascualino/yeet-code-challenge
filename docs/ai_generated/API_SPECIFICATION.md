# API Specification

## Base URL

```
http://localhost:3000
```

## Authentication

All requests must include an HMAC-SHA256 signature in the Authorization header.

### Header Format

```
Authorization: HMAC-SHA256 <signature>
```

### Signature Generation

```typescript
const crypto = require('crypto');

function generateSignature(secret: string, body: string): string {
  return crypto
    .createHmac('sha256', secret)
    .update(body, 'utf8')
    .digest('hex');
}
```

### Important Notes

- Signature must be computed over the **raw request body bytes**
- Do NOT re-serialize or prettify JSON before signing
- Use **constant-time comparison** when verifying signatures
- Missing or invalid signature → HTTP 403 Forbidden

### Example

**Secret**: `test`

**Request Body**:
```json
{"user_id":"8|USDT|USD","currency":"USD","game":"acceptance:test"}
```

**Signature**:
```
442c4cd8926008096225416b21f5a1862fbf4fc4e5224362e3b463e85a39f40a
```

**Full Request**:
```http
POST /aggregator/takehome/process HTTP/1.1
Content-Type: application/json
Authorization: HMAC-SHA256 442c4cd8926008096225416b21f5a1862fbf4fc4e5224362e3b463e85a39f40a

{"user_id":"8|USDT|USD","currency":"USD","game":"acceptance:test"}
```

## Endpoints

### Process Actions

**Endpoint**: `POST /aggregator/takehome/process`

Handles all bet processing operations: bets, wins, rollbacks, and balance lookups.

#### Request Body

```typescript
{
  user_id: string;           // User identifier (e.g., "8|USDT|USD")
  currency: string;          // Currency code (e.g., "USD", "EUR")
  game: string;              // Game identifier "provider:game"
  game_id?: string;          // Unique game round identifier
  finished?: boolean;        // Whether the round is complete
  actions?: Array<{          // Optional: omit for balance-only lookup
    action: 'bet' | 'win' | 'rollback';
    action_id: string;       // UUID - unique action identifier
    amount?: number;         // Required for bet/win, amount in smallest currency unit
    original_action_id?: string; // Required for rollback, references action to reverse
  }>;
}
```

#### Response (With Actions)

```typescript
{
  game_id: string;
  transactions: Array<{
    action_id: string;       // Matches request action_id
    tx_id: string;           // Server-generated transaction UUID
  }>;
  balance: number;           // User's balance after processing (smallest currency unit)
}
```

#### Response (Balance-Only)

When `actions` array is omitted or empty:

```typescript
{
  balance: number;           // Current user balance
}
```

#### Error Response (Insufficient Funds)

**HTTP Status**: 4xx (e.g., 400 or 422)

```typescript
{
  code: 100;
  message: "Player has not enough funds to process an action";
}
```

### RTP Report (Per-User)

**Endpoint**: `GET /aggregator/takehome/rtp/users`

Returns RTP statistics for each user within a time range.

#### Query Parameters

```typescript
{
  from: string;              // ISO-8601 datetime (e.g., "2025-01-01T00:00:00Z")
  to: string;                // ISO-8601 datetime
  limit?: number;            // Pagination: items per page (default: 100)
  offset?: number;           // Pagination: offset (default: 0)
}
```

#### Response

```typescript
{
  data: Array<{
    user_id: string;
    currency: string;
    rounds: number;          // Total number of game rounds
    total_bet: number;       // Sum of all bets (excluding rolled-back)
    total_win: number;       // Sum of all wins (excluding rolled-back)
    total_rollback_bet: number;  // Sum of rolled-back bets
    total_rollback_win: number;  // Sum of rolled-back wins
    rtp: number;             // total_win / total_bet (null if total_bet = 0)
  }>;
  pagination: {
    limit: number;
    offset: number;
    total: number;
  };
}
```

### RTP Report (Casino-Wide)

**Endpoint**: `GET /aggregator/takehome/rtp/casino`

Returns aggregated RTP statistics across all users.

#### Query Parameters

```typescript
{
  from: string;              // ISO-8601 datetime
  to: string;                // ISO-8601 datetime
}
```

#### Response

```typescript
{
  total_users: number;
  total_rounds: number;
  total_bet: number;
  total_win: number;
  total_rollback_bet: number;
  total_rollback_win: number;
  rtp: number;               // Global RTP (null if total_bet = 0)
}
```

## Action Types

### 1. Bet

Deducts the specified amount from the user's balance.

```json
{
  "action": "bet",
  "action_id": "550e8400-e29b-41d4-a716-446655440000",
  "amount": 100
}
```

**Effects**:
- Balance decreases by `amount`
- Creates a transaction record
- Returns `tx_id`

**Constraints**:
- Balance must remain >= 0 (or reject with code 100)
- `amount` must be positive

### 2. Win

Adds the specified amount to the user's balance.

```json
{
  "action": "win",
  "action_id": "660e8400-e29b-41d4-a716-446655440001",
  "amount": 250
}
```

**Effects**:
- Balance increases by `amount`
- Creates a transaction record
- Returns `tx_id`

**Constraints**:
- `amount` must be positive or zero

### 3. Rollback

Reverses a previously processed action.

```json
{
  "action": "rollback",
  "action_id": "770e8400-e29b-41d4-a716-446655440002",
  "original_action_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Effects**:
- If original action was a bet: increases balance by original amount
- If original action was a win: decreases balance by original amount
- Creates a new transaction record
- Returns a new `tx_id`

**Special Case - Pre-Rollback**:
If `original_action_id` hasn't been seen yet:
- Record the rollback
- When the original action later arrives, process it but don't change balance
- Still generate a `tx_id` for the original action

## Processing Rules

### Order of Operations

1. Authenticate request (verify HMAC signature)
2. Validate request structure
3. Look up user and current balance
4. Process actions **in order**, atomically:
   - Check idempotency (has this `action_id` been seen?)
   - If duplicate: use original `tx_id`, skip balance change
   - If new: apply balance change, generate new `tx_id`
   - Check pre-rollback status
   - Validate balance constraints
5. Return response with all transactions and final balance

### Atomicity

- All actions in a single request are processed as one atomic transaction
- If any action fails, the entire request fails
- No partial updates to balance or transaction records

### Idempotency

- Each `action_id` is processed exactly once
- Duplicate submissions return the original `tx_id`
- Duplicate actions still appear in the response's `transactions` array
- Balance is not modified on duplicate submissions

### Transaction IDs

- `tx_id` is server-generated (UUID v4)
- Unique for each action (even rollbacks)
- Stable across duplicate submissions (same `action_id` → same `tx_id`)

## Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| 100 | 4xx | Insufficient funds - balance would go negative |
| 403 | 403 | Authentication failed - invalid or missing HMAC signature |

## Data Types

### User ID Format

Format: `{id}|{wallet_type}|{currency}`

Example: `8|USDT|USD`

### Currency

ISO 4217 currency codes (e.g., USD, EUR, GBP)

### Amounts

- Integer values in the smallest currency unit
- For USD: amounts are in cents (100 = $1.00)
- Must be non-negative

### Game Identifier

Format: `{provider}:{game_name}`

Example: `acceptance:test`

### Timestamps

ISO-8601 format with timezone

Example: `2025-10-31T14:30:00Z`

