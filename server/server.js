import dotenv from 'dotenv';
dotenv.config({ path: '.env', override: true, quiet: true });
dotenv.config({ path: '.env.local', override: true, quiet: true });

import dns from 'dns';
import mongoose from 'mongoose';
import app from './app.js';
import logger from './utils/logger.js';
import { startBackgroundJobs } from './services/cronService.js';
import { ensureUserIndexes } from './models/User.js';

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;
const MONGO_DNS_SERVERS = process.env.MONGO_DNS_SERVERS
  ?.split(',')
  .map((server) => server.trim())
  .filter(Boolean);

if (!MONGO_URI) {
  logger.error('MONGO_URI not set in environment');
  process.exit(1);
}

if (MONGO_DNS_SERVERS?.length) {
  dns.setServers(MONGO_DNS_SERVERS);
  logger.info({ dnsServers: MONGO_DNS_SERVERS }, 'Using custom DNS servers for MongoDB lookup');
}

const describeMongoUri = (uri) => {
  try {
    const parsed = new URL(uri);
    return `${parsed.protocol}//${parsed.hostname}`;
  } catch {
    return 'configured MongoDB URI';
  }
};

let cronJobs;

const start = async () => {
  try {
    console.log(`[Quantora AI] Connecting to MongoDB at ${describeMongoUri(MONGO_URI)}`);
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
    });
    logger.info('Connected to MongoDB Atlas');
    await ensureUserIndexes();

    cronJobs = startBackgroundJobs();

    const server = app.listen(PORT, () => {
      const message = `[Quantora AI] backend ready on :${PORT}`;
      console.log(message);
      logger.info({ port: PORT }, message);
    });

    const gracefulShutdown = async () => {
      logger.info('Received shutdown signal');
      if (cronJobs) {
        Object.values(cronJobs).forEach((job) => job?.stop());
      }
      await mongoose.disconnect();
      server.close(() => {
        logger.info('Server closed');
        process.exit(0);
      });
    };

    process.on('SIGINT', gracefulShutdown);
    process.on('SIGTERM', gracefulShutdown);
  } catch (error) {
    logger.error({ err: error }, 'Failed to start backend');
    process.exit(1);
  }
};

start();
