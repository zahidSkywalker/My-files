const express = require('express');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const Game = require('../models/Game');
const { auth, adminAuth } = require('../middleware/auth');
const router = express.Router();

// Get user profile
router.get('/profile', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    res.json({ user });
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Update user profile
router.put('/profile', auth, async (req, res) => {
  try {
    const updates = req.body;
    const allowedUpdates = ['firstName', 'lastName', 'phone', 'address', 'preferences'];
    
    // Filter out non-allowed updates
    const filteredUpdates = Object.keys(updates)
      .filter(key => allowedUpdates.includes(key))
      .reduce((obj, key) => {
        obj[key] = updates[key];
        return obj;
      }, {});

    const user = await User.findByIdAndUpdate(
      req.user._id,
      filteredUpdates,
      { new: true, runValidators: true }
    ).select('-password');

    res.json({ message: 'Profile updated successfully', user });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Get user balance
router.get('/balance', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('balance currency');
    res.json({ balance: user.balance, currency: user.currency });
  } catch (error) {
    console.error('Balance fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch balance' });
  }
});

// Get user statistics
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

    // Get transaction statistics
    const transactionStats = await Transaction.aggregate([
      {
        $match: {
          userId: req.user._id,
          status: 'completed',
          createdAt: { $gte: startDate }
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

    // Get gaming statistics
    const gamingStats = await Game.aggregate([
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
          maxWin: { $max: '$winAmount' }
        }
      }
    ]);

    // Calculate overall gaming performance
    const overallGaming = await Game.aggregate([
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
          totalProfitLoss: { $sum: { $subtract: ['$winAmount', '$betAmount'] } }
        }
      }
    ]);

    // Calculate RTP (Return to Player)
    const rtp = overallGaming[0] && overallGaming[0].totalBets > 0 
      ? (overallGaming[0].totalWins / overallGaming[0].totalBets) * 100 
      : 0;

    res.json({
      timeRange,
      transactionStats,
      gamingStats,
      overallGaming: overallGaming[0] || {
        totalGames: 0,
        totalBets: 0,
        totalWins: 0,
        totalProfitLoss: 0
      },
      rtp: rtp.toFixed(2)
    });

  } catch (error) {
    console.error('User stats error:', error);
    res.status(500).json({ error: 'Failed to fetch user statistics' });
  }
});

// Get user gaming history
router.get('/gaming-history', auth, async (req, res) => {
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
    console.error('Gaming history error:', error);
    res.status(500).json({ error: 'Failed to fetch gaming history' });
  }
});

// Get user transaction history
router.get('/transaction-history', auth, async (req, res) => {
  try {
    const { page = 1, limit = 20, type } = req.query;
    const skip = (page - 1) * limit;

    const query = { userId: req.user._id };
    if (type) query.transactionType = type;

    const transactions = await Transaction.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('metadata.gameId', 'gameType gameName');

    const total = await Transaction.countDocuments(query);

    res.json({
      transactions,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: parseInt(limit)
      }
    });

  } catch (error) {
    console.error('Transaction history error:', error);
    res.status(500).json({ error: 'Failed to fetch transaction history' });
  }
});

// Update user preferences
router.put('/preferences', auth, async (req, res) => {
  try {
    const { language, theme, notifications } = req.body;
    const updates = {};

    if (language) updates['preferences.language'] = language;
    if (theme) updates['preferences.theme'] = theme;
    if (notifications) {
      if (notifications.email !== undefined) updates['preferences.notifications.email'] = notifications.email;
      if (notifications.sms !== undefined) updates['preferences.notifications.sms'] = notifications.sms;
      if (notifications.push !== undefined) updates['preferences.notifications.push'] = notifications.push;
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      updates,
      { new: true, runValidators: true }
    ).select('-password');

    res.json({ message: 'Preferences updated successfully', user });
  } catch (error) {
    console.error('Preferences update error:', error);
    res.status(500).json({ error: 'Failed to update preferences' });
  }
});

// Admin: Get all users
router.get('/all', adminAuth, async (req, res) => {
  try {
    const { page = 1, limit = 20, search, status } = req.query;
    const skip = (page - 1) * limit;

    const query = {};
    if (search) {
      query.$or = [
        { username: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } }
      ];
    }
    if (status) query.isActive = status === 'active';

    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await User.countDocuments(query);

    res.json({
      users,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: parseInt(limit)
      }
    });

  } catch (error) {
    console.error('Admin users fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Admin: Get user details
router.get('/:userId', adminAuth, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select('-password');
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get user statistics
    const stats = await Game.aggregate([
      { $match: { userId: user._id, gameState: 'completed' } },
      {
        $group: {
          _id: null,
          totalGames: { $sum: 1 },
          totalBets: { $sum: '$betAmount' },
          totalWins: { $sum: '$winAmount' }
        }
      }
    ]);

    const userStats = stats[0] || {
      totalGames: 0,
      totalBets: 0,
      totalWins: 0
    };

    res.json({ user, stats: userStats });

  } catch (error) {
    console.error('Admin user fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch user details' });
  }
});

// Admin: Update user status
router.put('/:userId/status', adminAuth, async (req, res) => {
  try {
    const { isActive, kycStatus } = req.body;
    const updates = {};

    if (isActive !== undefined) updates.isActive = isActive;
    if (kycStatus) updates.kycStatus = kycStatus;

    const user = await User.findByIdAndUpdate(
      req.params.userId,
      updates,
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: 'User status updated successfully', user });

  } catch (error) {
    console.error('Admin user status update error:', error);
    res.status(500).json({ error: 'Failed to update user status' });
  }
});

// Admin: Delete user
router.delete('/:userId', adminAuth, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if user has active games or transactions
    const activeGames = await Game.countDocuments({ userId: user._id, gameState: 'active' });
    const pendingTransactions = await Transaction.countDocuments({ userId: user._id, status: 'pending' });

    if (activeGames > 0 || pendingTransactions > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete user with active games or pending transactions' 
      });
    }

    await User.findByIdAndDelete(req.params.userId);

    res.json({ message: 'User deleted successfully' });

  } catch (error) {
    console.error('Admin user delete error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

module.exports = router;