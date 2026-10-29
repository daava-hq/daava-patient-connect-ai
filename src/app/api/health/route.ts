import { NextResponse } from 'next/server';
import { db } from '@/db';
import { sql } from 'drizzle-orm';
import { logError } from '@/lib/logger';

export async function GET() {
  try {
    await db.execute(sql`SELECT 1`);
    return NextResponse.json({ status: 'healthy', timestamp: new Date().toISOString() }, { status: 200 });
  } catch (error) {
    logError('Health check failed', error);
    return NextResponse.json({ status: 'unhealthy', error: 'Database connection failed' }, { status: 500 });
  }
}
