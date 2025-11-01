import { sleep } from 'k6';
import http from 'k6/http';
import { BASE_URL, ENDPOINT, createHeaders, randomActionId, randomUserId } from './utils.js';

// Configuration: number of virtual users and ramp-up
export const options = {
  stages: [
    { duration: '10s', target: 50 },   // Ramp up to 50 concurrent users
    { duration: '20s', target: 50 },    // Stay at 50 users for 2 minutes
    { duration: '10s', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_failed: ['rate<0.05'],    // Allow up to 5% errors (users may run out of funds)
  },
};

export function setup() {
  const testStartTime = new Date().toISOString();
  console.log(`🚀 Data generation started at ${testStartTime}`);
  return { startTime: testStartTime };
}

// Main function: Each VU simulates a user playing games
export default function () {
  const userId = randomUserId();
  const numGames = Math.floor(Math.random() * 10) + 1; // 1-10 games
  const initialBalance = 500 + Math.floor(Math.random() * 500); // $500-$1000 starting balance
  
  // Give user initial balance with a win
  const setupBody = JSON.stringify({
    user_id: userId,
    currency: 'USD',
    game: 'gen:setup',
    game_id: randomActionId(),
    actions: [
      {
        action: 'win',
        action_id: randomActionId(),
        amount: initialBalance,
      },
    ],
  });

  const setupResponse = http.post(
    `${BASE_URL}${ENDPOINT}`,
    setupBody,
    { headers: createHeaders(setupBody) }
  );

  if (setupResponse.status !== 200) {
    console.error(`Setup failed for ${userId}: ${setupResponse.status}`);
    return;
  }

  // Play games
  for (let gameNum = 0; gameNum < numGames; gameNum++) {
    const betAmount = 10 + Math.floor(Math.random() * 91); // $10-$100
    const gameId = randomActionId();
    const gameName = `gen:game-${gameNum + 1}`;
    
    // Place bet
    const betBody = JSON.stringify({
      user_id: userId,
      currency: 'USD',
      game: gameName,
      game_id: gameId,
      actions: [
        {
          action: 'bet',
          action_id: randomActionId(),
          amount: betAmount,
        },
      ],
    });

    const betResponse = http.post(
      `${BASE_URL}${ENDPOINT}`,
      betBody,
      { headers: createHeaders(betBody) }
    );

    if (betResponse.status !== 200) {
      // User might be out of funds, skip remaining games
      if (betResponse.status === 400) {
        const body = JSON.parse(betResponse.body);
        if (body.code === 100) {
          console.log(`💰 User ${userId} ran out of funds after ${gameNum} games`);
          break;
        }
      }
      continue;
    }

    // Determine win/loss: 47.5% chance to win, 52.5% chance to lose
    const won = Math.random() < 0.475;
    
    if (won) {
      // Win: double the bet
      const winBody = JSON.stringify({
        user_id: userId,
        currency: 'USD',
        game: gameName,
        game_id: gameId,
        finished: true,
        actions: [
          {
            action: 'win',
            action_id: randomActionId(),
            amount: betAmount * 2,
          },
        ],
      });

      const winResponse = http.post(
        `${BASE_URL}${ENDPOINT}`,
        winBody,
        { headers: createHeaders(winBody) }
      );

      if (winResponse.status !== 200) {
        console.error(`Win failed for ${userId} game ${gameNum + 1}: ${winResponse.status}`);
      }
    }

    // Small delay between games
    sleep(0.1 + Math.random() * 0.2);
  }
}

// Teardown: Query RTP endpoint to show results
export function teardown(data) {
  const testStartTime = data.startTime;
  const testEndTime = new Date().toISOString();
  console.log(`\n📊 Data generation completed at ${testEndTime}`);
  console.log(`\n🔍 Fetching RTP report for period: ${testStartTime} to ${testEndTime}\n`);

  // Query casino-wide RTP
  const rtpUrl = `${BASE_URL}/aggregator/takehome/rtp?from=${encodeURIComponent(testStartTime)}&to=${encodeURIComponent(testEndTime)}`;
  const rtpResponse = http.get(rtpUrl);

  if (rtpResponse.status === 200) {
    const rtpData = JSON.parse(rtpResponse.body);
    
    console.log('=== Casino-Wide RTP Report ===');
    if (Array.isArray(rtpData.data) && rtpData.data.length > 0) {
      // Aggregate across all users
      const totals = rtpData.data.reduce(
        (acc, user) => ({
          total_users: acc.total_users + 1,
          total_rounds: acc.total_rounds + user.rounds,
          total_bet: acc.total_bet + user.total_bet,
          total_win: acc.total_win + user.total_win,
        }),
        { total_users: 0, total_rounds: 0, total_bet: 0, total_win: 0 }
      );

      const rtp = totals.total_bet > 0 
        ? ((totals.total_win / totals.total_bet) * 100).toFixed(2)
        : 'N/A';

      console.log(`Total Users: ${totals.total_users}`);
      console.log(`Total Rounds (Bets): ${totals.total_rounds}`);
      console.log(`Total Bet: $${totals.total_bet.toLocaleString()}`);
      console.log(`Total Win: $${totals.total_win.toLocaleString()}`);
      console.log(`RTP: ${rtp}%`);
      console.log(`\nExpected RTP: ~95% (47.5% win rate × 2x payout)`);
    } else {
      console.log('No data found in RTP report');
    }
  } else {
    console.error(`Failed to fetch RTP report: ${rtpResponse.status}`);
    console.error(rtpResponse.body);
  }
}

