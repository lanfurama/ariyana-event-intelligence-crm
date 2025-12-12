import { query } from '../config/database.js';
import { ChatMessage } from '../types/index.js';

export class ChatMessageModel {
  // Get all messages for a specific user
  static async getByUsername(username: string): Promise<ChatMessage[]> {
    const result = await query(
      'SELECT * FROM chat_messages WHERE username = $1 ORDER BY timestamp ASC',
      [username]
    );
    return result.rows.map(row => ({
      ...row,
      // Normalize 'model' to 'assistant' for frontend (GPT standard)
      role: row.role === 'model' ? 'assistant' : row.role,
      timestamp: new Date(row.timestamp),
    }));
  }

  // Get a single message by id
  static async getById(id: string): Promise<ChatMessage | null> {
    const result = await query('SELECT * FROM chat_messages WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return null;
    }
    const row = result.rows[0];
    return {
      ...row,
      // Normalize 'model' to 'assistant' for frontend (GPT standard)
      role: row.role === 'model' ? 'assistant' : row.role,
      timestamp: new Date(row.timestamp),
    };
  }

  // Create a new chat message
  static async create(message: Omit<ChatMessage, 'created_at'>): Promise<ChatMessage> {
    // Normalize 'assistant' to 'model' for database storage (backward compatibility)
    const dbRole = message.role === 'assistant' ? 'model' : message.role;
    
    const result = await query(
      `INSERT INTO chat_messages (id, username, role, text, timestamp)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [message.id, message.username, dbRole, message.text, message.timestamp]
    );
    const row = result.rows[0];
    return {
      ...row,
      // Normalize 'model' to 'assistant' for frontend (GPT standard)
      role: row.role === 'model' ? 'assistant' : row.role,
      timestamp: new Date(row.timestamp),
    };
  }

  // Delete all messages for a user (useful for clearing chat history)
  static async deleteByUsername(username: string): Promise<void> {
    await query('DELETE FROM chat_messages WHERE username = $1', [username]);
  }

  // Delete a single message
  static async deleteById(id: string): Promise<void> {
    await query('DELETE FROM chat_messages WHERE id = $1', [id]);
  }
}
