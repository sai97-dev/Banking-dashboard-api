const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { Pool } = require('pg');
const redis = require('redis');

const accountRoutes = require('./routes/accountRoutes');
const transactionRoutes = require('./routes/transactionRoutes');
const { authenticateToken } = require('../../middleware/auth');
const { errorHandler } = require('./middleware/errorHandler');
const logger = require('./utils/logger');

const app = express();
const PORT = process.env.PORT || 3001;

// Database connection pool
const pool = new Pool({
  connectionString: process.env.POSTGRES_URI,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Redis client
const redisClient = redis.createClient({ url: process.env.REDIS_URL });
redisClient.connect().catch(console.error);

// Make db & redis available to routes
app.locals.db = pool;
app.locals.redis = redisClient;

// Security middleware
app.use(helmet());
app.use(cors({ origin: process.env.ALLOWED_ORIGINS?.split(',') || '*' }));
app.use(express.json({ limit: '10kb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP, please try again later.',
});
app.use('/api/', limiter);

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'account-service', timestamp: new Date().toISOString() });
});

// Routes (protected)
app.use('/api/accounts', authenticateToken, accountRoutes);
app.use('/api/transactions', authenticateToken, transactionRoutes);

// Global error handler
app.use(errorHandler);

app.listen(PORT, () => {
  logger.info(`Account Service running on port ${PORT}`);
});

module.exports = app;
