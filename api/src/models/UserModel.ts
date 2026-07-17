import { query } from '../config/database.js';
import type { User } from '../types/index.js';

// password_hash must NEVER leave the API — every public-facing query selects
// the explicit safe column list; only getAuthByUsername reads the hash.
const SAFE_COLUMNS = 'username, name, role, avatar, created_at, updated_at';

export class UserModel {
  static async getAll(): Promise<User[]> {
    const result = await query(`SELECT ${SAFE_COLUMNS} FROM users ORDER BY created_at DESC`);
    return result.rows;
  }

  static async getByUsername(username: string): Promise<User | null> {
    const result = await query(`SELECT ${SAFE_COLUMNS} FROM users WHERE username = $1`, [username]);
    return result.rows[0] || null;
  }

  /** Auth-only lookup — includes password_hash. Do not expose the result over HTTP. */
  static async getAuthByUsername(
    username: string,
  ): Promise<(User & { password_hash: string | null }) | null> {
    const result = await query('SELECT * FROM users WHERE username = $1', [username]);
    return result.rows[0] || null;
  }

  static async setPassword(username: string, passwordHash: string): Promise<boolean> {
    const result = await query('UPDATE users SET password_hash = $1 WHERE username = $2', [
      passwordHash,
      username,
    ]);
    return (result.rowCount ?? 0) > 0;
  }

  static async create(user: User): Promise<User> {
    const result = await query(
      `INSERT INTO users (username, name, role, avatar)
       VALUES ($1, $2, $3, $4)
       RETURNING ${SAFE_COLUMNS}`,
      [user.username, user.name, user.role, user.avatar || null],
    );
    return result.rows[0];
  }

  static async update(username: string, user: Partial<User>): Promise<User | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (user.name !== undefined) {
      fields.push(`name = $${paramCount++}`);
      values.push(user.name);
    }
    if (user.role !== undefined) {
      fields.push(`role = $${paramCount++}`);
      values.push(user.role);
    }
    if (user.avatar !== undefined) {
      fields.push(`avatar = $${paramCount++}`);
      values.push(user.avatar);
    }

    if (fields.length === 0) {
      return this.getByUsername(username);
    }

    values.push(username);
    const result = await query(
      `UPDATE users SET ${fields.join(', ')} WHERE username = $${paramCount} RETURNING ${SAFE_COLUMNS}`,
      values,
    );
    return result.rows[0] || null;
  }

  static async delete(username: string): Promise<boolean> {
    const result = await query('DELETE FROM users WHERE username = $1', [username]);
    return (result.rowCount ?? 0) > 0;
  }
}
