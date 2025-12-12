# Ariyana CRM Backend API

Backend API server for Ariyana Event Intelligence CRM built with Node.js, Express, TypeScript, and PostgreSQL.

## Features

- RESTful API endpoints for:
  - **Users**: Manage system users (Director, Sales, Viewer)
  - **Email Templates**: Manage email templates for lead communication
  - **Leads**: Full CRUD operations for lead management
  - **Email Logs**: Track email communication history
  - **Email Attachments**: Manage email attachments

- Database connection pooling
- TypeScript for type safety
- CORS enabled for frontend integration
- Health check endpoint

## Prerequisites

- Node.js 18+ 
- PostgreSQL 12+
- npm or yarn

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment variables:**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` with your database credentials:
   ```env
   DATABASE_URL=postgresql://username:password@localhost:5432/ariyana_crm
   # OR use individual settings:
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=ariyana_crm
   DB_USER=your_username
   DB_PASSWORD=your_password
   
   PORT=3001
   CORS_ORIGIN=http://localhost:5173
   ```

3. **Create database:**
   Make sure PostgreSQL is running and create the database:
   ```sql
   CREATE DATABASE ariyana_crm;
   ```

4. **Run database schema:**
   ```bash
   psql -U your_username -d ariyana_crm -f ../database_schema.sql
   ```

## Running

**Development mode (with hot reload):**
```bash
npm run dev
```

**Build for production:**
```bash
npm run build
npm start
```

The API will be available at `http://localhost:3001`

## API Endpoints

### Health Check
- `GET /health` - Check API and database status

### Users
- `GET /api/users` - Get all users
- `GET /api/users/:username` - Get user by username
- `POST /api/users` - Create new user
- `PUT /api/users/:username` - Update user
- `DELETE /api/users/:username` - Delete user

### Email Templates
- `GET /api/email-templates` - Get all email templates
- `GET /api/email-templates/:id` - Get template by id
- `POST /api/email-templates` - Create new template
- `PUT /api/email-templates/:id` - Update template
- `DELETE /api/email-templates/:id` - Delete template

### Leads
- `GET /api/leads` - Get all leads (with optional filters: `?status=New&industry=Finance&country=Malaysia&search=keyword`)
- `GET /api/leads/stats` - Get lead statistics
- `GET /api/leads/with-email-count` - Get leads with email count
- `GET /api/leads/:id` - Get lead by id
- `POST /api/leads` - Create new lead
- `PUT /api/leads/:id` - Update lead
- `DELETE /api/leads/:id` - Delete lead

### Email Logs
- `GET /api/email-logs` - Get all email logs (optional: `?leadId=1`)
- `GET /api/email-logs/:id` - Get email log by id
- `POST /api/email-logs` - Create new email log
- `PUT /api/email-logs/:id` - Update email log
- `DELETE /api/email-logs/:id` - Delete email log
- `GET /api/email-logs/:id/attachments` - Get attachments for email log
- `POST /api/email-logs/:id/attachments` - Create attachment
- `DELETE /api/email-logs/attachments/:attachmentId` - Delete attachment

## Example Requests

### Create a Lead
```bash
curl -X POST http://localhost:3001/api/leads \
  -H "Content-Type: application/json" \
  -d '{
    "id": "12",
    "company_name": "Test Company",
    "industry": "Technology",
    "country": "Singapore",
    "city": "Singapore",
    "key_person_name": "John Doe",
    "status": "New"
  }'
```

### Get Leads with Filters
```bash
curl "http://localhost:3001/api/leads?status=New&industry=Finance"
```

### Get Lead Statistics
```bash
curl http://localhost:3001/api/leads/stats
```

## Project Structure

```
backend/
├── src/
│   ├── config/
│   │   └── database.ts       # Database connection
│   ├── models/
│   │   ├── UserModel.ts
│   │   ├── EmailTemplateModel.ts
│   │   ├── LeadModel.ts
│   │   └── EmailLogModel.ts
│   ├── routes/
│   │   ├── users.ts
│   │   ├── emailTemplates.ts
│   │   ├── leads.ts
│   │   └── emailLogs.ts
│   ├── types/
│   │   └── index.ts          # TypeScript types
│   └── server.ts              # Express app entry point
├── .env.example
├── package.json
├── tsconfig.json
└── README.md
```

## Development

- Uses `tsx` for development with hot reload
- TypeScript strict mode enabled
- ES modules (ESM) format

## License

ISC

