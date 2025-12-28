import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import usersRouter from './routes/users.js';
import emailTemplatesRouter from './routes/emailTemplates.js';
import leadsRouter from './routes/leads.js';
import emailLogsRouter from './routes/emailLogs.js';
import emailRepliesRouter from './routes/emailReplies.js';
import chatMessagesRouter from './routes/chatMessages.js';
import geminiRouter from './routes/gemini.js';
import excelImportRouter from './routes/excelImport.js';
import eventBriefRouter from './routes/eventBrief.js';
import { query } from './config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from project root (2 levels up from api/src)
dotenv.config({ path: resolve(__dirname, '../../.env') });

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);

// Middleware
// CORS configuration - allow all origins in development for easier debugging
const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'http://localhost:5173',
      'http://localhost:3000',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:3000',
      process.env.CORS_ORIGIN
    ].filter(Boolean);
    
    if (process.env.NODE_ENV === 'development' || allowedOrigins.includes(origin)) {
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

// Simple test endpoint (no database required)
app.get('/test', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'API server is running',
    timestamp: new Date().toISOString()
  });
});

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

// API Routes
app.use('/api/users', usersRouter);
app.use('/api/email-templates', emailTemplatesRouter);
app.use('/api/leads', leadsRouter);
app.use('/api/email-logs', emailLogsRouter);
app.use('/api/email-replies', emailRepliesRouter);
app.use('/api/chat-messages', chatMessagesRouter);
app.use('/api/gemini', geminiRouter);
app.use('/api/excel-import', excelImportRouter);
app.use('/api/event-brief', eventBriefRouter);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Ariyana Event Intelligence CRM API',
    version: '1.0.0',
    endpoints: {
      users: '/api/users',
      emailTemplates: '/api/email-templates',
      leads: '/api/leads',
      emailLogs: '/api/email-logs',
      emailReplies: '/api/email-replies',
      chatMessages: '/api/chat-messages',
      gemini: '/api/gemini',
      excelImport: '/api/excel-import',
      health: '/health',
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

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`📚 API docs: http://localhost:${PORT}/`);
  console.log(`🌐 CORS enabled for: ${process.env.CORS_ORIGIN || 'http://localhost:5173'}`);
  console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
});

export default app;

