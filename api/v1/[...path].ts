import { VercelRequest, VercelResponse } from '@vercel/node';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
// Import from src - Vercel will bundle these files automatically
import usersRouter from '../src/routes/users.js';
import emailTemplatesRouter from '../src/routes/emailTemplates.js';
import leadsRouter from '../src/routes/leads.js';
import emailLogsRouter from '../src/routes/emailLogs.js';
import emailRepliesRouter from '../src/routes/emailReplies.js';
import chatMessagesRouter from '../src/routes/chatMessages.js';
import geminiRouter from '../src/routes/gemini.js';
import gptRouter from '../src/routes/gpt.js';
import excelImportRouter from '../src/routes/excelImport.js';
import csvImportRouter from '../src/routes/csvImport.js';
import eventBriefRouter from '../src/routes/eventBrief.js';
import leadScoringRouter from '../src/routes/leadScoring.js';
import emailReportsRouter from '../src/routes/emailReports.js';
import { query } from '../src/config/database.js';

// Load environment variables for Vercel
dotenv.config();

const app = express();

// CORS configuration - allow all origins in production (same domain)
const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Allow requests with no origin (like server-side requests)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'http://localhost:5173',
      'http://localhost:3000',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:3000',
      process.env.CORS_ORIGIN,
      process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined,
      process.env.VERCEL ? `https://${process.env.VERCEL_URL}` : undefined,
    ].filter(Boolean);
    
    // In production, allow same-origin requests
    if (process.env.NODE_ENV === 'production' || process.env.VERCEL) {
      callback(null, true);
    } else if (process.env.NODE_ENV === 'development' || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    await query('SELECT 1');
    res.json({ status: 'ok', database: 'connected' });
  } catch (error) {
    console.error('Database health check failed:', error);
    res.status(500).json({ 
      status: 'error', 
      database: 'disconnected',
      message: 'Database connection failed but API is running'
    });
  }
});

// API Routes - paths are relative to /api/v1
app.use('/users', usersRouter);
app.use('/email-templates', emailTemplatesRouter);
app.use('/leads', leadsRouter);
app.use('/email-logs', emailLogsRouter);
app.use('/email-replies', emailRepliesRouter);
app.use('/chat-messages', chatMessagesRouter);
app.use('/gemini', geminiRouter);
app.use('/gpt', gptRouter);
app.use('/excel-import', excelImportRouter);
app.use('/csv-import', csvImportRouter);
app.use('/event-brief', eventBriefRouter);
app.use('/lead-scoring', leadScoringRouter);
app.use('/email-reports', emailReportsRouter);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Ariyana Event Intelligence CRM API',
    version: '1.0.0',
    endpoints: {
      users: '/api/v1/users',
      emailTemplates: '/api/v1/email-templates',
      leads: '/api/v1/leads',
      emailLogs: '/api/v1/email-logs',
      emailReplies: '/api/v1/email-replies',
      chatMessages: '/api/v1/chat-messages',
      gemini: '/api/v1/gemini',
      excelImport: '/api/v1/excel-import',
      eventBrief: '/api/v1/event-brief',
      leadScoring: '/api/v1/lead-scoring',
      emailReports: '/api/v1/email-reports',
      health: '/api/v1/health',
    },
  });
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

export default (req: VercelRequest, res: VercelResponse) => {
  return app(req, res);
};
