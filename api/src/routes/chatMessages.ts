import { Router, Request, Response } from 'express';
import { ChatMessageModel } from '../models/ChatMessageModel.js';

const router = Router();

// GET /api/chat-messages/:username - Get all messages for a user
router.get('/:username', async (req: Request, res: Response) => {
  try {
    const { username } = req.params;
    console.log('📥 Fetching chat messages for user:', username);
    const messages = await ChatMessageModel.getByUsername(username);
    console.log('✅ Found', messages.length, 'messages for user', username);
    res.json(messages);
  } catch (error: any) {
    console.error('❌ Error fetching chat messages:', error);
    console.error('Error stack:', error.stack);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      detail: error.detail,
    });
    res.status(500).json({ error: error.message || 'Failed to fetch chat messages' });
  }
});

// POST /api/chat-messages - Create a new chat message
router.post('/', async (req: Request, res: Response) => {
  try {
    const { id, username, role, text, timestamp } = req.body;
    
    console.log('📨 Received chat message request:', { id, username, role, textLength: text?.length, timestamp });
    
    if (!id || !username || !role || !text) {
      console.error('❌ Missing required fields:', { id: !!id, username: !!username, role: !!role, text: !!text });
      return res.status(400).json({ error: 'Missing required fields: id, username, role, text' });
    }

    if (role !== 'user' && role !== 'model') {
      console.error('❌ Invalid role:', role);
      return res.status(400).json({ error: 'Role must be either "user" or "model"' });
    }

    // Convert timestamp to Date if it's a string
    const timestampDate = timestamp ? (typeof timestamp === 'string' ? new Date(timestamp) : timestamp) : new Date();
    
    console.log('💾 Creating chat message in database...');
    const message = await ChatMessageModel.create({
      id,
      username,
      role,
      text,
      timestamp: timestampDate,
    });
    
    console.log('✅ Chat message created successfully:', message.id);
    res.status(201).json(message);
  } catch (error: any) {
    console.error('❌ Error creating chat message:', error);
    console.error('Error stack:', error.stack);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      detail: error.detail,
      constraint: error.constraint,
    });
    res.status(500).json({ error: error.message || 'Failed to create chat message' });
  }
});

// DELETE /api/chat-messages/:username - Delete all messages for a user
router.delete('/:username', async (req: Request, res: Response) => {
  try {
    const { username } = req.params;
    await ChatMessageModel.deleteByUsername(username);
    res.status(204).send();
  } catch (error: any) {
    console.error('Error deleting chat messages:', error);
    res.status(500).json({ error: error.message || 'Failed to delete chat messages' });
  }
});

// DELETE /api/chat-messages/message/:id - Delete a single message
router.delete('/message/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await ChatMessageModel.deleteById(id);
    res.status(204).send();
  } catch (error: any) {
    console.error('Error deleting chat message:', error);
    res.status(500).json({ error: error.message || 'Failed to delete chat message' });
  }
});

export default router;
