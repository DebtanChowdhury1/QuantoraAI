import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import pinoHttp from 'pino-http';
import logger from './utils/logger.js';
import marketRoutes from './routes/marketRoutes.js';
import aiRoutes from './routes/aiRoutes.js';
import alertRoutes from './routes/alertRoutes.js';
import { HttpError } from './utils/httpError.js';

const app = express();

const allowedOrigins = process.env.CLIENT_ORIGIN
  ? process.env.CLIENT_ORIGIN.split(',').map((origin) => origin.trim()).filter(Boolean)
  : ['*'];

const corsOptions = allowedOrigins.includes('*')
  ? { origin: true, credentials: true }
  : { origin: allowedOrigins, credentials: true };

app.set('trust proxy', 1);
app.use(helmet());
app.use(cors(corsOptions));
app.use(
  rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
  })
);
app.use(
  pinoHttp({
    logger,
    customProps: () => ({
      service: 'quantora-ai',
    }),
  })
);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version,
  });
});

app.use('/api', marketRoutes);
app.use('/api/predict', aiRoutes);
app.use('/api/alerts', alertRoutes);

app.use((req, _res, next) => {
  next(new HttpError(404, 'Route not found'));
});

app.use((err, req, res, _next) => {
  const status = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  if (status >= 500) {
    logger.error({ err, path: req.path }, 'Unhandled error');
  } else {
    logger.warn({ err, path: req.path }, 'Handled error');
  }
  res.status(status).json({
    error: message,
    meta: err.meta || undefined,
  });
});

export default app;
