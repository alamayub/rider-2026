import { randomUUID } from 'crypto';

export function requestContext(req, res, next) {
  req.requestId = randomUUID();
  res.setHeader('x-request-id', req.requestId);
  next();
}
