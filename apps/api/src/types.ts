import type { PrismaClient, User } from '@prisma/client';
import type { FastifyRequest } from 'fastify';
import type { AppConfig } from './config.js';

export type AppContext = {
  prisma: PrismaClient;
  config: AppConfig;
};

export type AuthenticatedRequest = FastifyRequest & {
  user: User;
  isAdmin: boolean;
};

