const mongoose = require('mongoose');

const gameSchema = new mongoose.Schema({
  gameType: {
    type: String,
    required: true,
    enum: ['slots', 'blackjack', 'roulette', 'poker', 'baccarat', 'dice', 'lottery']
  },
  gameName: {
    type: String,
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  betAmount: {
    type: Number,
    required: true,
    min: 0.01
  },
  winAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  gameState: {
    type: String,
    enum: ['active', 'completed', 'cancelled'],
    default: 'active'
  },
  gameData: {
    // For slots
    reels: [String],
    paylines: [Number],
    symbols: [String],
    
    // For table games
    playerCards: [String],
    dealerCards: [String],
    communityCards: [String],
    
    // For roulette
    wheelNumber: Number,
    color: String,
    betType: String,
    
    // For dice
    diceValues: [Number],
    totalValue: Number,
    
    // For lottery
    selectedNumbers: [Number],
    winningNumbers: [Number]
  },
  result: {
    isWin: {
      type: Boolean,
      default: false
    },
    multiplier: {
      type: Number,
      default: 1
    },
    winLines: [{
      lineNumber: Number,
      symbols: [String],
      payout: Number
    }],
    description: String
  },
  sessionId: {
    type: String,
    required: true,
    unique: true
  },
  startTime: {
    type: Date,
    default: Date.now
  },
  endTime: Date,
  duration: Number, // in seconds
  isDemo: {
    type: Boolean,
    default: false
  },
  currency: {
    type: String,
    default: 'USD'
  },
  metadata: {
    device: String,
    browser: String,
    ipAddress: String,
    userAgent: String
  }
}, {
  timestamps: true
});

// Index for better query performance
gameSchema.index({ userId: 1, createdAt: -1 });
gameSchema.index({ gameType: 1, createdAt: -1 });
gameSchema.index({ sessionId: 1 });

// Virtual for profit/loss
gameSchema.virtual('profitLoss').get(function() {
  return this.winAmount - this.betAmount;
});

// Virtual for game duration
gameSchema.virtual('gameDuration').get(function() {
  if (this.startTime && this.endTime) {
    return Math.round((this.endTime - this.startTime) / 1000);
  }
  return 0;
});

// Method to complete game
gameSchema.methods.completeGame = function(winAmount, gameData, result) {
  this.winAmount = winAmount;
  this.gameData = gameData;
  this.result = result;
  this.gameState = 'completed';
  this.endTime = new Date();
  this.duration = this.gameDuration;
  return this.save();
};

// Method to calculate RTP (Return to Player)
gameSchema.statics.calculateRTP = async function(userId, gameType, timeRange) {
  const query = { userId, gameState: 'completed' };
  if (gameType) query.gameType = gameType;
  if (timeRange) {
    query.createdAt = { $gte: new Date(Date.now() - timeRange) };
  }
  
  const games = await this.find(query);
  const totalBets = games.reduce((sum, game) => sum + game.betAmount, 0);
  const totalWins = games.reduce((sum, game) => sum + game.winAmount, 0);
  
  return totalBets > 0 ? (totalWins / totalBets) * 100 : 0;
};

// Ensure virtual fields are serialized
gameSchema.set('toJSON', {
  virtuals: true
});

module.exports = mongoose.model('Game', gameSchema);