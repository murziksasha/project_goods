import { Router } from 'express';
import { subscribeDomainEvents } from '../shared/lib/domain-events';

export const eventsRouter = Router();

eventsRouter.get('/events/stream', (req, res) => {
  req.socket.setTimeout(0);
  res.setTimeout(0);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  let closed = false;
  let unsubscribe = () => {};

  const close = () => {
    if (closed) return;
    closed = true;
    clearInterval(heartbeat);
    unsubscribe();
    if (!res.writableEnded) {
      res.end();
    }
  };

  const write = (chunk: string) => {
    if (closed) return;
    try {
      res.write(chunk);
    } catch {
      close();
    }
  };

  const heartbeat = setInterval(() => {
    write(': ping\n\n');
  }, 25000);

  write(': connected\n\n');

  unsubscribe = subscribeDomainEvents((event) => {
    write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
  });

  req.on('close', close);
  req.on('aborted', close);
  res.on('error', close);
});
