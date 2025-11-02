export class CasinoGame {
  gameId = '';
  gameName = '';

  generateBet() {
    throw new Error('generateBet must be implemented by subclass');
  }

  playGame(betData) {
    throw new Error('playGame must be implemented by subclass');
  }
}

