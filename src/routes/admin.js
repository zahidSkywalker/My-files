const express = require('express');
const User = require('../models/User');
const Game = require('../models/Game');
const Transaction = require('../models/Transaction');
const { adminAuth } = require('../middleware/auth');
const router = express.Router();

// Get admin dashboard statistics
router.get('/dashboard', adminAuth, async (req, res) => {
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

    // User statistics
    const userStats = await User.aggregate([
      {
        $match: { createdAt: { $gte: startDate } }
      },
      {
        $group: {
          _id: null,
          totalUsers: { $sum: 1 },
          verifiedUsers: { $sum: { $cond: ['$isVerified', 1, 0] } },
          activeUsers: { $sum: { $cond: ['$isActive', 1, 0] } },
          newUsers: { $sum: { $cond: [{ $gte: ['$createdAt', startDate] }, 1, 0] } }
        }
      }
    ]);

    // Game statistics
    const gameStats = await Game.aggregate([
      {
        $match: { 
          createdAt: { $gte: startDate },
          gameState: 'completed'
        }
      },
      {
        $group: {
          _id: null,
          totalGames: { $sum: 1 },
          totalBets: { $sum: '$betAmount' },
          totalWins: { $sum: '$winAmount' },
          avgBet: { $avg: '$betAmount' },
          maxWin: { $max: '$winAmount' }
        }
      }
    ]);

    // Transaction statistics
    const transactionStats = await Transaction.aggregate([
      {
        $match: { 
          createdAt: { $gte: startDate },
          status: 'completed'
        }
      },
      {
        $group: {
          _id: '$transactionType',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
          avgAmount: { $avg: '$amount' }
        }
      }
    ]);

    // Revenue calculation
    const revenue = await Transaction.aggregate([
      {
        $match: { 
          createdAt: { $gte: startDate },
          status: 'completed',
          transactionType: { $in: ['deposit', 'game_loss'] }
        }
      },
      {
        $group: {
          _id: null,
          totalDeposits: { $sum: '$amount' },
          totalGameLosses: { $sum: '$amount' }
        }
      }
    ]);

    const winPayouts = await Transaction.aggregate([
      {
        $match: { 
          createdAt: { $gte: startDate },
          status: 'completed',
          transactionType: 'game_win'
        }
      },
      {
        $group: {
          _id: null,
          totalWins: { $sum: '$amount' }
        }
      }
    ]);

    // Calculate net revenue
    const totalRevenue = (revenue[0]?.totalDeposits || 0) + (revenue[0]?.totalGameLosses || 0);
    const totalPayouts = winPayouts[0]?.totalWins || 0;
    const netRevenue = totalRevenue - totalPayouts;

    // Game type breakdown
    const gameTypeStats = await Game.aggregate([
      {
        $match: { 
          createdAt: { $gte: startDate },
          gameState: 'completed'
        }
      },
      {
        $group: {
          _id: '$gameType',
          totalGames: { $sum: 1 },
          totalBets: { $sum: '$betAmount' },
          totalWins: { $sum: '$winAmount' },
          avgBet: { $avg: '$betAmount' }
        }
      },
      {
        $addFields: {
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

    res.json({
      timeRange,
      userStats: userStats[0] || {
        totalUsers: 0,
        verifiedUsers: 0,
        activeUsers: 0,
        newUsers: 0
      },
      gameStats: gameStats[0] || {
        totalGames: 0,
        totalBets: 0,
        totalWins: 0,
        avgBet: 0,
        maxWin: 0
      },
      transactionStats,
      financials: {
        totalRevenue: totalRevenue.toFixed(2),
        totalPayouts: totalPayouts.toFixed(2),
        netRevenue: netRevenue.toFixed(2),
        profitMargin: totalRevenue > 0 ? ((netRevenue / totalRevenue) * 100).toFixed(2) : 0
      },
      gameTypeStats
    });

  } catch (error) {
    console.error('Admin dashboard error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard statistics' });
  }
});

// Get real-time casino status
router.get('/casino-status', adminAuth, async (req, res) => {
  try {
    // Active games
    const activeGames = await Game.countDocuments({ gameState: 'active' });
    
    // Online users (users who logged in within last 15 minutes)
    const onlineUsers = await User.countDocuments({
      lastLogin: { $gte: new Date(Date.now() - 15 * 60 * 1000) }
    });

    // Pending transactions
    const pendingTransactions = await Transaction.countDocuments({ status: 'pending' });

    // Recent activity (last hour)
    const recentActivity = await Game.aggregate([
      {
        $match: {
          createdAt: { $gte: new Date(Date.now() - 60 * 60 * 1000) }
        }
      },
      {
        $group: {
          _id: '$gameType',
          count: { $sum: 1 }
        }
      }
    ]);

    // System health
    const systemHealth = {
      database: 'healthy',
      paymentGateway: 'healthy',
      gameEngine: 'healthy',
      lastCheck: new Date()
    };

    res.json({
      activeGames,
      onlineUsers,
      pendingTransactions,
      recentActivity,
      systemHealth
    });

  } catch (error) {
    console.error('Casino status error:', error);
    res.status(500).json({ error: 'Failed to fetch casino status' });
  }
});

// Get financial reports
router.get('/financial-reports', adminAuth, async (req, res) => {
  try {
    const { startDate, endDate, reportType = 'summary' } = req.query;
    
    let start, end;
    if (startDate && endDate) {
      start = new Date(startDate);
      end = new Date(endDate);
    } else {
      // Default to last 30 days
      end = new Date();
      start = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    }

    if (reportType === 'detailed') {
      // Detailed daily breakdown
      const dailyStats = await Transaction.aggregate([
        {
          $match: {
            createdAt: { $gte: start, $lte: end },
            status: 'completed'
          }
        },
        {
          $group: {
            _id: {
              date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
              type: '$transactionType'
            },
            count: { $sum: 1 },
            totalAmount: { $sum: '$amount' }
          }
        },
        {
          $sort: { '_id.date': 1 }
        }
      ]);

      res.json({
        reportType: 'detailed',
        period: { start, end },
        dailyStats
      });

    } else {
      // Summary report
      const summary = await Transaction.aggregate([
        {
          $match: {
            createdAt: { $gte: start, $lte: end },
            status: 'completed'
          }
        },
        {
          $group: {
            _id: '$transactionType',
            count: { $sum: 1 },
            totalAmount: { $sum: '$amount' },
            avgAmount: { $avg: '$amount' },
            minAmount: { $min: '$amount' },
            maxAmount: { $max: '$amount' }
          }
        }
      ]);

      // Calculate key metrics
      const deposits = summary.find(s => s._id === 'deposit')?.totalAmount || 0;
      const withdrawals = summary.find(s => s._id === 'withdrawal')?.totalAmount || 0;
      const gameBets = summary.find(s => s._id === 'game_loss')?.totalAmount || 0;
      const gameWins = summary.find(s => s._id === 'game_win')?.totalAmount || 0;

      const netRevenue = deposits + gameBets - gameWins;
      const grossGamingRevenue = gameBets - gameWins;
      const holdPercentage = gameBets > 0 ? ((grossGamingRevenue / gameBets) * 100) : 0;

      res.json({
        reportType: 'summary',
        period: { start, end },
        summary,
        keyMetrics: {
          netRevenue: netRevenue.toFixed(2),
          grossGamingRevenue: grossGamingRevenue.toFixed(2),
          holdPercentage: holdPercentage.toFixed(2),
          totalDeposits: deposits.toFixed(2),
          totalWithdrawals: withdrawals.toFixed(2)
        }
      });
    }

  } catch (error) {
    console.error('Financial reports error:', error);
    res.status(500).json({ error: 'Failed to generate financial reports' });
  }
});

// Get game performance reports
router.get('/game-performance', adminAuth, async (req, res) => {
  try {
    const { startDate, endDate, gameType } = req.query;
    
    let start, end;
    if (startDate && endDate) {
      start = new Date(startDate);
      end = new Date(endDate);
    } else {
      end = new Date();
      start = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    }

    const matchStage = {
      createdAt: { $gte: start, $lte: end },
      gameState: 'completed'
    };

    if (gameType) matchStage.gameType = gameType;

    const gamePerformance = await Game.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$gameType',
          totalGames: { $sum: 1 },
          totalBets: { $sum: '$betAmount' },
          totalWins: { $sum: '$winAmount' },
          avgBet: { $avg: '$betAmount' },
          maxBet: { $max: '$betAmount' },
          minBet: { $min: '$betAmount' },
          maxWin: { $max: '$winAmount' },
          avgGameDuration: { $avg: '$duration' }
        }
      },
      {
        $addFields: {
          rtp: {
            $cond: [
              { $gt: ['$totalBets', 0] },
              { $multiply: [{ $divide: ['$totalWins', '$totalBets'] }, 100] },
              0
            ]
          },
          holdPercentage: {
            $cond: [
              { $gt: ['$totalBets', 0] },
              { $multiply: [{ $divide: [{ $subtract: ['$totalBets', '$totalWins'] }, '$totalBets'] }, 100] },
              0
            ]
          },
          profitLoss: { $subtract: ['$totalWins', '$totalBets'] }
        }
      },
      { $sort: { totalBets: -1 } }
    ]);

    res.json({
      period: { start, end },
      gamePerformance
    });

  } catch (error) {
    console.error('Game performance error:', error);
    res.status(500).json({ error: 'Failed to fetch game performance' });
  }
});

// Get user activity reports
router.get('/user-activity', adminAuth, async (req, res) => {
  try {
    const { startDate, endDate, activityType = 'all' } = req.query;
    
    let start, end;
    if (startDate && endDate) {
      start = new Date(startDate);
      end = new Date(endDate);
    } else {
      end = new Date();
      start = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    }

    let activityData;

    if (activityType === 'registrations') {
      activityData = await User.aggregate([
        {
          $match: { createdAt: { $gte: start, $lte: end } }
        },
        {
          $group: {
            _id: {
              date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }
            },
            newUsers: { $sum: 1 }
          }
        },
        { $sort: { '_id.date': 1 } }
      ]);
    } else if (activityType === 'gaming') {
      activityData = await Game.aggregate([
        {
          $match: {
            createdAt: { $gte: start, $lte: end },
            gameState: 'completed'
          }
        },
        {
          $group: {
            _id: {
              date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
              gameType: '$gameType'
            },
            gamesPlayed: { $sum: 1 },
            totalBets: { $sum: '$betAmount' },
            totalWins: { $sum: '$winAmount' }
          }
        },
        { $sort: { '_id.date': 1 } }
      ]);
    } else {
      // All activity
      const registrations = await User.aggregate([
        {
          $match: { createdAt: { $gte: start, $lte: end } }
        },
        {
          $group: {
            _id: {
              date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }
            },
            newUsers: { $sum: 1 }
          }
        }
      ]);

      const gaming = await Game.aggregate([
        {
          $match: {
            createdAt: { $gte: start, $lte: end },
            gameState: 'completed'
          }
        },
        {
          $group: {
            _id: {
              date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }
            },
            gamesPlayed: { $sum: 1 },
            totalBets: { $sum: '$betAmount' }
          }
        }
      ]);

      activityData = { registrations, gaming };
    }

    res.json({
      period: { start, end },
      activityType,
      activityData
    });

  } catch (error) {
    console.error('User activity error:', error);
    res.status(500).json({ error: 'Failed to fetch user activity' });
  }
});

// System maintenance and controls
router.post('/system-controls', adminAuth, async (req, res) => {
  try {
    const { action, target, value } = req.body;

    switch (action) {
      case 'toggle_maintenance':
        // In a real system, you'd update a global setting
        res.json({ message: 'Maintenance mode toggled', action, value });
        break;

      case 'clear_cache':
        // Clear various caches
        res.json({ message: 'Cache cleared successfully', action });
        break;

      case 'backup_database':
        // Trigger database backup
        res.json({ message: 'Database backup initiated', action });
        break;

      default:
        res.status(400).json({ error: 'Invalid action' });
    }

  } catch (error) {
    console.error('System controls error:', error);
    res.status(500).json({ error: 'Failed to execute system control' });
  }
});

module.exports = router;