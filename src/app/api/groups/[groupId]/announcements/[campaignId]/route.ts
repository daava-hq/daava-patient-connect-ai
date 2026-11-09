import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth/options';
import { requirePracticeMembership } from '@/lib/auth/guards';
import { AppError, NotFoundError, ValidationError } from '@/lib/errors';
import {
  getGroupAnnouncementDetails,
  softDeleteCampaign,
  updateGroupAnnouncementDraft,
} from '@/lib/campaigns/campaign-service';
import { getCampaignStats } from '@/lib/campaigns/recipient-tracking';
import { getGroupAnnouncementTemplate, getGroupById } from '@/lib/groups/group-repository';
import { parseNewsletterDocument } from '@/lib/newsletters/newsletter-content';

const updateSchema = z.object({
  practiceId: z.string().uuid(),
  name: z.string().trim().min(1).max(255),
  templateId: z.string().uuid().optional(),
}).strict();

interface RouteParams {
  params: { groupId: string; campaignId: string };
}

function parseParams(params: RouteParams['params']) {
  const groupId = z.string().uuid().safeParse(params.groupId);
  const campaignId = z.string().uuid().safeParse(params.campaignId);
  return groupId.success && campaignId.success
    ? { groupId: groupId.data, campaignId: campaignId.data }
    : null;
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const routeParams = parseParams(params);
    const practiceId = req.nextUrl.searchParams.get('practiceId');
    if (!routeParams || !practiceId || !z.string().uuid().safeParse(practiceId).success) {
      return NextResponse.json({ error: 'Valid group, campaign, and practice IDs are required' }, { status: 400 });
    }

    await requirePracticeMembership(session.user.id, practiceId);
    const details = await getGroupAnnouncementDetails(practiceId, routeParams.groupId, routeParams.campaignId);
    if (!details) return NextResponse.json({ error: 'Group announcement not found' }, { status: 404 });
    const stats = await getCampaignStats(routeParams.campaignId);
    return NextResponse.json({ data: { ...details, stats } });
  } catch (error) {
    if (error instanceof AppError) return NextResponse.json({ error: error.message }, { status: error.statusCode });
    return NextResponse.json({ error: 'Unable to load group announcement' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const routeParams = parseParams(params);
    if (!routeParams) return NextResponse.json({ error: 'Valid group and campaign IDs are required' }, { status: 400 });

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Request body must be valid JSON' }, { status: 400 });
    }
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation error', details: parsed.error.flatten() }, { status: 400 });
    }

    const { practiceId, name, templateId } = parsed.data;
    await requirePracticeMembership(session.user.id, practiceId);
    const group = await getGroupById(practiceId, routeParams.groupId);
    if (!group || group.archivedAt) throw new NotFoundError('Active group not found');
    if (!await getGroupAnnouncementDetails(practiceId, routeParams.groupId, routeParams.campaignId)) {
      throw new NotFoundError('Group announcement not found');
    }

    let content: unknown;
    if (templateId) {
      const template = await getGroupAnnouncementTemplate(practiceId, templateId);
      try {
        content = parseNewsletterDocument(template.content);
      } catch (error) {
        throw new ValidationError(error instanceof Error ? error.message : 'The selected announcement template is invalid');
      }
    }

    const campaign = await updateGroupAnnouncementDraft({
      practiceId,
      groupId: routeParams.groupId,
      campaignId: routeParams.campaignId,
      name,
      content,
    });
    return NextResponse.json({ data: campaign });
  } catch (error) {
    if (error instanceof AppError) return NextResponse.json({ error: error.message }, { status: error.statusCode });
    return NextResponse.json({ error: 'Unable to save group announcement' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const routeParams = parseParams(params);
    const practiceId = req.nextUrl.searchParams.get('practiceId');
    if (!routeParams || !practiceId || !z.string().uuid().safeParse(practiceId).success) {
      return NextResponse.json({ error: 'Valid group, campaign, and practice IDs are required' }, { status: 400 });
    }

    await requirePracticeMembership(session.user.id, practiceId);
    if (!await getGroupAnnouncementDetails(practiceId, routeParams.groupId, routeParams.campaignId)) {
      throw new NotFoundError('Group announcement not found');
    }
    await softDeleteCampaign(practiceId, routeParams.campaignId);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AppError) return NextResponse.json({ error: error.message }, { status: error.statusCode });
    return NextResponse.json({ error: 'Unable to delete group announcement' }, { status: 500 });
  }
}
