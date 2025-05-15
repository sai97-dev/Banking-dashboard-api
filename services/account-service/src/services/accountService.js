const CACHE_TTL = 300; // 5 minutes

class AccountService {
  /**
   * Fetch account by ID with Redis caching
   */
  async getAccountById(accountId, userId, { db, redis }) {
    const cacheKey = `account:${accountId}`;

    // Try cache first
    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const result = await db.query(
      `SELECT a.id, a.account_number, a.account_type, a.currency,
              a.status, a.created_at, c.first_name, c.last_name, c.email
       FROM accounts a
       JOIN customers c ON a.customer_id = c.id
       WHERE a.id = $1 AND a.customer_id = $2 AND a.status != 'closed'`,
      [accountId, userId]
    );

    if (!result.rows[0]) return null;

    const account = result.rows[0];

    // Cache the result
    await redis.setEx(cacheKey, CACHE_TTL, JSON.stringify(account));

    return account;
  }

  /**
   * Get live balance (never cached — always fresh)
   */
  async getBalance(accountId, userId, db) {
    const result = await db.query(
      `SELECT a.id, a.account_number, a.available_balance, a.current_balance,
              a.currency, a.last_transaction_date
       FROM accounts a
       WHERE a.id = $1 AND a.customer_id = $2`,
      [accountId, userId]
    );

    return result.rows[0] || null;
  }

  /**
   * Get paginated transactions with optional filters
   */
  async getTransactions(accountId, userId, filters, db) {
    const { page, limit, startDate, endDate, type, status, minAmount, maxAmount } = filters;
    const offset = (page - 1) * limit;

    const conditions = ['t.account_id = $1'];
    const values = [accountId];
    let paramIdx = 2;

    if (startDate) { conditions.push(`t.created_at >= $${paramIdx++}`); values.push(startDate); }
    if (endDate)   { conditions.push(`t.created_at <= $${paramIdx++}`); values.push(endDate); }
    if (type)      { conditions.push(`t.type = $${paramIdx++}`); values.push(type); }
    if (status)    { conditions.push(`t.status = $${paramIdx++}`); values.push(status); }
    if (minAmount) { conditions.push(`t.amount >= $${paramIdx++}`); values.push(minAmount); }
    if (maxAmount) { conditions.push(`t.amount <= $${paramIdx++}`); values.push(maxAmount); }

    const whereClause = conditions.join(' AND ');

    const [dataResult, countResult] = await Promise.all([
      db.query(
        `SELECT t.id, t.type, t.amount, t.currency, t.status,
                t.description, t.reference_number, t.created_at,
                t.counterparty_name, t.counterparty_account
         FROM transactions t
         WHERE ${whereClause}
         ORDER BY t.created_at DESC
         LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
        [...values, limit, offset]
      ),
      db.query(`SELECT COUNT(*) FROM transactions t WHERE ${whereClause}`, values),
    ]);

    return {
      transactions: dataResult.rows,
      total: parseInt(countResult.rows[0].count),
      page,
      limit,
    };
  }

  /**
   * Update customer profile and invalidate cache
   */
  async updateProfile(accountId, userId, updateData, { db, redis }) {
    const { firstName, lastName, email, phone, address } = updateData;

    const result = await db.query(
      `UPDATE customers
       SET first_name = COALESCE($1, first_name),
           last_name  = COALESCE($2, last_name),
           email      = COALESCE($3, email),
           phone      = COALESCE($4, phone),
           address    = COALESCE($5, address),
           updated_at = NOW()
       WHERE id = $6
       RETURNING id, first_name, last_name, email, phone, address, updated_at`,
      [firstName, lastName, email, phone, address, userId]
    );

    // Invalidate account cache after profile update
    await redis.del(`account:${accountId}`);

    return result.rows[0];
  }
}

module.exports = new AccountService();
