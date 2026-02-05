import type { Plugin } from 'vite';
import type { Connect } from 'vite/dist/node';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath, pathToFileURL } from 'url';
import { dirname, resolve } from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Get project root - vite-plugin-api.ts is at project root
// If loaded from node_modules/.vite-temp/, we need to go up to project root
// Also handle case where it's in node_modules/.vite-temp/ folder itself
let projectRoot = __dirname;
if (__dirname.includes('node_modules/.vite-temp')) {
  // Go up from node_modules/.vite-temp/ to project root
  projectRoot = resolve(__dirname, '../../..');
} else if (__dirname.includes('.vite-temp')) {
  // Handle .vite-temp directly
  projectRoot = resolve(__dirname, '../..');
}

console.log('📁 vite-plugin-api __dirname:', __dirname);
console.log('📁 Project root resolved to:', projectRoot);

// Load .env from project root
dotenv.config({ path: resolve(projectRoot, '.env') });

// Lazy load routes only when plugin is actually used (in dev server)
// This prevents build-time resolution errors on Vercel
let usersRouter: any;
let emailTemplatesRouter: any;
let leadsRouter: any;
let emailLogsRouter: any;
let emailRepliesRouter: any;
let chatMessagesRouter: any;
let geminiRouter: any;
let gptRouter: any;
let excelImportRouter: any;
let csvImportRouter: any;
let eventBriefRouter: any;
let leadScoringRouter: any;
let emailReportsRouter: any;
let vertexRouter: any;
let query: any;

async function loadRoutes() {
  if (!usersRouter) {
    console.log('📦 Loading routes from project root:', projectRoot);

    try {
      // Register tsx ESM loader to handle TypeScript files
      // This allows Node.js to import .ts files in ESM context
      try {
        const { register } = await import('tsx/esm/api');
        register();
        console.log('✅ tsx ESM loader registered');
      } catch (e: any) {
        console.log('⚠️ tsx ESM loader registration failed:', e.message);
        console.log('   Will try alternative import methods');
      }

      // Use relative paths from project root with .js extension
      // TypeScript convention: import .ts files as .js
      // Vite/tsx will resolve .js to .ts files
      const routePaths = [
        './api/src/routes/users.js',
        './api/src/routes/emailTemplates.js',
        './api/src/routes/leads.js',
        './api/src/routes/emailLogs.js',
        './api/src/routes/emailReplies.js',
        './api/src/routes/chatMessages.js',
        './api/src/routes/gemini.js',
        './api/src/routes/gpt.js',
        './api/src/routes/excelImport.js',
        './api/src/routes/csvImport.js',
        './api/src/routes/eventBrief.js',
        './api/src/routes/leadScoring.js',
        './api/src/routes/emailReports.js',
        './api/src/routes/vertex.js',
        './api/src/config/database.js',
      ];

      console.log('  → Importing routes with relative paths from:', projectRoot);

      const routes = await Promise.all(
        routePaths.map(async (relPath) => {
          try {
            // Use relative path - Vite/tsx should resolve from project root
            // Need to use absolute path converted to file:// URL
            const absPath = resolve(projectRoot, relPath);
            const fileUrl = pathToFileURL(absPath).href;
            console.log('    Importing:', relPath);
            return await import(/* @vite-ignore */ fileUrl);
          } catch (importError: any) {
            console.error('    ❌ Failed to import:', relPath, importError.message);
            throw importError;
          }
        })
      );

      usersRouter = routes[0].default;
      emailTemplatesRouter = routes[1].default;
      leadsRouter = routes[2].default;
      emailLogsRouter = routes[3].default;
      emailRepliesRouter = routes[4].default;
      chatMessagesRouter = routes[5].default;
      geminiRouter = routes[6].default;
      gptRouter = routes[7].default;
      excelImportRouter = routes[8].default;
      csvImportRouter = routes[9].default;
      eventBriefRouter = routes[10].default;
      leadScoringRouter = routes[11].default;
      emailReportsRouter = routes[12].default;
      vertexRouter = routes[13].default;
      query = routes[14].query;

      console.log('✅ Routes loaded successfully');
    } catch (error: any) {
      console.error('❌ Failed to load routes:', error.message);
      console.error('   Full error:', error);
      throw error;
    }
  }
}

export function vitePluginApi(): Plugin {
  let app: express.Application;

  return {
    name: 'vite-plugin-api',
    async configureServer(server) {
      // Load routes asynchronously (only when dev server starts)
      await loadRoutes();

      // Create Express app
      app = express();

      // CORS configuration
      const corsOptions = {
        origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
          if (!origin) return callback(null, true);
          const allowedOrigins = [
            'http://localhost:3000',
            'http://127.0.0.1:3000',
            process.env.CORS_ORIGIN,
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
      // Increase body size limit to 100MB for large video/image uploads
      app.use(express.json({ limit: '100mb' }));
      app.use(express.urlencoded({ extended: true, limit: '100mb' }));

      // Health check endpoint (relative to /api/v1)
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

      // API Routes - mount at root level (Vite middleware handles /api/v1 prefix)
      // Routes are relative to /api/v1, so mount them at root
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
      app.use('/vertex', vertexRouter);

      // Root endpoint (relative to /api/v1)
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
            leadScoring: '/api/v1/lead-scoring',
            emailReports: '/api/v1/email-reports',
            health: '/api/v1/health',
          },
        });
      });

      // Error handling middleware
      app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
        console.error('API Error:', err);
        res.status(err.status || 500).json({
          error: err.message || 'Internal server error',
        });
      });

      // 404 handler for API routes (catch all unmatched routes)
      app.use((req, res) => {
        res.status(404).json({ error: 'Route not found' });
      });

      // Add Express middleware to Vite dev server
      // Convert Express app to Connect-compatible middleware
      server.middlewares.use('/api/v1', (req, res, next) => {
        try {
          // Express app handles the request
          app(req as any, res as any, (err?: any) => {
            // Express stack is done
            if (err) {
              console.error('❌ API middleware error:', err);
              if (!res.headersSent) {
                res.statusCode = err.status || 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: err.message || 'Internal server error' }));
              }
            } else {
              // Express didn't handle it or passed through.
              // CRITICAL FIX: For API routes, we NEVER want to fall through to Vite's next()
              // because that typically leads to index.html (SPA fallback) which breaks JSON parsing.
              // Instead, we force a 404 JSON response.
              if (!res.headersSent) {
                res.statusCode = 404;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: 'Route not found' }));
              }
            }
          });
        } catch (error: any) {
          console.error('❌ Error in API middleware:', error);
          if (!res.headersSent) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Internal server error' }));
          }
        }
      });

      console.log('✅ API middleware integrated into Vite dev server');
      console.log('📡 API available at: http://localhost:3000/api/v1');
      console.log('🔍 Test endpoint: http://localhost:3000/api/v1/health');
    },
  };
}

