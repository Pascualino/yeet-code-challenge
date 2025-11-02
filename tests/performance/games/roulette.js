import { CasinoGame } from './base-game.js';

/**
 * IMPORTANT: Roulette with 0 and 00 has an RTP of 94.74%
 * So to get to the exact 95% RTP, we are giving 
 * a SPECIAL PROMOTIONAL BONUS of 0.274% on the bet amount.
 */
export class Roulette extends CasinoGame {
  gameId = 'roulette';
  gameName = 'Roulette Game';
  minBet = 5;
  maxBet = 500;

  constructor() {
    super();
    this.redNumbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
    this.blackNumbers = [2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35];
    this.allNumbers = [0, '00', ...Array.from({ length: 36 }, (_, i) => i + 1)];
  }

  generateBet() {
    const betAmount = this.minBet + Math.floor(Math.random() * (this.maxBet - this.minBet + 1));
    const betTypes = ['number', 'color'];
    const betType = betTypes[Math.floor(Math.random() * betTypes.length)];

    if (betType === 'number') {
      const selectedNumber = this.allNumbers[Math.floor(Math.random() * this.allNumbers.length)];
      return {
        amount: betAmount,
        type: 'number',
        option: selectedNumber,
      };
    } else {
      const color = Math.random() < 0.5 ? 'red' : 'black';
      return {
        amount: betAmount,
        type: 'color',
        option: color,
      };
    }
  }

  playGame(betData) {
    // BONUS: 0.274% bonus on the bet amount to get to the exact 95% RTP
    const betAmountWithBonus = betData.amount * 1.00274;
    const winningNumber = this.spinWheel();

    let winAmount = 0;

    if (betData.type === 'number') {
      if (betData.option === winningNumber) {
        winAmount = betAmountWithBonus * 36;
      }
    } else if (betData.type === 'color') {
      if (winningNumber === 0 || winningNumber === '00') {
        return 0;
      }
      const isRed = this.redNumbers.includes(Number(winningNumber));
      if ((betData.option === 'red' && isRed) || (betData.option === 'black' && !isRed)) {
        winAmount = betAmountWithBonus * 2;
      }
    }

    return this.roundWithProbability(winAmount);
  }

  roundWithProbability(amount) {
    if (amount === 0) {
      return 0;
    }

    const integerPart = Math.floor(amount);
    const decimalPart = amount - integerPart;

    if (Math.random() < decimalPart) {
      return integerPart + 1;
    }

    return integerPart;
  }

  spinWheel() {
    return this.allNumbers[Math.floor(Math.random() * this.allNumbers.length)];
  }
}

