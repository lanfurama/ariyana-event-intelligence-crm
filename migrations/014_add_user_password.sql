-- Migration: Auth - add password_hash to users (smart venue booking Phase 3)
-- Created: 2026-07-17
-- Seeds every existing user with the DEFAULT password 'Ariyana@2026' (bcrypt cost 10).
-- CHANGE IT after first login via Profile -> Change password.

ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(100);

UPDATE users SET password_hash = '$2b$10$edw7FAPYkopsekPrvQetWu6zG/fvl/f6LzDcmpgY0E29Ya3AHx2fq' WHERE password_hash IS NULL;
