import http from 'k6/http';
import { check } from 'k6';
import { Rate, Trend } from 'k6/metrics';
import { BASE_URL } from './utils.js';
import { getRtpConfig } from './config.js';

// Custom metrics
const errorRate = new Rate('errors');
const errorStatusTrend = new Trend('error_status');

export const options = getRtpConfig();

function getDateRange() {
  const now = new Date();
  const from = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 24 hours ago
  const to = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours from now
  
  return {
    from: from.toISOString(),
    to: to.toISOString(),
  };
}

export default function () {
  const dateRange = getDateRange();
  
  // Test casino-wide RTP endpoint
  const casinoWideUrl = `${BASE_URL}/aggregator/takehome/rtp?from=${encodeURIComponent(dateRange.from)}&to=${encodeURIComponent(dateRange.to)}`;
  
  const casinoWideResponse = http.get(casinoWideUrl);

  const casinoWideCheck = check(casinoWideResponse, {
    'casino-wide RTP status is 200': (r) => r.status === 200,
    'casino-wide RTP has data array': (r) => {
      try {
        const body = JSON.parse(r.body);
        return Array.isArray(body.data);
      } catch {
        return false;
      }
    },
    'casino-wide RTP data structure is valid': (r) => {
      try {
        const body = JSON.parse(r.body);
        if (!Array.isArray(body.data) || body.data.length === 0) {
          return true; // Empty is valid
        }
        const firstItem = body.data[0];
        return (
          typeof firstItem.user_id === 'string' &&
          typeof firstItem.currency === 'string' &&
          typeof firstItem.rounds === 'number' &&
          typeof firstItem.total_bet === 'number' &&
          typeof firstItem.total_win === 'number' &&
          (firstItem.rtp === null || typeof firstItem.rtp === 'number')
        );
      } catch {
        return false;
      }
    },
  });

  if (!casinoWideCheck) {
    errorRate.add(1);
    errorStatusTrend.add(casinoWideResponse.status);
    if (casinoWideResponse.status !== 200) {
      console.error(`Casino-wide RTP failed: ${casinoWideResponse.status} - ${casinoWideResponse.body.substring(0, 200)}`);
    }
  }
}

