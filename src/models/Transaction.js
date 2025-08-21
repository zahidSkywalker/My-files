const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  transactionType: {
    type: String,
    required: true,
    enum: ['deposit', 'withdrawal', 'game_win', 'game_loss', 'bonus', 'refund', 'fee']
  },
  amount: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    default: 'USD'
  },
  status: {
    type: String,
    required: true,
    enum: ['pending', 'completed', 'failed', 'cancelled', 'processing']
  },
  paymentMethod: {
    type: String,
    enum: ['credit_card', 'debit_card', 'bank_transfer', 'crypto', 'ssl_commerce', 'paypal', 'skrill', 'neteller']
  },
  paymentProvider: {
    type: String,
    default: 'ssl_commerce'
  },
  transactionId: {
    type: String,
    required: true,
    unique: true
  },
  externalTransactionId: String, // From payment provider
  description: String,
  metadata: {
    gameId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Game'
    },
    gameType: String,
    betAmount: Number,
    winAmount: Number,
    paymentGateway: String,
    gatewayResponse: Object,
    ipAddress: String,
    userAgent: String,
    device: String
  },
  fees: {
    amount: {
      type: Number,
      default: 0
    },
    currency: {
      type: String,
      default: 'USD'
    }
  },
  balanceBefore: {
    type: Number,
    required: true
  },
  balanceAfter: {
    type: Number,
    required: true
  },
  processedAt: Date,
  failureReason: String,
  retryCount: {
    type: Number,
    default: 0
  },
  maxRetries: {
    type: Number,
    default: 3
  },
  nextRetryAt: Date,
  isReversible: {
    type: Boolean,
    default: false
  },
  reversedAt: Date,
  reversedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  reversalReason: String
}, {
  timestamps: true
});

// Indexes for better query performance
transactionSchema.index({ userId: 1, createdAt: -1 });
transactionSchema.index({ transactionType: 1, status: 1 });
transactionSchema.index({ transactionId: 1 });
transactionSchema.index({ externalTransactionId: 1 });
transactionSchema.index({ createdAt: 1 });

// Virtual for net amount (amount - fees)
transactionSchema.virtual('netAmount').get(function() {
  return this.amount - this.fees.amount;
});

// Method to mark transaction as completed
transactionSchema.methods.complete = function() {
  this.status = 'completed';
  this.processedAt = new Date();
  return this.save();
};

// Method to mark transaction as failed
transactionSchema.methods.fail = function(reason) {
  this.status = 'failed';
  this.failureReason = reason;
  this.processedAt = new Date();
  return this.save();
};

// Method to retry failed transaction
transactionSchema.methods.retry = function() {
  if (this.retryCount < this.maxRetries) {
    this.retryCount += 1;
    this.status = 'pending';
    this.nextRetryAt = new Date(Date.now() + Math.pow(2, this.retryCount) * 60 * 60 * 1000); // Exponential backoff
    return this.save();
  }
  return Promise.reject(new Error('Max retries exceeded'));
};

// Method to reverse transaction
transactionSchema.methods.reverse = function(reversedBy, reason) {
  if (!this.isReversible) {
    return Promise.reject(new Error('Transaction is not reversible'));
  }
  
  this.status = 'cancelled';
  this.reversedAt = new Date();
  this.reversedBy = reversedBy;
  this.reversalReason = reason;
  return this.save();
};

// Static method to get user balance
transactionSchema.statics.getUserBalance = async function(userId) {
  const result = await this.aggregate([
    { $match: { userId: mongoose.Types.ObjectId(userId), status: 'completed' } },
    {
      $group: {
        _id: null,
        totalDeposits: {
          $sum: {
            $cond: [
              { $in: ['$transactionType', ['deposit', 'bonus']] },
              '$amount',
              0
            ]
          }
        },
        totalWithdrawals: {
          $sum: {
            $cond: [
              { $in: ['$transactionType', ['withdrawal', 'fee']] },
              '$amount',
              0
            ]
          }
        },
        totalGameWins: {
          $sum: {
            $cond: [
              { $eq: ['$transactionType', 'game_win'] },
              '$amount',
              0
            ]
          }
        },
        totalGameLosses: {
          $sum: {
            $cond: [
              { $eq: ['$transactionType', 'game_loss'] },
              '$amount',
              0
            ]
          }
        }
      }
    }
  ]);
  
  if (result.length === 0) return 0;
  
  const { totalDeposits, totalWithdrawals, totalGameWins, totalGameLosses } = result[0];
  return (totalDeposits + totalGameWins) - (totalWithdrawals + totalGameLosses);
};

// Ensure virtual fields are serialized
transactionSchema.set('toJSON', {
  virtuals: true
});

module.exports = mongoose.model('Transaction', transactionSchema);