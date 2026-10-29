import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { db } from '@/db';
import { organisations } from '@/db/schema/organisations';
import { practices } from '@/db/schema/practices';
import { users } from '@/db/schema/users';
import { practiceMembers } from '@/db/schema/practice_members';
import { eq } from 'drizzle-orm';
import { decodeOrgToken } from '@/lib/auth/register-token';

const bodySchema = z.object({
  orgToken: z.string().min(1),
  practiceName: z.string().min(2).max(120).trim(),
  practicePhone: z.string().max(30).trim().optional(),
  practiceAddress: z.string().max(255).trim().optional(),
  timezone: z.string().max(60).default('UTC'),
  adminName: z.string().min(2).max(100).trim(),
  adminEmail: z.string().email().toLowerCase(),
  adminPassword: z.string().min(8).max(128),
});

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function uniqueSlug(base: string): Promise<string> {
  let candidate = base;
  let suffix = 2;
  while (true) {
    const existing = await db
      .select({ id: practices.id })
      .from(practices)
      .where(eq(practices.slug, candidate))
      .limit(1);
    if (existing.length === 0) return candidate;
    candidate = `${base}-${suffix++}`;
  }
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
      { status: 422 },
    );
  }

  const {
    orgToken,
    practiceName,
    practicePhone,
    practiceAddress,
    timezone,
    adminName,
    adminEmail,
    adminPassword,
  } = parsed.data;

  // Decode and verify the org token
  let orgId: string;
  try {
    ({ orgId } = decodeOrgToken(orgToken));
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid token';
    return NextResponse.json({ error: `Invalid organisation token: ${message}` }, { status: 403 });
  }

  // Verify the organisation exists
  const [org] = await db
    .select({ id: organisations.id, name: organisations.name })
    .from(organisations)
    .where(eq(organisations.id, orgId))
    .limit(1);

  if (!org) {
    return NextResponse.json({ error: 'Organisation not found' }, { status: 404 });
  }

  // Check email uniqueness
  const [existingUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, adminEmail))
    .limit(1);

  if (existingUser) {
    return NextResponse.json({ error: 'An account with this email already exists.' }, { status: 409 });
  }

  const slug = await uniqueSlug(slugify(practiceName));
  const hashedPassword = await bcrypt.hash(adminPassword, 12);

  // Create practice + user + membership in a transaction
  try {
    const result = await db.transaction(async (tx) => {
      const [practice] = await tx
        .insert(practices)
        .values({
          organisationId: orgId,
          name: practiceName,
          slug,
          phone: practicePhone ?? null,
          address: practiceAddress ?? null,
          timezone,
        })
        .returning({ id: practices.id, name: practices.name, slug: practices.slug });

      const [user] = await tx
        .insert(users)
        .values({
          email: adminEmail,
          hashedPassword,
          name: adminName,
          role: 'admin',
        })
        .returning({ id: users.id });

      await tx.insert(practiceMembers).values({
        practiceId: practice.id,
        userId: user.id,
        role: 'owner',
      });

      return { practiceId: practice.id, practiceSlug: practice.slug };
    });

    return NextResponse.json(
      { message: 'Practice created successfully.', ...result },
      { status: 201 },
    );
  } catch (err) {
    console.error('[register] transaction error', err);
    return NextResponse.json({ error: 'Failed to create practice. Please try again.' }, { status: 500 });
  }
}
