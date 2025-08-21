const express = require('express');
const Game = require('../models/Game');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const { auth, verifiedUserAuth } = require('../middleware/auth');
const router = express.Router();

// Generate unique session ID
const generateSessionId = () => {
  return 'GAME_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
};

// Get available games
router.get('/available', async (req, res) => {
  try {
    const games = [
      {
        id: 'royal-slots',
        name: 'Royal Slots',
        type: 'slots',
        description: 'Classic 5-reel slot machine with royal theme',
        minBet: 0.10,
        maxBet: 1000,
        rtp: 96.5,
        volatility: 'medium',
        image: '/images/games/royal-slots.jpg',
        demo: true
      },
      {
        id: 'blackjack-royal',
        name: 'Royal Blackjack',
        type: 'blackjack',
        description: 'Classic blackjack with royal payouts',
        minBet: 1,
        maxBet: 500,
        rtp: 99.5,
        volatility: 'low',
        image: '/images/games/blackjack-royal.jpg',
        demo: true
      },
      {
        id: 'roulette-royal',
        name: 'Royal Roulette',
        type: 'roulette',
        description: 'European roulette with royal betting options',
        minBet: 0.50,
        maxBet: 1000,
        rtp: 97.3,
        volatility: 'medium',
        image: '/images/games/roulette-royal.jpg',
        demo: true
      },
      {
        id: 'poker-royal',
        name: 'Royal Poker',
        type: 'poker',
        description: 'Texas Hold\'em poker with royal flush bonus',
        minBet: 2,
        maxBet: 1000,
        rtp: 98.1,
        volatility: 'high',
        image: '/images/games/poker-royal.jpg',
        demo: true
      },
      {
        id: 'baccarat-royal',
        name: 'Royal Baccarat',
        type: 'baccarat',
        description: 'Classic baccarat with royal side bets',
        minBet: 5,
        maxBet: 2000,
        rtp: 98.9,
        volatility: 'low',
        image: '/images/games/baccarat-royal.jpg',
        demo: true
      },
      {
        id: 'dice-royal',
        name: 'Royal Dice',
        type: 'dice',
        description: 'Dice game with royal multipliers',
        minBet: 0.10,
        maxBet: 500,
        rtp: 97.8,
        volatility: 'high',
        image: '/images/games/dice-royal.jpg',
        demo: true
      },
      {
        id: 'lottery-royal',
        name: 'Royal Lottery',
        type: 'lottery',
        description: 'Daily lottery with royal jackpots',
        minBet: 1,
        maxBet: 100,
        rtp: 95.0,
        volatility: 'very-high',
        image: '/images/games/lottery-royal.jpg',
        demo: true
      }
    ];

    res.json({ games });
  } catch (error) {
    console.error('Available games error:', error);
    res.status(500).json({ error: 'Failed to fetch available games' });
  }
});

// Start a new game
router.post('/start', verifiedUserAuth, async (req, res) => {
  try {
    const { gameId, betAmount, gameType, isDemo = false } = req.body;

    if (!gameId || !betAmount || !gameType) {
      return res.status(400).json({ error: 'Game ID, bet amount, and game type are required' });
    }

    if (betAmount < 0.10) {
      return res.status(400).json({ error: 'Minimum bet amount is 0.10' });
    }

    if (betAmount > 10000) {
      return res.status(400).json({ error: 'Maximum bet amount is 10,000' });
    }

    // Check user balance for real money games
    if (!isDemo && req.user.balance < betAmount) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    // Create new game session
    const game = new Game({
      gameType,
      gameName: gameId,
      userId: req.user._id,
      betAmount: isDemo ? 0 : betAmount,
      sessionId: generateSessionId(),
      isDemo,
      currency: req.user.currency,
      metadata: {
        device: req.headers['user-agent'] || 'Unknown',
        ipAddress: req.ip || 'Unknown'
      }
    });

    await game.save();

    // Deduct bet amount from user balance for real money games
    if (!isDemo) {
      req.user.balance -= betAmount;
      await req.user.save();

      // Create transaction record for bet
      const transaction = new Transaction({
        userId: req.user._id,
        transactionType: 'game_loss',
        amount: betAmount,
        currency: req.user.currency,
        status: 'completed',
        paymentMethod: 'casino_balance',
        transactionId: 'BET_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        description: `Bet on ${gameId}`,
        balanceBefore: req.user.balance + betAmount,
        balanceAfter: req.user.balance,
        metadata: {
          gameId: game._id,
          gameType,
          betAmount,
          winAmount: 0
        }
      });

      await transaction.save();
    }

    res.json({
      message: 'Game started successfully',
      game: {
        id: game._id,
        sessionId: game.sessionId,
        gameType: game.gameType,
        gameName: game.gameName,
        betAmount: game.betAmount,
        isDemo: game.isDemo,
        balance: req.user.balance
      }
    });

  } catch (error) {
    console.error('Game start error:', error);
    res.status(500).json({ error: 'Failed to start game' });
  }
});

// Process game result
router.post('/result', verifiedUserAuth, async (req, res) => {
  try {
    const { sessionId, gameData, result, winAmount = 0 } = req.body;

    if (!sessionId || !gameData || !result) {
      return res.status(400).json({ error: 'Session ID, game data, and result are required' });
    }

    // Find the game session
    const game = await Game.findOne({ sessionId, userId: req.user._id });
    if (!game) {
      return res.status(404).json({ error: 'Game session not found' });
    }

    if (game.gameState !== 'active') {
      return res.status(400).json({ error: 'Game session is not active' });
    }

    // Complete the game
    await game.completeGame(winAmount, gameData, result);

    // Process winnings for real money games
    if (!game.isDemo && winAmount > 0) {
      req.user.balance += winAmount;
      await req.user.save();

      // Create transaction record for win
      const transaction = new Transaction({
        userId: req.user._id,
        transactionType: 'game_win',
        amount: winAmount,
        currency: req.user.currency,
        status: 'completed',
        paymentMethod: 'casino_balance',
        transactionId: 'WIN_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        description: `Win from ${game.gameName}`,
        balanceBefore: req.user.balance - winAmount,
        balanceAfter: req.user.balance,
        metadata: {
          gameId: game._id,
          gameType: game.gameType,
          betAmount: game.betAmount,
          winAmount
        }
      });

      await transaction.save();
    }

    // Update user gaming history
    req.user.gamingHistory.push({
      gameId: game._id,
      gameType: game.gameType,
      betAmount: game.betAmount,
      winAmount: winAmount,
      playedAt: new Date()
    });

    await req.user.save();

    res.json({
      message: 'Game completed successfully',
      game: {
        id: game._id,
        sessionId: game.sessionId,
        betAmount: game.betAmount,
        winAmount: game.winAmount,
        result: game.result,
        balance: req.user.balance
      }
    });

  } catch (error) {
    console.error('Game result error:', error);
    res.status(500).json({ error: 'Failed to process game result' });
  }
});

// Get game history
router.get('/history', auth, async (req, res) => {
  try {
    const { page = 1, limit = 20, gameType } = req.query;
    const skip = (page - 1) * limit;

    const query = { userId: req.user._id };
    if (gameType) query.gameType = gameType;

    const games = await Game.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Game.countDocuments(query);

    res.json({
      games,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: parseInt(limit)
      }
    });

  } catch (error) {
    console.error('Game history error:', error);
    res.status(500).json({ error: 'Failed to fetch game history' });
  }
});

// Get game statistics
router.get('/stats', auth, async (req, res) => {
  try {
    const { timeRange = '30d' } = req.query;
    
    let startDate;
    switch (timeRange) {
      case '7d':
        startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
        break;
      case '1y':
        startDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    }

    const stats = await Game.aggregate([
      {
        $match: {
          userId: req.user._id,
          gameState: 'completed',
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: '$gameType',
          totalGames: { $sum: 1 },
          totalBets: { $sum: '$betAmount' },
          totalWins: { $sum: '$winAmount' },
          avgBet: { $avg: '$betAmount' },
          maxWin: { $max: '$winAmount' },
          minBet: { $min: '$betAmount' }
        }
      },
      {
        $addFields: {
          profitLoss: { $subtract: ['$totalWins', '$totalBets'] },
          rtp: {
            $cond: [
              { $gt: ['$totalBets', 0] },
              { $multiply: [{ $divide: ['$totalWins', '$totalBets'] }, 100] },
              0
            ]
          }
        }
      }
    ]);

    // Calculate overall statistics
    const overallStats = await Game.aggregate([
      {
        $match: {
          userId: req.user._id,
          gameState: 'completed',
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: null,
          totalGames: { $sum: 1 },
          totalBets: { $sum: '$betAmount' },
          totalWins: { $sum: '$winAmount' },
          avgBet: { $avg: '$betAmount' },
          maxWin: { $max: '$winAmount' },
          totalProfitLoss: { $sum: { $subtract: ['$winAmount', '$betAmount'] } }
        }
      }
    ]);

    res.json({
      gameStats: stats,
      overallStats: overallStats[0] || {
        totalGames: 0,
        totalBets: 0,
        totalWins: 0,
        avgBet: 0,
        maxWin: 0,
        totalProfitLoss: 0
      },
      timeRange
    });

  } catch (error) {
    console.error('Game stats error:', error);
    res.status(500).json({ error: 'Failed to fetch game statistics' });
  }
});

// Get specific game session
router.get('/session/:sessionId', auth, async (req, res) => {
  try {
    const game = await Game.findOne({
      sessionId: req.params.sessionId,
      userId: req.user._id
    });

    if (!game) {
      return res.status(404).json({ error: 'Game session not found' });
    }

    res.json({ game });

  } catch (error) {
    console.error('Game session fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch game session' });
  }
});

module.exports = router;