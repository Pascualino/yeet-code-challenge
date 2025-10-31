# Documentation

This directory contains comprehensive documentation for the Yeet Casino Bet Processor project.

NOTE FROM ME AS A HUMAN: Honestly I plan to use this as AI generated just to summarize the context on the PDF for the AI itself, and to validate my assumptions after reading the doc and later on in the project. But it's not really intended to show to another human.

## Table of Contents

### 📋 [Project Overview](./PROJECT_OVERVIEW.md)
High-level summary of the project goals, requirements, and deliverables. Start here to understand what we're building and why.

**Key Topics**:
- Project goals and scope
- Core requirements (auth, idempotency, rollbacks, RTP)
- Technology stack
- Acceptance scenarios overview
- Testing requirements
- Evaluation criteria

### 🔌 [API Specification](./API_SPECIFICATION.md)
Detailed API documentation including endpoints, request/response formats, and authentication.

**Key Topics**:
- HMAC-SHA256 authentication
- `/aggregator/takehome/process` endpoint specification
- RTP reporting endpoints
- Request/response schemas
- Action types (bet, win, rollback)
- Error codes and handling

### ✅ [Acceptance Scenarios](./ACCEPTANCE_SCENARIOS.md)
Comprehensive test scenarios (A-J) that validate functional correctness.

**Key Topics**:
- All 10 acceptance test cases with expected inputs/outputs
- Balance tracking examples
- Idempotency test cases
- Pre-rollback scenarios
- HMAC signature examples

### 🏗️ [Technical Architecture](./TECHNICAL_ARCHITECTURE.md)
System design, data models, and implementation considerations.

**Key Topics**:
- System architecture overview
- Core components (auth, processing pipeline, idempotency)
- Database schema design
- Pre-rollback mechanism
- Balance management strategies
- Concurrency control
- Scale considerations
- Performance targets
- Monitoring and observability

## Quick Reference

### Essential Links

- **API Base URL**: `http://localhost:3000`
- **Main Endpoint**: `POST /aggregator/takehome/process`
- **HMAC Secret** (testing): `test`

### Key Concepts

| Concept | Description |
|---------|-------------|
| **action_id** | Unique UUID identifying a specific action (ensures idempotency) |
| **tx_id** | Server-generated UUID for each transaction record |
| **Pre-rollback** | Rollback arrives before the original action it references |
| **RTP** | Return to Player percentage (total_win / total_bet) |
| **HMAC Auth** | Request signature using HMAC-SHA256 for security |

### Test User

For acceptance testing:
- **User ID**: `8|USDT|USD`
- **Currency**: `USD`
- **Initial Balance**: `74322001` (cents = $743,220.01)

### Example HMAC Signature

```javascript
const crypto = require('crypto');

const secret = 'test';
const body = '{"user_id":"8|USDT|USD","currency":"USD","game":"acceptance:test"}';
const signature = crypto
  .createHmac('sha256', secret)
  .update(body, 'utf8')
  .digest('hex');

console.log(signature); 
// Output: 442c4cd8926008096225416b21f5a1862fbf4fc4e5224362e3b463e85a39f40a
```

### Action Flow Example

```
1. Client sends bet request with HMAC signature
2. API verifies HMAC (403 if invalid)
3. Check if action_id already processed (idempotency)
4. Lock user row (SELECT FOR UPDATE)
5. Validate balance >= bet amount
6. Deduct bet from balance
7. Record transaction with tx_id
8. Return response with tx_id and new balance
```

## Document Purpose

### For Developers
These docs provide:
- Complete requirements specification
- API contracts for implementation
- Test cases for validation
- Architecture guidance for design decisions

### For AI Assistants
These docs serve as context for:
- Understanding project requirements
- Generating code that meets specifications
- Validating implementations against acceptance criteria
- Explaining design decisions

### For Reviewers
These docs demonstrate:
- Requirements understanding
- System design thinking
- Attention to edge cases
- Testing thoroughness

## Implementation Checklist

Use this checklist to track progress:

### Core Features
- [ ] HMAC-SHA256 authentication middleware
- [ ] Process endpoint (bet/win/rollback)
- [ ] Idempotency mechanism
- [ ] Non-negative balance validation
- [ ] Pre-rollback support
- [ ] Atomic transaction processing
- [ ] RTP reporting (per-user)
- [ ] RTP reporting (casino-wide)

### Testing
- [ ] Unit tests for core logic
- [ ] Integration tests for API endpoints
- [ ] All acceptance scenarios (A-J)
- [ ] RTP game runner
- [ ] Benchmark/performance tests

### Infrastructure
- [ ] Docker Compose configuration
- [ ] Database schema and migrations
- [ ] Seed data generator
- [ ] Environment configuration
- [ ] README with setup instructions

### Documentation
- [ ] API documentation
- [ ] Design decisions documented
- [ ] Assumptions and limitations noted
- [ ] Performance results documented

## Additional Resources

### External References
- [HMAC Specification (RFC 2104)](https://datatracker.ietf.org/doc/html/rfc2104)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [NestJS Documentation](https://docs.nestjs.com/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

### Related Files
- `/test/acceptance/` - Acceptance test implementation
- `/playwright.config.ts` - Integration test configuration
- `/docker-compose.yml` - Docker setup
- `/README.md` - Project README

## Questions or Issues?

If you encounter any ambiguities or need clarification:
1. Check the acceptance scenarios for concrete examples
2. Review the technical architecture for design patterns
3. Refer to the original requirements (PDF)
4. Document assumptions made in implementation

---

**Last Updated**: 2025-10-31
**Version**: 1.0.0

