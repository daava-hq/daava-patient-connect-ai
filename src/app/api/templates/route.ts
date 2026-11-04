import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { requirePracticeMembership } from '@/lib/auth/guards';
import { listTemplates, createTemplate, getTemplateCategories } from '@/lib/templates/template-service';
import { AppError } from '@/lib/errors';
import { z } from 'zod';

const createSchema = z.object({
  practiceId: z.string().uuid(),
  categoryId: z.string().uuid(),
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  templateType: z.enum(['sms', 'email', 'newsletter', 'survey', 'internal_response']),
  channel: z.enum(['sms', 'email', 'in_app']),
  content: z.record(z.any()).default({}),
  variables: z.array(z.string()).default([]),
  status: z.enum(['draft', 'published', 'archived']).default('draft'),
}).superRefine((data, context) => {
  if (data.channel === 'email' &&
      (typeof data.content.subject !== 'string' || !data.content.subject.trim())) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['content', 'subject'],
      message: 'Email subject is required',
    });
  }
});

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const practiceId = searchParams.get('practiceId');
    if (!practiceId) return NextResponse.json({ error: 'practiceId is required' }, { status: 400 });

    await requirePracticeMembership(session.user.id, practiceId);

    const categoryId = searchParams.get('categoryId') || undefined;
    const type = searchParams.get('type') || undefined;
    const channel = searchParams.get('channel') || undefined;

    const cats = await getTemplateCategories();
    const items = await listTemplates(practiceId, { categoryId, type, channel });

    return NextResponse.json({ data: { categories: cats, templates: items } });
  } catch (err) {
    if (err instanceof AppError) return NextResponse.json({ error: err.message }, { status: err.statusCode });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation error', details: parsed.error.flatten() }, { status: 400 });
    }

    const { practiceId, ...rest } = parsed.data;
    await requirePracticeMembership(session.user.id, practiceId);

    const template = await createTemplate({
      practiceId,
      ...rest,
      isSystem: false,
      createdBy: session.user.id,
    });

    return NextResponse.json({ data: template }, { status: 201 });
  } catch (err) {
    if (err instanceof AppError) return NextResponse.json({ error: err.message }, { status: err.statusCode });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
