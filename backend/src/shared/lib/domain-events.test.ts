import { describe, expect, it } from 'vitest';
import { publishDomainEvent, subscribeDomainEvents } from './domain-events';

describe('domain events', () => {
  it('delivers published events to subscribers', () => {
    const received: string[] = [];
    const unsubscribe = subscribeDomainEvents((event) => {
      received.push(event.path);
    });

    publishDomainEvent({ type: 'resource.changed', method: 'POST', path: '/api/sales' });
    unsubscribe();
    publishDomainEvent({ type: 'resource.changed', method: 'POST', path: '/api/ignored' });

    expect(received).toEqual(['/api/sales']);
  });
});
