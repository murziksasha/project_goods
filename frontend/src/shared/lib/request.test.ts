import { describe, expect, it } from 'vitest';
import { ApiRequestError } from '../api/http';
import {
  isAuthExpiredError,
  isNetworkRequestError,
  isUnauthorizedRequestError,
} from './request';

describe('request error helpers', () => {
  it('treats only 401 as an expired session', () => {
    expect(
      isAuthExpiredError(new ApiRequestError('gone', { status: 401 })),
    ).toBe(true);
    expect(
      isAuthExpiredError(new ApiRequestError('forbidden', { status: 403 })),
    ).toBe(false);
    expect(
      isUnauthorizedRequestError(
        new ApiRequestError('forbidden', { status: 403 }),
      ),
    ).toBe(true);
  });

  it('detects aborted requests as network errors', () => {
    expect(
      isNetworkRequestError(
        new ApiRequestError('timeout', {
          code: 'ECONNABORTED',
          hasResponse: false,
        }),
      ),
    ).toBe(true);
  });
});
