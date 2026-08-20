import { EventEmitter } from 'node:events';

export type DomainEvent = {
  type: string;
  method: string;
  path: string;
  at: string;
};

const emitter = new EventEmitter();
emitter.setMaxListeners(100);

export const publishDomainEvent = (event: Omit<DomainEvent, 'at'>) => {
  const payload: DomainEvent = {
    ...event,
    at: new Date().toISOString(),
  };
  emitter.emit('event', payload);
};

export const subscribeDomainEvents = (listener: (event: DomainEvent) => void) => {
  emitter.on('event', listener);
  return () => {
    emitter.off('event', listener);
  };
};
