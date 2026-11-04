import { describe, expect, it } from 'vitest';
import { parseAppEnvironment } from './env';

describe('parseAppEnvironment', () => {
  it.each(['local', 'dev', 'stage', 'production'] as const)('accepts %s', (environment) => {
    expect(parseAppEnvironment(environment)).toBe(environment);
  });

  it('defaults to local when not configured', () => {
    expect(parseAppEnvironment(undefined)).toBe('local');
  });

  it('rejects unsupported environment names', () => {
    expect(() => parseAppEnvironment('staging')).toThrow();
  });
});
