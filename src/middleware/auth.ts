import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Interface for decoded JWT token
interface DecodedToken {
  aud: string;
  exp: number;
  sub: string;
  email?: string;
  role?: string;
  [key: string]: any;
}

// Extend Express Request interface to include user property
declare global {
  namespace Express {
    interface Request {
      user?: DecodedToken;
    }
  }
}

/**
 * Middleware to verify JWT token from Supabase
 */
export const authenticateJWT = (req: Request, res: Response, next: NextFunction) => {
  // Get the authorization header
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ error: 'Authorization header is required' });
  }

  // Check if the header is in the correct format
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return res.status(401).json({ error: 'Authorization header format must be "Bearer {token}"' });
  }

  const token = parts[1];

  try {
    // Verify the token using the JWT secret from environment variables
    const jwtSecret = process.env.JWT_SECRET;
    
    if (!jwtSecret) {
      console.error('JWT_SECRET is not defined in environment variables');
      return res.status(500).json({ error: 'Internal server error' });
    }

    // Verify the token
    const decoded = jwt.verify(token, jwtSecret) as DecodedToken;
    
    // Attach the decoded user to the request object
    req.user = decoded;
    
    // Continue to the next middleware or route handler
    next();
  } catch (error) {
    console.error('JWT verification error:', error);
    
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ error: 'Token expired' });
    }
    
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    return res.status(401).json({ error: 'Unauthorized' });
  }
};
