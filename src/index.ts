import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import { ENV } from './config/env';
import connectDB from './db/db';
import redis from './config/redis';
import router from './routes/routes';
import { globalRateLimiter } from './middlewares/rateLimiter';
import { initSocket } from './socket/index';
import { startCallSweeper } from './jobs/staleCallSweeper';
import { errorResponse } from './types';

const app = express();
const server = http.createServer(app);

// ─── Middleware ───────────────────────────────────────────────────────────────

app.use(helmet());

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-razorpay-signature'],
  credentials: true,
}));

// Raw body for Razorpay webhook (must come before json parser)
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logger
app.use((req: Request, _res: Response, next: NextFunction) => {
  if (ENV.NODE_ENV !== 'production') {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  }
  next();
});

app.use(globalRateLimiter);

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api', router);

app.get('/', (_req: Request, res: Response) => {
  res.json({ name: 'CompanionCall API', version: '1.0.0', status: 'online' });
});

// ─── 404 Handler ─────────────────────────────────────────────────────────────
app.use((_req: Request, res: Response) => {
  res.status(404).json(errorResponse('NOT_FOUND', 'Endpoint not found'));
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json(errorResponse('SERVER_ERROR', 'Internal server error'));
});

// ─── Start Server ────────────────────────────────────────────────────────────
const PORT = parseInt(ENV.PORT);

const start = async () => {
  try {
    // Connect DB & Redis
    await connectDB();
    await redis.connect().catch(() => {}); // ioredis connects lazily, this is fine

    // Initialize Socket.io
    initSocket(server);

    // Server-authoritative billing safety net: auto-settle stale/over-long active calls.
    startCallSweeper();

    server.listen(PORT, () => {
      console.log(`\n🚀 CompanionCall API running on http://localhost:${PORT}`);
      console.log(`📡 Socket.io ready`);
      console.log(`🌍 Environment: ${ENV.NODE_ENV}\n`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

start();

export default app;
