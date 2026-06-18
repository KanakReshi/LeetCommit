import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler';
import authRoutes from './routes/auth.routes';
import submissionRoutes from './routes/submissions.routes';
import snapshotRoutes from './routes/snapshots.routes';
import analyticsRoutes from './routes/analytics.routes';

const app: Application = express();

// Security middlewares
app.use(helmet());

// Log every incoming request so we can see traffic in the terminal
app.use((req: Request, _res: Response, next: NextFunction) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} | origin: ${req.headers.origin ?? 'none'}`);
  next();
});

app.use(cors({
  // Browser extensions use moz-extension:// or chrome-extension:// origins which
  // can't be predicted ahead of time, so allow all origins.
  // This backend only listens on localhost so there's no external exposure.
  origin: true,
  credentials: true,
}));

// Parse JSON bodies
app.use(express.json({ limit: '1mb' }));

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/submissions', submissionRoutes);
app.use('/api/snapshots', snapshotRoutes);
app.use('/api/analytics', analyticsRoutes);

// 404 & Error Handling
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
