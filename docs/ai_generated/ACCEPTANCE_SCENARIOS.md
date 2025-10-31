# Acceptance Scenarios

These test scenarios validate the functional correctness of the bet processor. All scenarios use the test HMAC secret: `test`

## Test User

**User ID**: `8|USDT|USD`
**Currency**: `USD`
**Initial Balance**: `74322001` (cents)

---

## Scenario A: Missing Authorization → 403

### Request

**Headers**: (no Authorization header)

**Body**:
```json
{
  "user_id": "8|USDT|USD",
  "currency": "USD"
}
```

### Expected Response

**Status**: `403 Forbidden`

---

## Scenario B: Balance Lookup

### Request

**Body**:
```json
{
  "user_id": "8|USDT|USD",
  "currency": "USD",
  "game": "acceptance:test"
}
```

### Expected Response

```json
{
  "balance": 74322001
}
```

---

## Scenario C: Single Bet (No Win)

### Request

```json
{
  "user_id": "8|USDT|USD",
  "currency": "USD",
  "game": "acceptance:test",
  "game_id": "1761032910245540510",
  "finished": true,
  "actions": [
    {
      "action": "bet",
      "action_id": "3b42f070-dab5-4d6c-8bc6-7241b68f00bd",
      "amount": 100
    }
  ]
}
```

### Expected Response

```json
{
  "game_id": "1761032910245540510",
  "transactions": [
    {
      "action_id": "3b42f070-dab5-4d6c-8bc6-7241b68f00bd",
      "tx_id": "<server-generated-uuid>"
    }
  ],
  "balance": 74321901
}
```

**Notes**:
- Balance decreases by 100
- Returns transaction with generated `tx_id`

---

## Scenario D: Bet + Win in Same Request

### Request

```json
{
  "user_id": "8|USDT|USD",
  "currency": "USD",
  "game": "acceptance:test",
  "game_id": "1761032910488163506",
  "actions": [
    {
      "action": "bet",
      "action_id": "7c8affbf-53fd-4fcc-b1ca-18118c5dd287",
      "amount": 100
    },
    {
      "action": "win",
      "action_id": "86441c7a-560e-4501-b829-110af6a1b956",
      "amount": 250
    }
  ]
}
```

### Expected Response

```json
{
  "game_id": "1761032910488163506",
  "transactions": [
    {
      "action_id": "7c8affbf-53fd-4fcc-b1ca-18118c5dd287",
      "tx_id": "<server-generated-uuid>"
    },
    {
      "action_id": "86441c7a-560e-4501-b829-110af6a1b956",
      "tx_id": "<server-generated-uuid>"
    }
  ],
  "balance": 74322151
}
```

**Notes**:
- Starting balance: 74322001
- After bet (-100): 74321901
- After win (+250): 74322151
- Net change: +150

---

## Scenario E: Insufficient Funds

### Request

```json
{
  "user_id": "8|USDT|USD",
  "currency": "USD",
  "game": "acceptance:test",
  "game_id": "1761032911004723918",
  "finished": true,
  "actions": [
    {
      "action": "bet",
      "action_id": "6c1e98e8-8e93-4856-b6ef-8b2ddc6c4cbc",
      "amount": 74322202
    }
  ]
}
```

### Expected Response

**Status**: `4xx` (e.g., 400 or 422)

```json
{
  "code": 100,
  "message": "Player has not enough funds to process an action"
}
```

**Notes**:
- Bet amount (74322202) exceeds balance (74322001)
- No transactions created
- Balance unchanged

---

## Scenario F: Bet Then Win (Separate Calls)

### Request 1 - Bet

```json
{
  "user_id": "8|USDT|USD",
  "currency": "USD",
  "game": "acceptance:test",
  "game_id": "1761032911166149146",
  "actions": [
    {
      "action": "bet",
      "action_id": "19bd35d5-50c3-4720-a402-145a46ab874c",
      "amount": 100
    }
  ]
}
```

### Response 1

```json
{
  "balance": 74321901,
  "transactions": [
    {
      "action_id": "19bd35d5-50c3-4720-a402-145a46ab874c",
      "tx_id": "<tx-id-1>"
    }
  ],
  "game_id": "1761032911166149146"
}
```

### Request 2 - Win

```json
{
  "user_id": "8|USDT|USD",
  "currency": "USD",
  "game": "acceptance:test",
  "game_id": "1761032911166149146",
  "finished": true,
  "actions": [
    {
      "action": "win",
      "action_id": "dcafc246-24b6-458b-a823-f6e7ecd6e9c3",
      "amount": 700
    }
  ]
}
```

### Response 2

```json
{
  "balance": 74322601,
  "transactions": [
    {
      "action_id": "dcafc246-24b6-458b-a823-f6e7ecd6e9c3",
      "tx_id": "<tx-id-2>"
    }
  ],
  "game_id": "1761032911166149146"
}
```

---

## Scenario G: Bet Then Rollback

### Request 1 - Bet

```json
{
  "user_id": "8|USDT|USD",
  "currency": "USD",
  "game": "acceptance:test",
  "game_id": "1761034000123456789",
  "actions": [
    {
      "action": "bet",
      "action_id": "4dbcbf1d-bcf6-43e9-9a62-7d3c0f3c6486",
      "amount": 100
    }
  ]
}
```

### Response 1

```json
{
  "game_id": "1761034000123456789",
  "transactions": [
    {
      "action_id": "4dbcbf1d-bcf6-43e9-9a62-7d3c0f3c6486",
      "tx_id": "b9d4f6c3-33a2-4aa2-844d-7a9ea7a19e61"
    }
  ],
  "balance": 74321901
}
```

### Request 2 - Rollback

```json
{
  "user_id": "8|USDT|USD",
  "currency": "USD",
  "game": "acceptance:test",
  "game_id": "1761034000123456789",
  "finished": true,
  "actions": [
    {
      "action": "rollback",
      "action_id": "c9a9c3a7-e9e8-4f5a-9fdf-1d8a377d1b8f",
      "original_action_id": "4dbcbf1d-bcf6-43e9-9a62-7d3c0f3c6486"
    }
  ]
}
```

### Response 2

```json
{
  "game_id": "1761034000123456789",
  "transactions": [
    {
      "action_id": "c9a9c3a7-e9e8-4f5a-9fdf-1d8a377d1b8f",
      "tx_id": "a2da9ceb-b9bf-49a1-9d4f-29b3de41b6b6"
    }
  ],
  "balance": 74322001
}
```

**Notes**:
- Rollback restores the balance by reversing the bet
- Creates a new transaction for the rollback

---

## Scenario H: Duplicate Action ID (Idempotency)

### Request 1 - First Bet

```json
{
  "user_id": "8|USDT|USD",
  "currency": "USD",
  "game": "acceptance:test",
  "game_id": "1761032913606999220",
  "actions": [
    {
      "action": "bet",
      "action_id": "f61c5eba-fb26-4070-89b5-c3a2edf54c02",
      "amount": 100
    }
  ]
}
```

### Response 1

```json
{
  "balance": 74321901,
  "transactions": [
    {
      "action_id": "f61c5eba-fb26-4070-89b5-c3a2edf54c02",
      "tx_id": "8b6421c4-f251-49cd-8bd7-1fce335ec9ee"
    }
  ],
  "game_id": "1761032913606999220"
}
```

### Request 2 - Duplicate Bet + New Bet

```json
{
  "user_id": "8|USDT|USD",
  "currency": "USD",
  "game": "acceptance:test",
  "game_id": "1761032913606999220",
  "actions": [
    {
      "action": "bet",
      "action_id": "f61c5eba-fb26-4070-89b5-c3a2edf54c02",
      "amount": 100
    },
    {
      "action": "bet",
      "action_id": "d94b2fa5-e87f-4d8e-9a01-4a443ed5c11c",
      "amount": 50
    }
  ]
}
```

### Response 2

```json
{
  "balance": 74321851,
  "transactions": [
    {
      "action_id": "f61c5eba-fb26-4070-89b5-c3a2edf54c02",
      "tx_id": "8b6421c4-f251-49cd-8bd7-1fce335ec9ee"
    },
    {
      "action_id": "d94b2fa5-e87f-4d8e-9a01-4a443ed5c11c",
      "tx_id": "b8d28a9e-5f99-47c4-8503-a24b4e654249"
    }
  ],
  "game_id": "1761032913606999220"
}
```

**Notes**:
- First action is duplicate: returns original `tx_id`, no balance change
- Second action is new: creates new `tx_id`, deducts 50 from balance
- Starting balance: 74321901, Final balance: 74321851 (only -50 change)

---

## Scenario I: Pre-Rollback (Rollback Before Original)

### Request 1 - Rollback (Before Bet Exists)

```json
{
  "user_id": "8|USDT|USD",
  "currency": "USD",
  "game": "acceptance:test",
  "game_id": "1761032915476894301",
  "finished": true,
  "actions": [
    {
      "action": "rollback",
      "action_id": "65d57850-5ee3-418b-b1b0-b4975242efcf",
      "original_action_id": "27710aca-60f9-4259-a9bb-26f75cd05917"
    }
  ]
}
```

### Response 1

```json
{
  "balance": 74321851,
  "transactions": [
    {
      "action_id": "65d57850-5ee3-418b-b1b0-b4975242efcf",
      "tx_id": "ce5932eb-57d0-4ee5-86fd-966b6aea0bcd"
    }
  ],
  "game_id": "1761032915476894301"
}
```

### Request 2 - Original Bet (After Rollback)

```json
{
  "user_id": "8|USDT|USD",
  "currency": "USD",
  "game": "acceptance:test",
  "game_id": "1761032915476894301",
  "finished": true,
  "actions": [
    {
      "action": "bet",
      "action_id": "27710aca-60f9-4259-a9bb-26f75cd05917",
      "amount": 100
    }
  ]
}
```

### Response 2

```json
{
  "game_id": "1761032915476894301",
  "transactions": [
    {
      "action_id": "27710aca-60f9-4259-a9bb-26f75cd05917",
      "tx_id": "418b592e-de90-4662-ba58-7ca296c49b98"
    }
  ],
  "balance": 74321851
}
```

**Notes**:
- Rollback arrives first: recorded but no balance change (nothing to reverse yet)
- Bet arrives later: creates `tx_id` but **does not change balance** (pre-rolled-back)
- Balance stays at 74321851 throughout

---

## Scenario J: Multiple Pre-Rollbacks

### Request 1 - Two Rollbacks (Before Actions Exist)

```json
{
  "user_id": "8|USDT|USD",
  "currency": "USD",
  "game": "acceptance:test",
  "game_id": "1761032916227566632",
  "finished": true,
  "actions": [
    {
      "action": "rollback",
      "action_id": "12af93e7-f208-46f1-9399-4c1668fdd675",
      "original_action_id": "a2fd2ce9-5184-48b6-bdde-f6ba05d32e01"
    },
    {
      "action": "rollback",
      "action_id": "85762689-2ab3-40d6-a7cd-e3babb53ae06",
      "original_action_id": "7e4ad25b-b2c2-4eb7-b38e-63e7ddcdab52"
    }
  ]
}
```

### Response 1

```json
{
  "balance": 74321851,
  "transactions": [
    {
      "action_id": "12af93e7-f208-46f1-9399-4c1668fdd675",
      "tx_id": "e3ee3cf6-6371-4022-bcf7-6a8ab26e3fdb"
    },
    {
      "action_id": "85762689-2ab3-40d6-a7cd-e3babb53ae06",
      "tx_id": "cf7be936-cc18-40fc-90c3-222a8f022393"
    }
  ],
  "game_id": "1761032916227566632"
}
```

### Request 2 - Original Bet + Win (After Rollbacks)

```json
{
  "user_id": "8|USDT|USD",
  "currency": "USD",
  "game": "acceptance:test",
  "game_id": "1761032916227566632",
  "finished": true,
  "actions": [
    {
      "action": "bet",
      "action_id": "a2fd2ce9-5184-48b6-bdde-f6ba05d32e01",
      "amount": 100
    },
    {
      "action": "win",
      "action_id": "7e4ad25b-b2c2-4eb7-b38e-63e7ddcdab52",
      "amount": 200
    }
  ]
}
```

### Response 2

```json
{
  "balance": 74321851,
  "transactions": [
    {
      "action_id": "a2fd2ce9-5184-48b6-bdde-f6ba05d32e01",
      "tx_id": "cb1afa68-e384-4dbc-b3c9-9c38e5b15027"
    },
    {
      "action_id": "7e4ad25b-b2c2-4eb7-b38e-63e7ddcdab52",
      "tx_id": "2ff9c934-c097-4fe0-80be-770272156f0b"
    }
  ],
  "game_id": "1761032916227566632"
}
```

**Notes**:
- Both rollbacks recorded without balance changes
- Both original actions (bet + win) processed without balance changes
- Net balance change: 0 (both actions were pre-rolled-back)
- All actions get unique `tx_id` values

---

## Testing Notes

### HMAC Signature Calculation

For each test, calculate the HMAC signature using:
- Secret: `test`
- Body: raw JSON request body (as sent, no whitespace changes)

### Balance Tracking

Each scenario should track the cumulative balance changes. Tests may be run sequentially or independently with balance resets.

### Transaction IDs

`tx_id` values are server-generated UUIDs and will differ across runs. Test assertions should verify:
- Presence of `tx_id`
- UUID format validity
- Consistency on duplicate submissions (same `action_id` → same `tx_id`)

