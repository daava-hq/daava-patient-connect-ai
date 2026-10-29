import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { requirePracticeMembership, requirePracticeAdmin } from '@/lib/auth/guards';
import { db } from '@/db';
import { practices } from '@/db/schema/practices';
import { organisations } from '@/db/schema/organisations';
import { practiceOpendentalCredentials } from '@/db/schema/practice_credentials';
import { users } from '@/db/schema/users';
import { eq, and, ne } from 'drizzle-orm';
import { z } from 'zod';
import { AppError } from '@/lib/errors';
import { encrypt, decrypt } from '@/lib/opendental/crypto';

const updateSchema = z.object({
  name: z.string().min(2).max(120).trim().optional(),
  slug: z.string().min(2).max(120).trim().regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens').optional(),
  phone: z.string().max(30).trim().optional().nullable(),
  address: z.string().max(255).trim().optional().nullable(),
  timezone: z.string().max(60).trim().optional(),
  logoUrl: z.string().max(500).trim().optional().nullable(),
  openDental: z.object({
    developerKey: z.string().trim().optional(),
    customerKey: z.string().trim().optional(),
  }).optional(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const practiceId = params.id;
    const membership = await requirePracticeMembership(session.user.id, practiceId);

    const [practice] = await db
      .select({
        id: practices.id,
        name: practices.name,
        slug: practices.slug,
        phone: practices.phone,
        address: practices.address,
        logoUrl: practices.logoUrl,
        timezone: practices.timezone,
        createdAt: practices.createdAt,
        updatedAt: practices.updatedAt,
        organisationId: practices.organisationId,
        organisationName: organisations.name,
      })
      .from(practices)
      .innerJoin(organisations, eq(practices.organisationId, organisations.id))
      .where(eq(practices.id, practiceId))
      .limit(1);

    if (!practice) {
      return NextResponse.json({ error: 'Practice not found' }, { status: 404 });
    }

    const [creds] = await db
      .select({
        id: practiceOpendentalCredentials.id,
        developerKeyEnc: practiceOpendentalCredentials.developerKeyEnc,
        customerKeyEnc: practiceOpendentalCredentials.customerKeyEnc,
        lastPatientSyncedAt: practiceOpendentalCredentials.lastPatientSyncedAt,
        lastApptSyncedAt: practiceOpendentalCredentials.lastApptSyncedAt,
      })
      .from(practiceOpendentalCredentials)
      .where(eq(practiceOpendentalCredentials.practiceId, practiceId))
      .limit(1);

    let devKeyHint = '';
    let custKeyHint = '';
    if (creds) {
      try {
        const decryptedDev = decrypt(creds.developerKeyEnc);
        devKeyHint = decryptedDev.length > 4 ? `••••••••${decryptedDev.slice(-4)}` : '••••••••';
        const decryptedCust = decrypt(creds.customerKeyEnc);
        custKeyHint = decryptedCust.length > 4 ? `••••••••${decryptedCust.slice(-4)}` : '••••••••';
      } catch {
        devKeyHint = '••••••••';
        custKeyHint = '••••••••';
      }
    }

    return NextResponse.json(
      {
        data: {
          ...practice,
          userRole: membership.role,
          credentials: {
            configured: Boolean(creds),
            developerKeyHint: devKeyHint,
            customerKeyHint: custKeyHint,
            lastPatientSyncedAt: creds?.lastPatientSyncedAt ?? null,
            lastApptSyncedAt: creds?.lastApptSyncedAt ?? null,
          },
        },
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    if (err instanceof AppError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    const error = err instanceof Error ? err : new Error(String(err));
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const practiceId = params.id;
    const membership = await requirePracticeAdmin(session.user.id, practiceId);

    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parsed = updateSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 422 }
      );
    }

    const data = parsed.data;

    // If Open Dental keys provided, check if user is practice owner or global system admin
    if (data.openDental) {
      const isOwner = membership.role === 'owner';
      const [user] = await db
        .select({ role: users.role })
        .from(users)
        .where(eq(users.id, session.user.id))
        .limit(1);
      const isGlobalAdmin = user?.role === 'admin';

      if (!isOwner && !isGlobalAdmin) {
        return NextResponse.json(
          { error: 'Only the practice owner has permission to update Open Dental integration credentials.' },
          { status: 403 }
        );
      }
    }

    // Check slug collision if slug is being updated
    if (data.slug) {
      const [existingSlug] = await db
        .select({ id: practices.id })
        .from(practices)
        .where(and(eq(practices.slug, data.slug), ne(practices.id, practiceId)))
        .limit(1);

      if (existingSlug) {
        return NextResponse.json({ error: 'This practice slug is already in use' }, { status: 409 });
      }
    }

    // Update practice details
    const updates: Record<string, unknown> = {
      updatedAt: new Date(),
    };
    if (data.name !== undefined) updates.name = data.name;
    if (data.slug !== undefined) updates.slug = data.slug;
    if (data.phone !== undefined) updates.phone = data.phone;
    if (data.address !== undefined) updates.address = data.address;
    if (data.timezone !== undefined) updates.timezone = data.timezone;
    if (data.logoUrl !== undefined) updates.logoUrl = data.logoUrl;

    const [updatedPractice] = await db
      .update(practices)
      .set(updates)
      .where(eq(practices.id, practiceId))
      .returning();

    // If Open Dental keys provided, encrypt and update/insert
    if (data.openDental) {
      const { developerKey, customerKey } = data.openDental;
      if (developerKey && customerKey) {
        const devEnc = encrypt(developerKey);
        const custEnc = encrypt(customerKey);

        const [existingCreds] = await db
          .select({ id: practiceOpendentalCredentials.id })
          .from(practiceOpendentalCredentials)
          .where(eq(practiceOpendentalCredentials.practiceId, practiceId))
          .limit(1);

        if (existingCreds) {
          await db
            .update(practiceOpendentalCredentials)
            .set({
              developerKeyEnc: devEnc,
              customerKeyEnc: custEnc,
              updatedAt: new Date(),
            })
            .where(eq(practiceOpendentalCredentials.practiceId, practiceId));
        } else {
          await db.insert(practiceOpendentalCredentials).values({
            practiceId,
            developerKeyEnc: devEnc,
            customerKeyEnc: custEnc,
          });
        }
      }
    }

    return NextResponse.json(
      { message: 'Practice settings updated successfully', data: updatedPractice },
      { status: 200 }
    );
  } catch (err: unknown) {
    if (err instanceof AppError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    const error = err instanceof Error ? err : new Error(String(err));
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
