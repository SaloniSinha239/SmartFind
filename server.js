require('dotenv').config();
const mongoose = require('mongoose');
const app = require('./app');
const { initGridFS } = require('./services/gridfs');
const { startCronJobs } = require('./cron/matchAlertJob');

const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/smartfind';

async function startServer() {
  try {
    /* ── Connect to MongoDB ── */
    await mongoose.connect(MONGO_URI);
    console.log('✅ MongoDB connected');

    /* ── Init GridFS ── */
    initGridFS(mongoose.connection);
    console.log('✅ GridFS initialized');

    /* ── Ensure indexes ── */
    const Item = require('./models/Item');
    await Item.ensureIndexes();
    console.log('✅ Database indexes created');

    /* ── Start cron jobs ── */
    startCronJobs();
    console.log('✅ Cron jobs started');

    /* ── Start HTTP server ── */
    const server = app.listen(PORT, () => {
      console.log(`🚀 SmartFind server running on http://localhost:${PORT}`);
    });

    /* ── Graceful shutdown ── */
    const shutdown = async (signal) => {
      console.log(`\n${signal} received. Shutting down gracefully...`);
      server.close(async () => {
        await mongoose.connection.close();
        console.log('MongoDB connection closed.');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

  } catch (err) {
    console.error('❌ Failed to start server:', err.message);
    process.exit(1);
  }
}

startServer();
