import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth/options';
import { requirePracticeMembership } from '@/lib/auth/guards';
import { createAnnouncementDraft } from '@/lib/campaigns/campaign-service';
import { getGroupAnnouncementTemplate, getGroupById } from '@/lib/groups/group-repository';
import { AppError, NotFoundError, ValidationError } from '@/lib/errors';
import { extractTemplateBody } from '@/lib/templates/document-schema';
import { parseNewsletterDocument, type NewsletterDocument } from '@/lib/newsletters/newsletter-content';

const requestSchema = z
  .object({
    practiceId: z.string().uuid(),
    name: z.string().trim().min(1).max(255),
    templateId: z.string().uuid(),
  })
  .strict();

export async function POST(req: NextRequest, { params }: { params: { groupId: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    let requestBody: unknown;
    try {
      requestBody = await req.json();
    } catch {
      return NextResponse.json({ error: 'Request body must be valid JSON' }, { status: 400 });
    }
    const parsed = requestSchema.safeParse(requestBody);
    const groupId = z.string().uuid().safeParse(params.groupId);
    if (!parsed.success || !groupId.success) {
      return NextResponse.json({ error: 'Validation error' }, { status: 400 });
    }

    await requirePracticeMembership(session.user.id, parsed.data.practiceId);
    const group = await getGroupById(parsed.data.practiceId, groupId.data);
    if (!group || group.archivedAt) throw new NotFoundError('Active group not found');
    const template = await getGroupAnnouncementTemplate(parsed.data.practiceId, parsed.data.templateId);
    const templateContent = z.object({
      subject: z.string().trim().min(1),
    }).passthrough().safeParse(template.content);
    if (!templateContent.success) {
      throw new ValidationError('The selected announcement template is missing its email subject');
    }
    const body = extractTemplateBody(templateContent.data);
    if (!body.trim()) {
      throw new ValidationError('The selected announcement template has no message content');
    }
    let content: NewsletterDocument;
    try {
      content = parseNewsletterDocument(templateContent.data);
    } catch (error) {
      throw new ValidationError(error instanceof Error ? error.message : 'The selected announcement template is invalid');
    }

    const campaign = await createAnnouncementDraft({
      practiceId: parsed.data.practiceId,
      name: parsed.data.name,
      groupId: group.id,
      template: {
        name: template.name,
        subject: templateContent.data.subject,
        body,
        content,
      },
    });
    return NextResponse.json({ data: campaign }, { status: 201 });
  } catch (err) {
    if (err instanceof AppError) return NextResponse.json({ error: err.message }, { status: err.statusCode });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
