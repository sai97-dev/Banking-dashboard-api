const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

const DAILY_TRANSFER_LIMIT = 10000;
const IDEMPOTENCY_TTL = 86400; // 24 hours

class PaymentService {
  /**
   * Check idempotency key in Redis to prevent duplicate transfers
   */
  async checkIdempotency(key, redis) {
    const cached = await redis.get(`idempotency:${key}`);
    return cached ? JSON.parse(cached) : null;
  }

  /**
   * Validate transfer: check balances, limits, and account status
   */
  async validateTransfer({ fromAccountId, toAccountId, amount, currency }, userId, db) {
    const fromAccount = await db.query(
      `SELECT id, available_balance, currency, status, daily_transfer_used
       FROM accounts WHERE id = $1 AND customer_id = $2`,
      [fromAccountId, userId]
    );

    if (!fromAccount.rows[0]) throw new Error('Source account not found');

    const account = fromAccount.rows[0];

    if (account.status !== 'active') throw new Error('Source account is not active');
    if (account.currency !== (currency || 'USD')) throw new Error('Currency mismatch');
    if (account.available_balance < amount) throw new Error('Insufficient funds');
    if (account.daily_transfer_used + amount > DAILY_TRANSFER_LIMIT) {
      throw new Error(`Daily transfer limit of $${DAILY_TRANSFER_LIMIT} exceeded`);
    }

    const toAccount = await db.query(
      `SELECT id, status FROM accounts WHERE id = $1`,
      [toAccountId]
    );

    if (!toAccount.rows[0]) throw new Error('Destination account not found');
    if (toAccount.rows[0].status !== 'active') throw new Error('Destination account is not active');

    return {
      valid: true,
      availableBalance: account.available_balance,
      remainingDailyLimit: DAILY_TRANSFER_LIMIT - account.daily_transfer_used,
    };
  }

  /**
   * Process the transfer in a DB transaction and publish Kafka event
   */
  async initiateTransfer(transferData, { db, redis, kafka }) {
    const { fromAccountId, toAccountId, amount, currency, description, transferType, userId, idempotencyKey } = transferData;
    const client = await db.connect();

    try {
      await client.query('BEGIN');

      // Validate before deducting
      await this.validateTransfer({ fromAccountId, toAccountId, amount, currency }, userId, client);

      const referenceNumber = `TXN-${uuidv4().split('-')[0].toUpperCase()}`;

      // Debit source account
      await client.query(
        `UPDATE accounts
         SET available_balance = available_balance - $1,
             current_balance = current_balance - $1,
             daily_transfer_used = daily_transfer_used + $1,
             last_transaction_date = NOW()
         WHERE id = $2`,
        [amount, fromAccountId]
      );

      // Credit destination account
      await client.query(
        `UPDATE accounts
         SET available_balance = available_balance + $1,
             current_balance = current_balance + $1,
             last_transaction_date = NOW()
         WHERE id = $2`,
        [amount, toAccountId]
      );

      // Record the payment
      const paymentResult = await client.query(
        `INSERT INTO payments (id, from_account_id, to_account_id, amount, currency,
                               status, description, transfer_type, reference_number, created_by)
         VALUES ($1, $2, $3, $4, $5, 'completed', $6, $7, $8, $9)
         RETURNING *`,
        [uuidv4(), fromAccountId, toAccountId, amount, currency, description, transferType, referenceNumber, userId]
      );

      await client.query('COMMIT');

      const payment = paymentResult.rows[0];

      // Publish Kafka event for notification service
      await kafka.send({
        topic: 'payment.completed',
        messages: [{
          key: payment.id,
          value: JSON.stringify({
            paymentId: payment.id,
            userId,
            fromAccountId,
            toAccountId,
            amount,
            currency,
            referenceNumber,
            timestamp: new Date().toISOString(),
          }),
        }],
      });

      // Cache idempotency result
      if (idempotencyKey) {
        await redis.setEx(`idempotency:${idempotencyKey}`, IDEMPOTENCY_TTL, JSON.stringify(payment));
      }

      logger.info(`Transfer completed: ${referenceNumber} | Amount: ${amount} ${currency}`);
      return payment;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error(`Transfer failed: ${error.message}`);
      throw error;
    } finally {
      client.release();
    }
  }

  async getPaymentById(paymentId, userId, db) {
    const result = await db.query(
      `SELECT p.*, a1.account_number as from_account_number, a2.account_number as to_account_number
       FROM payments p
       JOIN accounts a1 ON p.from_account_id = a1.id
       JOIN accounts a2 ON p.to_account_id = a2.id
       WHERE p.id = $1 AND p.created_by = $2`,
      [paymentId, userId]
    );
    return result.rows[0] || null;
  }

  async getHistory(userId, { page, limit, status, startDate, endDate }, db) {
    const offset = (page - 1) * limit;
    const conditions = ['p.created_by = $1'];
    const values = [userId];
    let idx = 2;

    if (status)    { conditions.push(`p.status = $${idx++}`); values.push(status); }
    if (startDate) { conditions.push(`p.created_at >= $${idx++}`); values.push(startDate); }
    if (endDate)   { conditions.push(`p.created_at <= $${idx++}`); values.push(endDate); }

    const where = conditions.join(' AND ');

    const [data, count] = await Promise.all([
      db.query(`SELECT * FROM payments p WHERE ${where} ORDER BY created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`,
        [...values, limit, offset]),
      db.query(`SELECT COUNT(*) FROM payments p WHERE ${where}`, values),
    ]);

    return { payments: data.rows, total: parseInt(count.rows[0].count), page, limit };
  }
}

module.exports = new PaymentService();
