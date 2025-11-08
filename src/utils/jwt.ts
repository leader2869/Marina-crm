import jwt, { SignOptions } from 'jsonwebtoken';
import { config } from '../config/env';
import { JwtPayload } from '../types';

export const generateToken = (payload: JwtPayload): string => {
  const secret = config.jwt.secret;
  if (!secret) {
    throw new Error('JWT secret is not configured');
  }

  return jwt.sign(payload, secret, {
    expiresIn: config.jwt.expiresIn,
  } as SignOptions);
};

export const verifyToken = (token: string): JwtPayload => {
  try {
    const secret = config.jwt.secret;
    if (!secret) {
      throw new Error('JWT secret is not configured');
    }
    return jwt.verify(token, secret) as JwtPayload;
  } catch (error) {
    throw new Error('Invalid token');
  }
};


