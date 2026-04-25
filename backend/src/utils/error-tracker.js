import { logger } from './logger.js';

export function captureException(error, context = {}) {
  logger.error('captured_exception', {
    name: error.name,
    message: error.message,
    stack: error.stack,
    ...context
  });
}
