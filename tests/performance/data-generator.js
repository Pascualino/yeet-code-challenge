import http from 'k6/http';
import { BASE_URL, ENDPOINT, createHeaders, randomActionId, randomUserId } from './utils.js';

export const options = {
  stages: [
    { duration: '2m', target: 1000 },
    { duration: '10s', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.05'],
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
  const numGames = 900 + Math.floor(Math.random() * 101); // 900-1000 games
  const initialBalance = 1000 + Math.floor(Math.random() * 10000); // $1000-11000 starting balance
  const betAmount = 10 + Math.floor(Math.random() * 90); // 10-100
  const gameName = `flipping-coin-game`;
  
  // Step 1: Setup initial balance
  setupInitialBalance(userId, initialBalance);

  // Step 2: Generate all playing actions
  const allActions = generatePlayingActions(numGames, betAmount, initialBalance);

  // Step 3: Send all actions in a single batch request
  callProcessEndpoint(userId, 'USD', gameName, gameName, allActions, true);
}

// Helper: Call the /process endpoint
function callProcessEndpoint(userId, currency, game, gameId, actions, finished = false) {
  const body = JSON.stringify({
    user_id: userId,
    currency: currency,
    game: game,
    game_id: gameId,
    finished: finished,
    actions: actions,
  });

  const response = http.post(
    `${BASE_URL}${ENDPOINT}`,
    body,
    { headers: createHeaders(body) }
  );

  if (response.status !== 200) {
    throw new Error(`Process endpoint failed for ${userId}: ${response.status} - ${response.body.substring(0, 200)}`);
  }

  return response;
}

function setupInitialBalance(userId, initialBalance) {
  callProcessEndpoint(
    userId,
    'USD',
    'gen:setup',
    'initial-balance', // Special game_id to exclude from RTP calculations
    [
      {
        action: 'win',
        action_id: randomActionId(),
        amount: initialBalance,
      },
    ]
  );
}

function generatePlayingActions(numGames, betAmount, initialBalance) {
  const allActions = [];
  let totalBalance = initialBalance;
  
  for (let gameNum = 0; gameNum < numGames; gameNum++) {
    if (betAmount > totalBalance) {
      break;
    }
    
    totalBalance -= betAmount;
    
    allActions.push({
      action: 'bet',
      action_id: randomActionId(),
      amount: betAmount,
    });

    // Determine win/loss: 47.5% chance to win, 52.5% chance to lose
    // Expected value 47.5% * 2 = 95% RTP
    const won = Math.random() < 0.475;
    
    if (won) {
      allActions.push({
        action: 'win',
        action_id: randomActionId(),
        amount: betAmount * 2,
      });
      totalBalance += betAmount * 2;
    }
  }

  return allActions;
}

// Teardown: Query RTP endpoint to show results
export function teardown(data) {
  const testStartTime = data.startTime;
  const testEndTime = new Date().toISOString();
  console.log(`\n📊 Data generation completed at ${testEndTime}`);
  console.log(`\n🔍 Fetching RTP report for period: ${testStartTime} to ${testEndTime}\n`);

  const rtpUrl = `${BASE_URL}/aggregator/takehome/rtp?from=${encodeURIComponent(testStartTime)}&to=${encodeURIComponent(testEndTime)}`;
  const rtpResponse = http.get(rtpUrl);

  if (rtpResponse.status === 200) {
    const rtpData = JSON.parse(rtpResponse.body);
    
    console.log('=== Casino-Wide RTP Report ===');
    if (Array.isArray(rtpData.data) && rtpData.data.length > 0) {
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

