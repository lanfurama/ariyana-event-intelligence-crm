import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import usersRouter from './routes/users.js';
import emailTemplatesRouter from './routes/emailTemplates.js';
import leadsRouter from './routes/leads.js';
import emailLogsRouter from './routes/emailLogs.js';
import { query } from './config/database.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    await query('SELECT 1');
    res.json({ status: 'ok', database: 'connected' });
  } catch (error) {
    res.status(500).json({ status: 'error', database: 'disconnected' });
  }
});

// API Routes
app.use('/api/users', usersRouter);
app.use('/api/email-templates', emailTemplatesRouter);
app.use('/api/leads', leadsRouter);
app.use('/api/email-logs', emailLogsRouter);

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
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`📚 API docs: http://localhost:${PORT}/`);
});

export default app;

