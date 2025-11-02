export interface RtpRequestDto {
  from: string; // ISO-8601 datetime
  to: string; // ISO-8601 datetime
  page?: string; // Page number (1-based), defaults to 1
  limit?: string; // Number of items per page, defaults to 100
}

