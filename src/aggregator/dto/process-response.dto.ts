export interface Transaction {
  action_id: string;
  tx_id: string;
}

export interface BalanceOnlyResponseDto {
  balance: number;
}

export interface ActionResultsResponseDto extends BalanceOnlyResponseDto {
  game_id: string;
  transactions: Transaction[];
}

export type ProcessResponseDto = BalanceOnlyResponseDto | ActionResultsResponseDto;

