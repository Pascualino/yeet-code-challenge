import type { Action } from '../types/actions';
export interface ProcessRequestDto {
  user_id: string;
  currency: string;
  game: string;
  game_id?: string;
  finished?: boolean;
  actions?: Action[];
}

