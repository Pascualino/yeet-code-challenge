import http from 'k6/http';
import { BASE_URL, ENDPOINT, createHeaders, randomActionId, randomUserId } from './utils.js';
import { FlippingCoin } from './games/flippingCoin.js';
import { Roulette } from './games/roulette.js';

export const options = {
  stages: [
    { duration: '2m', target: 2000 },
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
  
  // Initialize game
  const game = Math.random() < 0.5 ? new Roulette() : new FlippingCoin();
  
  // Step 1: Setup initial balance
  setupInitialBalance(userId, initialBalance);

  // Step 2: Generate all playing actions using the game
  const allActions = generatePlayingActions(game, numGames, initialBalance);

  // Step 3: Send all actions in a single batch request
  callProcessEndpoint(userId, 'USD', game.gameName, game.gameId, allActions, true);
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

function generatePlayingActions(game, numGames, initialBalance) {
  const allActions = [];
  let totalBalance = initialBalance;
  
  for (let gameNum = 0; gameNum < numGames; gameNum++) {
    const betData = game.generateBet(totalBalance);
    
    if (betData.amount > totalBalance) {
      break;
    }
    
    totalBalance -= betData.amount;
    
    allActions.push({
      action: 'bet',
      action_id: randomActionId(),
      amount: betData.amount,
    });

    const winAmount = game.playGame(betData);
    
    if (winAmount > 0) {
      allActions.push({
        action: 'win',
        action_id: randomActionId(),
        amount: winAmount,
      });
      totalBalance += winAmount;
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
    
    console.log('=== Casino-Wide RTP Report (Global Stats) ===');
    const gs = rtpData.global_stats;

    console.log(`Total Rounds (Bets): ${gs.total_rounds}`);
    console.log(`Total Bet: $${gs.total_bet.toLocaleString()}`);
    console.log(`Total Win: $${gs.total_win.toLocaleString()}`);
    console.log(`RTP: ${gs.total_rtp ? (gs.total_rtp * 100).toFixed(2) : 'N/A'}%`);
    console.log(`Expected RTP: ~95%`);
    console.log(`Rollback Bet Total: $${gs.total_rollback_bet.toLocaleString()}`);
    console.log(`Rollback Win Total: $${gs.total_rollback_win.toLocaleString()}`);
  } else {
    console.error(`Failed to fetch RTP report: ${rtpResponse.status}`);
    console.error(rtpResponse.body);
  }
}

