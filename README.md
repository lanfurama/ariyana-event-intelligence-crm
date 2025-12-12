<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1Yfs1wMDaCWebViQbPgpx_rw6r7R_H7b9

## Run Locally

**Prerequisites:**  Node.js and PostgreSQL

### Setup Steps:

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment variables:**
   ```bash
   cp env.example .env
   ```
   
   Edit `.env` file với API keys và database credentials của bạn:
   ```env
   # Database Configuration
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=ariyana_crm
   DB_USER=your_username
   DB_PASSWORD=your_password
   
   # API Keys (BACKEND ONLY - never expose to frontend)
   GEMINI_API_KEY=your_gemini_api_key_here
   OPENAI_API_KEY=your_openai_api_key_here
   ```
   
   ⚠️ **IMPORTANT:** Never commit `.env` file to Git! It's already in `.gitignore`.

3. **Create database:**
   ```sql
   CREATE DATABASE ariyana_crm;
   ```

4. **Run the app:**
   ```bash
   npm run dev
   ```

### Security Notes:

- ✅ All API keys are stored in `.env` file (not committed to Git)
- ✅ Backend API routes use environment variables only
- ✅ Frontend calls backend APIs, never directly uses API keys
- ✅ Database credentials are in `.env` file only
- ✅ See [SECURITY_CHECK.md](SECURITY_CHECK.md) for detailed security audit
