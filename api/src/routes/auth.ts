import type { Request, Response } from 'express';
import express from 'express';
import bcrypt from 'bcryptjs';
import { UserModel } from '../models/UserModel.js';
import { requireAuth, signToken } from '../middleware/auth.js';

const router = express.Router();

// POST /api/auth/login - exchange username+password for a JWT
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;
    if (!username || typeof username !== 'string' || !password || typeof password !== 'string') {
      return res.status(400).json({ error: 'username and password are required' });
    }

    const record = await UserModel.getAuthByUsername(username.trim());
    if (!record || !record.password_hash) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }
    const matches = await bcrypt.compare(password, record.password_hash);
    if (!matches) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const token = signToken({ username: record.username, name: record.name, role: record.role });
    res.json({
      token,
      user: {
        username: record.username,
        name: record.name,
        role: record.role,
        avatar: record.avatar,
      },
    });
  } catch (error: any) {
    console.error('Error logging in:', error);
    res.status(500).json({ error: error.message || 'Failed to log in' });
  }
});

// GET /api/auth/me - fresh profile for the token's user (session restore validation)
router.get('/me', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = await UserModel.getByUsername(req.user!.username);
    if (!user) {
      return res.status(401).json({ error: 'User no longer exists' });
    }
    res.json(user);
  } catch (error: any) {
    console.error('Error fetching current user:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch current user' });
  }
});

// POST /api/auth/change-password - authenticated self-service password change
router.post('/change-password', requireAuth, async (req: Request, res: Response) => {
  try {
    const { current_password, new_password } = req.body;
    if (!current_password || typeof current_password !== 'string') {
      return res.status(400).json({ error: 'current_password is required' });
    }
    if (!new_password || typeof new_password !== 'string' || new_password.length < 8) {
      return res.status(400).json({ error: 'new_password must be at least 8 characters' });
    }

    const record = await UserModel.getAuthByUsername(req.user!.username);
    if (!record || !record.password_hash) {
      return res.status(401).json({ error: 'User no longer exists' });
    }
    const matches = await bcrypt.compare(current_password, record.password_hash);
    if (!matches) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const hash = await bcrypt.hash(new_password, 10);
    await UserModel.setPassword(req.user!.username, hash);
    res.json({ success: true, message: 'Password updated' });
  } catch (error: any) {
    console.error('Error changing password:', error);
    res.status(500).json({ error: error.message || 'Failed to change password' });
  }
});

export default router;
