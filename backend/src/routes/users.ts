import { Router, Request, Response } from 'express';
import { UserModel } from '../models/UserModel.js';

const router = Router();

// GET /api/users - Get all users
router.get('/', async (req: Request, res: Response) => {
  try {
    const users = await UserModel.getAll();
    res.json(users);
  } catch (error: any) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch users' });
  }
});

// GET /api/users/:username - Get user by username
router.get('/:username', async (req: Request, res: Response) => {
  try {
    const user = await UserModel.getByUsername(req.params.username);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error: any) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch user' });
  }
});

// POST /api/users - Create new user
router.post('/', async (req: Request, res: Response) => {
  try {
    const user = await UserModel.create(req.body);
    res.status(201).json(user);
  } catch (error: any) {
    console.error('Error creating user:', error);
    res.status(500).json({ error: error.message || 'Failed to create user' });
  }
});

// PUT /api/users/:username - Update user
router.put('/:username', async (req: Request, res: Response) => {
  try {
    const user = await UserModel.update(req.params.username, req.body);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error: any) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: error.message || 'Failed to update user' });
  }
});

// DELETE /api/users/:username - Delete user
router.delete('/:username', async (req: Request, res: Response) => {
  try {
    const deleted = await UserModel.delete(req.params.username);
    if (!deleted) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.status(204).send();
  } catch (error: any) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: error.message || 'Failed to delete user' });
  }
});

export default router;

