const { validationResult } = require('express-validator');
const PaymentService = require('../services/paymentService');
const logger = require('../utils/logger');

class PaymentController {
  /**
   * POST /api/payments/transfer
   * Initiate a fund transfer
   */
  async initiateTransfer(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const { fromAccountId, toAccountId, amount, currency, description, transferType } = req.body;
      const userId = req.user.id;

      // Idempotency check
      const idempotencyKey = req.headers['x-idempotency-key'];
      if (idempotencyKey) {
        const existing = await PaymentService.checkIdempotency(idempotencyKey, req.app.locals.redis);
        if (existing) {
          return res.status(200).json({ success: true, data: existing, cached: true });
        }
      }

      const payment = await PaymentService.initiateTransfer({
        fromAccountId,
        toAccountId,
        amount,
        currency: currency || 'USD',
        description,
        transferType: transferType || 'internal',
        userId,
        idempotencyKey,
      }, req.app.locals);

      res.status(201).json({ success: true, data: payment, message: 'Transfer initiated successfully' });
    } catch (error) {
      logger.error(`initiateTransfer error: ${error.message}`);
      next(error);
    }
  }

  /**
   * POST /api/payments/validate
   * Validate payment details before submission
   */
  async validatePayment(req, res, next) {
    try {
      const { fromAccountId, toAccountId, amount, currency } = req.body;
      const userId = req.user.id;

      const validation = await PaymentService.validateTransfer(
        { fromAccountId, toAccountId, amount, currency },
        userId,
        req.app.locals.db
      );

      res.status(200).json({ success: true, data: validation });
    } catch (error) {
      logger.error(`validatePayment error: ${error.message}`);
      next(error);
    }
  }

  /**
   * GET /api/payments/:id/status
   * Get payment status
   */
  async getPaymentStatus(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const payment = await PaymentService.getPaymentById(id, userId, req.app.locals.db);
      if (!payment) {
        return res.status(404).json({ message: 'Payment not found' });
      }

      res.status(200).json({ success: true, data: payment });
    } catch (error) {
      logger.error(`getPaymentStatus error: ${error.message}`);
      next(error);
    }
  }

  /**
   * GET /api/payments/history
   * Get paginated payment history
   */
  async getPaymentHistory(req, res, next) {
    try {
      const userId = req.user.id;
      const { page = 1, limit = 20, status, startDate, endDate } = req.query;

      const result = await PaymentService.getHistory(userId, {
        page: parseInt(page),
        limit: Math.min(parseInt(limit), 100),
        status,
        startDate,
        endDate,
      }, req.app.locals.db);

      res.status(200).json({
        success: true,
        data: result.payments,
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.total,
          totalPages: Math.ceil(result.total / result.limit),
        },
      });
    } catch (error) {
      logger.error(`getPaymentHistory error: ${error.message}`);
      next(error);
    }
  }
}

module.exports = new PaymentController();
