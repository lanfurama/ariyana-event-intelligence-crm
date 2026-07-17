import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config/env.js';
import type { UserRole } from '../types/index.js';

export interface AuthTokenPayload {
  username: string;
  name: string;
  role: UserRole;
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthTokenPayload;
  }
}

const TOKEN_TTL = '7d';

export function signToken(payload: AuthTokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_TTL });
}

/** Rejects requests without a valid Bearer token; attaches req.user on success. */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload & AuthTokenPayload;
    req.user = { username: payload.username, name: payload.name, role: payload.role };
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Viewer role is read-only across the entire API — with one exception:
 * updating their own profile (usersWritePolicy still strips the role field).
 */
export function viewerReadOnly(req: Request, res: Response, next: NextFunction) {
  if (!SAFE_METHODS.has(req.method) && req.user?.role === 'Viewer') {
    const isSelfProfileUpdate =
      req.method === 'PUT' && decodeURIComponent(req.path) === `/users/${req.user.username}`;
    if (!isSelfProfileUpdate) {
      return res.status(403).json({ error: 'Viewer role is read-only' });
    }
  }
  next();
}

export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: `Requires role: ${roles.join(' or ')}` });
    }
    next();
  };
}

/**
 * users router policy: anyone authenticated reads; a user may PUT their own
 * profile (but not their role); create/delete/other-user updates are
 * Director-only.
 */
export function usersWritePolicy(req: Request, res: Response, next: NextFunction) {
  if (SAFE_METHODS.has(req.method)) return next();
  if (req.user?.role === 'Director') return next();
  const target = decodeURIComponent(req.path.split('/')[1] || '');
  if (req.method === 'PUT' && req.user && target === req.user.username) {
    if (req.body && typeof req.body === 'object') {
      delete req.body.role; // self-update must not escalate the role
    }
    return next();
  }
  return res.status(403).json({ error: 'Only a Director can manage users' });
}
