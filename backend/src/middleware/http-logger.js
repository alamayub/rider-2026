import { logger } from '../utils/logger.js';

export function httpLogger(req, res, next) {
  const start = Date.now();

  res.on('finish', () => {
    logger.info('http_request', {
      requestId: req.requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      durationMs: Date.now() - start
    });
  });

  next();
}
