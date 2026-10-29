import { AppError } from '@/lib/errors';

export class OpenDentalError extends AppError {
  constructor(statusCode: number, message: string, public responseBody?: unknown) {
    super(statusCode, message, 'OPEN_DENTAL_ERROR');
    this.name = 'OpenDentalError';
  }
}

export class OpenDentalAuthError extends OpenDentalError {
  constructor(message = 'Open Dental authentication failed (check DeveloperKey and CustomerKey)') {
    super(401, message);
    this.name = 'OpenDentalAuthError';
  }
}

export class OpenDentalRateLimitError extends OpenDentalError {
  constructor(public retryAfterSeconds: number = 5, message = 'Open Dental rate limit exceeded') {
    super(429, message);
    this.name = 'OpenDentalRateLimitError';
  }
}
