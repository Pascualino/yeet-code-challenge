export interface BetAction {
  action: 'bet';
  action_id: string;
  amount: number;
}

export interface WinAction {
  action: 'win';
  action_id: string;
  amount: number;
}

export interface RollbackAction {
  action: 'rollback';
  action_id: string;
  original_action_id: string;
}

export type Action = BetAction | WinAction | RollbackAction;

export interface ProcessRequestDto {
  user_id: string;
  currency: string;
  game: string;
  game_id?: string;
  finished?: boolean;
  actions?: Action[];
}

