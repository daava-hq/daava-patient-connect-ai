import 'server-only';
import { db } from '@/db';
import { messageTemplates, MessageTemplate, NewMessageTemplate } from '@/db/schema/message_templates';
import { eq, and, isNull } from 'drizzle-orm';
import { NotFoundError } from '@/lib/errors';

const VARIABLE_PATTERN = /\{\{(\w+)\}\}/g;

export async function getPracticeTemplates(practiceId: string, channel?: 'sms' | 'email') {
  const conditions = [eq(messageTemplates.practiceId, practiceId), isNull(messageTemplates.deletedAt)];
  if (channel) conditions.push(eq(messageTemplates.channel, channel));

  return db
    .select()
    .from(messageTemplates)
    .where(and(...conditions))
    .orderBy(messageTemplates.name);
}

export async function getTemplateById(practiceId: string, templateId: string): Promise<MessageTemplate | null> {
  const [template] = await db
    .select()
    .from(messageTemplates)
    .where(
      and(
        eq(messageTemplates.practiceId, practiceId),
        eq(messageTemplates.id, templateId),
        isNull(messageTemplates.deletedAt)
      )
    )
    .limit(1);
  return template ?? null;
}

export async function createTemplate(
  data: Pick<NewMessageTemplate, 'practiceId' | 'name' | 'channel' | 'subject' | 'body'>
): Promise<MessageTemplate> {
  const [template] = await db.insert(messageTemplates).values(data).returning();
  return template;
}

export async function updateTemplate(
  practiceId: string,
  templateId: string,
  data: Partial<Pick<NewMessageTemplate, 'name' | 'channel' | 'subject' | 'body'>>
): Promise<MessageTemplate> {
  const [updated] = await db
    .update(messageTemplates)
    .set({ ...data, updatedAt: new Date() })
    .where(
      and(
        eq(messageTemplates.practiceId, practiceId),
        eq(messageTemplates.id, templateId),
        isNull(messageTemplates.deletedAt)
      )
    )
    .returning();
  if (!updated) throw new NotFoundError('Template not found');
  return updated;
}

export async function softDeleteTemplate(practiceId: string, templateId: string): Promise<void> {
  const [updated] = await db
    .update(messageTemplates)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(messageTemplates.practiceId, practiceId),
        eq(messageTemplates.id, templateId),
        isNull(messageTemplates.deletedAt)
      )
    )
    .returning({ id: messageTemplates.id });
  if (!updated) throw new NotFoundError('Template not found');
}

/**
 * Interpolates {{variable}} placeholders in a template body.
 * Unknown variables are left as-is in production, or can be validated
 * by checking the returned missingVariables set.
 */
export function interpolateTemplate(
  body: string,
  variables: Record<string, string>
): { rendered: string; missingVariables: string[] } {
  const missing: string[] = [];
  const rendered = body.replace(VARIABLE_PATTERN, (_, key: string) => {
    if (key in variables) return variables[key];
    missing.push(key);
    return `{{${key}}}`;
  });
  return { rendered, missingVariables: missing };
}

/**
 * Returns the set of variable names used in a template body.
 */
export function extractTemplateVariables(body: string): string[] {
  const vars: string[] = [];
  let match: RegExpExecArray | null;
  const re = new RegExp(VARIABLE_PATTERN.source, 'g');
  while ((match = re.exec(body)) !== null) {
    if (!vars.includes(match[1])) vars.push(match[1]);
  }
  return vars;
}
