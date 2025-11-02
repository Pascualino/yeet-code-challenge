export interface UserRtpDto {
  user_id: string;
  currency: string;
  rounds: number;
  total_bet: number;
  total_win: number;
  rtp: number | null;
}

export interface CasinoWideStats {
  total_rounds: number;
  total_bet: number;
  total_win: number;
  total_rtp: number | null;
  total_rollback_bet: number;
  total_rollback_win: number;
}

export interface RtpResponseDto {
  data: UserRtpDto[];
  global_stats: CasinoWideStats;
}

