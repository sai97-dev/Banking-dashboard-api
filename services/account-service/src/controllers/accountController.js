const { validationResult } = require('express-validator');
const AccountService = require('../services/accountService');
const logger = require('../utils/logger');

class AccountController {
  /**
   * GET /api/accounts/:id
   * Fetch account details with Redis caching
   */
  async getAccount(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const account = await AccountService.getAccountById(id, userId, req.app.locals);
      if (!account) {
        return res.status(404).json({ message: 'Account not found' });
      }

      res.status(200).json({ success: true, data: account });
    } catch (error) {
      logger.error(`getAccount error: ${error.message}`);
      next(error);
    }
  }

  /**
   * GET /api/accounts/:id/balance
   * Get current balance (always fresh from DB, not cached)
   */
  async getBalance(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const balance = await AccountService.getBalance(id, userId, req.app.locals.db);
      res.status(200).json({ success: true, data: balance });
    } catch (error) {
      logger.error(`getBalance error: ${error.message}`);
      next(error);
    }
  }

  /**
   * GET /api/accounts/:id/transactions
   * Get transaction history with pagination and filters
   */
  async getTransactions(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      const {
        page = 1,
        limit = 20,
        startDate,
        endDate,
        type,
        status,
        minAmount,
        maxAmount,
      } = req.query;

      const result = await AccountService.getTransactions(id, userId, {
        page: parseInt(page),
        limit: Math.min(parseInt(limit), 100),
        startDate,
        endDate,
        type,
        status,
        minAmount: minAmount ? parseFloat(minAmount) : undefined,
        maxAmount: maxAmount ? parseFloat(maxAmount) : undefined,
      }, req.app.locals.db);

      res.status(200).json({
        success: true,
        data: result.transactions,
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.total,
          totalPages: Math.ceil(result.total / result.limit),
        },
      });
    } catch (error) {
      logger.error(`getTransactions error: ${error.message}`);
      next(error);
    }
  }

  /**
   * PUT /api/accounts/:id/profile
   * Update customer profile details
   */
  async updateProfile(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const { id } = req.params;
      const userId = req.user.id;
      const updateData = req.body;

      const updated = await AccountService.updateProfile(id, userId, updateData, req.app.locals);
      res.status(200).json({ success: true, data: updated, message: 'Profile updated successfully' });
    } catch (error) {
      logger.error(`updateProfile error: ${error.message}`);
      next(error);
    }
  }
}

module.exports = new AccountController();
