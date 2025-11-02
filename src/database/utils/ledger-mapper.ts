import { Action } from '../../aggregator/types/actions';
import type {
  NewActionLedgerEntry,
  NewBetActionLedgerEntry,
  NewWinActionLedgerEntry,
  NewRollbackActionLedgerEntry,
} from '../schema';

export function mapToLedger(
  actions: Action[],
  userId: string,
  currency: string,
  game: string,
  gameId?: string,
): NewActionLedgerEntry[] {
  return actions.map((action) => {
    if (action.action === 'bet') {
      return {
        userId,
        currency,
        game,
        gameId: gameId ?? null,
        actionId: action.action_id,
        type: 'bet' as const,
        amount: action.amount,
      } satisfies NewBetActionLedgerEntry;
    } else if (action.action === 'win') {
      return {
        userId,
        currency,
        game,
        gameId: gameId ?? null,
        actionId: action.action_id,
        type: 'win' as const,
        amount: action.amount,
      } satisfies NewWinActionLedgerEntry;
    } else {
      return {
        userId,
        currency,
        game,
        gameId: gameId ?? null,
        actionId: action.action_id,
        type: 'rollback' as const,
        originalActionId: action.original_action_id,
      } satisfies NewRollbackActionLedgerEntry;
    }
  });
}

