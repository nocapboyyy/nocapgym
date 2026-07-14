import { Prisma } from '@prisma/client';

export type ApplicationErrorCode =
  | 'AUTH_REQUIRED'
  | 'INVALID_TELEGRAM_AUTH'
  | 'TELEGRAM_AUTH_EXPIRED'
  | 'FORBIDDEN'
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'BAD_REQUEST'
  | 'INTERNAL_ERROR';

export class ApplicationError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: ApplicationErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'ApplicationError';
  }
}

export function unauthorized(code: 'AUTH_REQUIRED' | 'INVALID_TELEGRAM_AUTH' | 'TELEGRAM_AUTH_EXPIRED', message: string) {
  return new ApplicationError(401, code, message);
}

export function forbidden(message = 'Недостаточно прав') {
  return new ApplicationError(403, 'FORBIDDEN', message);
}

export function notFound(message = 'Ресурс не найден') {
  return new ApplicationError(404, 'NOT_FOUND', message);
}

export function conflict(message = 'Конфликт данных') {
  return new ApplicationError(409, 'CONFLICT', message);
}

export function mapPrismaError(error: unknown) {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return null;

  if (error.code === 'P2002' || error.code === 'P2003') {
    return conflict();
  }
  if (error.code === 'P2025') {
    return notFound();
  }
  return null;
}

export function isPrismaErrorCode(error: unknown, code: string) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}
