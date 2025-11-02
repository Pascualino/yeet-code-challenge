import { CasinoGame } from './base-game.js';

/**
 * Flipping Coin Game.
 * It's a REALLY THICK COIN and if it's lands on its edge, then it's also a lose for the user.
 * (Hence the 2.5% extra skew)
 * - Player bets an amount
 * - 47.5% chance to double the bet (2x payout)
 * - 52.5% chance to lose
 * - Expected RTP: 95% (47.5% × 2x)
 */
export class FlippingCoin extends CasinoGame {
  gameId = 'flipping-coin';
  gameName = 'Flipping Coin Game';
  minBet = 10;
  maxBet = 100;

  generateBet() {
    const betAmount = this.minBet + Math.floor(Math.random() * (this.maxBet - this.minBet + 1));
    
    return {
      amount: betAmount,
    };
  }

  playGame(betData) {
    const won = Math.random() < 0.475;
    
    if (won) {
      return betData.amount * 2;
    }
    
    return 0;
  }
}

