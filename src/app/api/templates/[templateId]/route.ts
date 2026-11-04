import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { requirePracticeMembership } from '@/lib/auth/guards';
import { getTemplateById, updateTemplate, archiveTemplate } from '@/lib/templates/template-service';
import { AppError } from '@/lib/errors';
import { z } from 'zod';

const updateSchema = z.object({
  practiceId: z.string().uuid(),
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  templateType: z.enum(['sms', 'email', 'newsletter', 'survey', 'internal_response']).optional(),
  channel: z.enum(['sms', 'email', 'in_app']).optional(),
  content: z.record(z.any()).optional(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
}).superRefine((data, context) => {
  if (data.channel === 'email' && data.content &&
      (typeof data.content.subject !== 'string' || !data.content.subject.trim())) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['content', 'subject'],
      message: 'Email subject is required',
    });
  }
});

export async function GET(req: NextRequest, { params }: { params: { templateId: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const practiceId = new URL(req.url).searchParams.get('practiceId');
    if (!practiceId) return NextResponse.json({ error: 'practiceId is required' }, { status: 400 });

    await requirePracticeMembership(session.user.id, practiceId);

    const template = await getTemplateById(practiceId, params.templateId);
    if (!template) return NextResponse.json({ error: 'Template not found' }, { status: 404 });

    return NextResponse.json({ data: template });
  } catch (err) {
    if (err instanceof AppError) return NextResponse.json({ error: err.message }, { status: err.statusCode });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { templateId: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation error', details: parsed.error.flatten() }, { status: 400 });
    }

    const { practiceId, ...rest } = parsed.data;
    await requirePracticeMembership(session.user.id, practiceId);

    const existing = await getTemplateById(practiceId, params.templateId);
    if (!existing) return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    const nextChannel = rest.channel ?? existing.channel;
    const nextContent = rest.content ?? existing.content;
    const nextSubject = typeof nextContent === 'object' && nextContent !== null &&
      !Array.isArray(nextContent) && 'subject' in nextContent
      ? nextContent.subject
      : undefined;
    if (nextChannel === 'email' &&
        (typeof nextSubject !== 'string' || !nextSubject.trim())) {
      return NextResponse.json({ error: 'Email subject is required' }, { status: 400 });
    }

    const updated = await updateTemplate(practiceId, params.templateId, rest, session.user.id);
    return NextResponse.json({ data: updated });
  } catch (err) {
    if (err instanceof AppError) return NextResponse.json({ error: err.message }, { status: err.statusCode });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { templateId: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const practiceId = new URL(req.url).searchParams.get('practiceId');
    if (!practiceId) return NextResponse.json({ error: 'practiceId is required' }, { status: 400 });

    await requirePracticeMembership(session.user.id, practiceId);
    await archiveTemplate(practiceId, params.templateId);

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof AppError) return NextResponse.json({ error: err.message }, { status: err.statusCode });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
