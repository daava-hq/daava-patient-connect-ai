import { describe, expect, it } from 'vitest';
import { assertSampleDataEnvironment } from './sample-data-environment.mjs';

describe('sample data environment guard', () => {
  it.each(['local', 'dev'])('allows %s', (environment) => {
    expect(() => assertSampleDataEnvironment(environment)).not.toThrow();
  });

  it.each(['stage', 'production', 'test', undefined])('rejects %s', (environment) => {
    expect(() => assertSampleDataEnvironment(environment)).toThrow(/only be seeded/);
  });
});
