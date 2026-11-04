const sampleDataEnvironments = new Set(['local', 'dev']);

export function assertSampleDataEnvironment(environment) {
  if (!sampleDataEnvironments.has(environment)) {
    throw new Error(
      `Sample data can only be seeded when APP_ENVIRONMENT is "local" or "dev" (received ${environment || 'unset'}).`
    );
  }
}
