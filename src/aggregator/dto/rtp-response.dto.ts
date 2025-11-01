export interface UserRtpDto {
  user_id: string;
  currency: string;
  rounds: number;
  total_bet: number;
  total_win: number;
  rtp: number | null;
}

export interface RtpResponseDto {
  data: UserRtpDto[];
}

