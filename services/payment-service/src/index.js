const express = require('express');
const { Kafka } = require('kafkajs');
const { Pool } = require('pg');
const redis = require('redis');

const { authenticateToken } = require('../../middleware/auth');
const { errorHandler } = require('./middleware/errorHandler');
const paymentRoutes = require('./routes/paymentRoutes');
const logger = require('./utils/logger');

const app = express();
const PORT = process.env.PORT || 3002;

// Kafka producer setup
const kafka = new Kafka({ brokers: [process.env.KAFKA_BROKER || 'localhost:9092'] });
const producer = kafka.producer();

// DB pool
const pool = new Pool({ connectionString: process.env.POSTGRES_URI, max: 20 });

// Redis
const redisClient = redis.createClient({ url: process.env.REDIS_URL });

(async () => {
  await producer.connect();
  await redisClient.connect();
  logger.info('Kafka producer and Redis connected');
})();

app.locals.db = pool;
app.locals.redis = redisClient;
app.locals.kafka = producer;

app.use(express.json({ limit: '10kb' }));

app.get('/health', (req, res) =>
  res.json({ status: 'ok', service: 'payment-service', timestamp: new Date().toISOString() })
);

app.use('/api/payments', authenticateToken, paymentRoutes);
app.use(errorHandler);

app.listen(PORT, () => logger.info(`Payment Service running on port ${PORT}`));

module.exports = app;
