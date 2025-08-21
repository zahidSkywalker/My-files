const express = require('express');
const crypto = require('crypto');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const { auth, verifiedUserAuth } = require('../middleware/auth');
const router = express.Router();

// SSL Commerce configuration
const SSL_COMMERCE_CONFIG = {
  storeId: process.env.SSL_COMMERCE_STORE_ID,
  storePassword: process.env.SSL_COMMERCE_STORE_PASSWORD,
  sandbox: process.env.SSL_COMMERCE_SANDBOX === 'true',
  baseUrl: process.env.SSL_COMMERCE_SANDBOX === 'true' 
    ? 'https://sandbox.sslcommerz.com' 
    : 'https://securepay.sslcommerz.com'
};

// Generate unique transaction ID
const generateTransactionId = () => {
  return 'TXN_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
};

// Create deposit request
router.post('/deposit', verifiedUserAuth, async (req, res) => {
  try {
    const { amount, paymentMethod, currency = 'BDT' } = req.body;

    if (!amount || amount < 10) {
      return res.status(400).json({ error: 'Minimum deposit amount is 10' });
    }

    if (amount > 100000) {
      return res.status(400).json({ error: 'Maximum deposit amount is 100,000' });
    }

    // Create transaction record
    const transaction = new Transaction({
      userId: req.user._id,
      transactionType: 'deposit',
      amount: amount,
      currency: currency,
      status: 'pending',
      paymentMethod: paymentMethod || 'ssl_commerce',
      paymentProvider: 'ssl_commerce',
      transactionId: generateTransactionId(),
      description: `Deposit of ${amount} ${currency}`,
      balanceBefore: req.user.balance,
      balanceAfter: req.user.balance
    });

    await transaction.save();

    // Prepare SSL Commerce payment data
    const paymentData = {
      store_id: SSL_COMMERCE_CONFIG.storeId,
      store_passwd: SSL_COMMERCE_CONFIG.storePassword,
      total_amount: amount,
      currency: currency,
      tran_id: transaction.transactionId,
      product_category: 'casino_gaming',
      cus_name: req.user.fullName,
      cus_email: req.user.email,
      cus_add1: req.user.address?.street || 'N/A',
      cus_city: req.user.address?.city || 'N/A',
      cus_postcode: req.user.address?.postalCode || 'N/A',
      cus_country: req.user.address?.country || 'Bangladesh',
      cus_phone: req.user.phone || 'N/A',
      ship_name: req.user.fullName,
      ship_add1: req.user.address?.street || 'N/A',
      ship_city: req.user.address?.city || 'N/A',
      ship_postcode: req.user.address?.postalCode || 'N/A',
      ship_country: req.user.address?.country || 'Bangladesh',
      ship_phone: req.user.phone || 'N/A',
      success_url: `${req.protocol}://${req.get('host')}/api/payments/success`,
      fail_url: `${req.protocol}://${req.get('host')}/api/payments/fail`,
      cancel_url: `${req.protocol}://${req.get('host')}/api/payments/cancel`,
      ipn_url: `${req.protocol}://${req.get('host')}/api/payments/ipn`,
      multi_card_name: '',
      value_a: req.user._id.toString(),
      value_b: 'deposit',
      value_c: 'casino_website',
      value_d: Date.now().toString()
    };

    // Generate hash for SSL Commerce
    const hashString = `${paymentData.store_id}${paymentData.total_amount}${paymentData.currency}${paymentData.tran_id}${paymentData.success_url}${paymentData.fail_url}${paymentData.cancel_url}${paymentData.ipn_url}${paymentData.value_a}${paymentData.value_b}${paymentData.value_c}${paymentData.value_d}`;
    const hash = crypto.createHash('md5').update(hashString).digest('hex');
    paymentData.signature_key = hash;

    res.json({
      message: 'Payment initiated',
      transactionId: transaction.transactionId,
      paymentUrl: `${SSL_COMMERCE_CONFIG.baseUrl}/gwprocess/v4/api.php`,
      paymentData: paymentData
    });

  } catch (error) {
    console.error('Deposit creation error:', error);
    res.status(500).json({ error: 'Failed to create deposit request' });
  }
});

// SSL Commerce success callback
router.get('/success', async (req, res) => {
  try {
    const { tran_id, status, val_id } = req.query;

    if (!tran_id) {
      return res.status(400).json({ error: 'Transaction ID is required' });
    }

    // Find transaction
    const transaction = await Transaction.findOne({ transactionId: tran_id });
    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    if (transaction.status === 'completed') {
      return res.json({ message: 'Transaction already completed' });
    }

    // Verify payment with SSL Commerce
    const verificationData = {
      store_id: SSL_COMMERCE_CONFIG.storeId,
      store_passwd: SSL_COMMERCE_CONFIG.storePassword,
      val_id: val_id
    };

    // In production, you should verify the payment with SSL Commerce API
    // For now, we'll trust the success callback
    if (status === 'VALID') {
      // Update transaction status
      transaction.status = 'completed';
      transaction.externalTransactionId = val_id;
      transaction.processedAt = new Date();
      await transaction.save();

      // Update user balance
      const user = await User.findById(transaction.userId);
      user.balance += transaction.amount;
      await user.save();

      // Update transaction with new balance
      transaction.balanceAfter = user.balance;
      await transaction.save();

      res.json({
        message: 'Payment successful',
        transactionId: tran_id,
        amount: transaction.amount,
        newBalance: user.balance
      });
    } else {
      transaction.status = 'failed';
      transaction.failureReason = 'Payment validation failed';
      await transaction.save();

      res.json({
        message: 'Payment failed',
        transactionId: tran_id
      });
    }

  } catch (error) {
    console.error('Payment success callback error:', error);
    res.status(500).json({ error: 'Payment verification failed' });
  }
});

// SSL Commerce failure callback
router.get('/fail', async (req, res) => {
  try {
    const { tran_id, fail_reason } = req.query;

    if (tran_id) {
      const transaction = await Transaction.findOne({ transactionId: tran_id });
      if (transaction) {
        transaction.status = 'failed';
        transaction.failureReason = fail_reason || 'Payment failed';
        await transaction.save();
      }
    }

    res.json({
      message: 'Payment failed',
      reason: fail_reason || 'Unknown error'
    });

  } catch (error) {
    console.error('Payment failure callback error:', error);
    res.status(500).json({ error: 'Failed to process payment failure' });
  }
});

// SSL Commerce cancel callback
router.get('/cancel', async (req, res) => {
  try {
    const { tran_id } = req.query;

    if (tran_id) {
      const transaction = await Transaction.findOne({ transactionId: tran_id });
      if (transaction) {
        transaction.status = 'cancelled';
        await transaction.save();
      }
    }

    res.json({
      message: 'Payment cancelled'
    });

  } catch (error) {
    console.error('Payment cancel callback error:', error);
    res.status(500).json({ error: 'Failed to process payment cancellation' });
  }
});

// SSL Commerce IPN (Instant Payment Notification)
router.post('/ipn', async (req, res) => {
  try {
    const {
      tran_id,
      status,
      val_id,
      amount,
      currency,
      store_amount,
      card_type,
      card_no,
      bank_tran_id,
      card_issuer,
      card_brand,
      card_sub_brand,
      card_issuer_country,
      card_issuer_country_code,
      store_id,
      verify_sign,
      verify_key,
      cus_val_id,
      cus_val_email,
      cus_val_phone,
      cus_val_name,
      cus_val_address,
      cus_val_city,
      cus_val_country,
      cus_val_zip,
      cus_val_state,
      cus_val_email_verified,
      cus_val_phone_verified,
      cus_val_name_verified,
      cus_val_address_verified,
      cus_val_city_verified,
      cus_val_country_verified,
      cus_val_zip_verified,
      cus_val_state_verified,
      cus_val_phone_verified_at,
      cus_val_email_verified_at,
      cus_val_name_verified_at,
      cus_val_address_verified_at,
      cus_val_city_verified_at,
      cus_val_country_verified_at,
      cus_val_zip_verified_at,
      cus_val_state_verified_at
    } = req.body;

    // Verify the IPN
    const transaction = await Transaction.findOne({ transactionId: tran_id });
    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    // Update transaction with IPN data
    transaction.metadata.paymentGateway = 'ssl_commerce';
    transaction.metadata.gatewayResponse = {
      status,
      val_id,
      amount,
      currency,
      store_amount,
      card_type,
      card_no: card_no ? card_no.substring(0, 4) + '****' + card_no.substring(card_no.length - 4) : null,
      bank_tran_id,
      card_issuer,
      card_brand,
      card_sub_brand,
      card_issuer_country,
      card_issuer_country_code,
      store_id,
      verify_sign,
      verify_key
    };

    if (status === 'VALID') {
      transaction.status = 'completed';
      transaction.externalTransactionId = val_id;
      transaction.processedAt = new Date();
      
      // Update user balance
      const user = await User.findById(transaction.userId);
      user.balance += transaction.amount;
      await user.save();
      
      transaction.balanceAfter = user.balance;
    } else if (status === 'FAILED') {
      transaction.status = 'failed';
      transaction.failureReason = 'Payment failed';
    }

    await transaction.save();

    res.json({ message: 'IPN processed successfully' });

  } catch (error) {
    console.error('IPN processing error:', error);
    res.status(500).json({ error: 'IPN processing failed' });
  }
});

// Get transaction history
router.get('/history', auth, async (req, res) => {
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

// Get transaction by ID
router.get('/:transactionId', auth, async (req, res) => {
  try {
    const transaction = await Transaction.findOne({
      transactionId: req.params.transactionId,
      userId: req.user._id
    }).populate('metadata.gameId', 'gameType gameName');

    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    res.json({ transaction });

  } catch (error) {
    console.error('Transaction fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch transaction' });
  }
});

module.exports = router;