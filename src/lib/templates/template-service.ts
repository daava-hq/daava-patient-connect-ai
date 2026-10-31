import 'server-only';
import { db } from '@/db';
import {
  templates,
  templateVersions,
  templateCategories,
  templateFavorites,
  templateUsageHistory,
  Template,
  NewTemplate,
  TemplateCategory,
} from '@/db/schema/templates';
import { eq, and, or, isNull, desc } from 'drizzle-orm';
import { NotFoundError, AppError } from '@/lib/errors';
import { validateTemplateVariables } from './variable-registry';

export async function getTemplateCategories(): Promise<TemplateCategory[]> {
  return db.select().from(templateCategories).orderBy(templateCategories.sortOrder);
}

export async function listTemplates(
  practiceId: string,
  options: { categoryId?: string; type?: string; channel?: string; isSystem?: boolean; search?: string } = {}
) {
  const conditions = [
    or(eq(templates.practiceId, practiceId), eq(templates.isSystem, true)),
    isNull(templates.deletedAt),
  ];

  if (options.categoryId) conditions.push(eq(templates.categoryId, options.categoryId));
  if (options.type) conditions.push(eq(templates.templateType, options.type as any));
  if (options.channel) conditions.push(eq(templates.channel, options.channel as any));
  if (options.isSystem !== undefined) conditions.push(eq(templates.isSystem, options.isSystem));

  return db
    .select()
    .from(templates)
    .where(and(...conditions))
    .orderBy(desc(templates.updatedAt));
}

export async function getTemplateById(practiceId: string, templateId: string): Promise<Template | null> {
  const [template] = await db
    .select()
    .from(templates)
    .where(
      and(
        eq(templates.id, templateId),
        or(eq(templates.practiceId, practiceId), eq(templates.isSystem, true)),
        isNull(templates.deletedAt)
      )
    )
    .limit(1);
  return template ?? null;
}

export async function createTemplate(data: NewTemplate): Promise<Template> {
  const [created] = await db.insert(templates).values(data).returning();
  await db.insert(templateVersions).values({
    templateId: created.id,
    version: created.version,
    content: created.content,
    updatedBy: created.createdBy,
  });
  return created;
}

export async function updateTemplate(
  practiceId: string,
  templateId: string,
  data: Partial<NewTemplate>,
  userId?: string
): Promise<Template> {
  const existing = await getTemplateById(practiceId, templateId);
  if (!existing) throw new NotFoundError('Template not found');
  if (existing.isSystem) {
    throw new AppError(403, 'System templates cannot be modified directly. Please clone the template.', 'SYSTEM_TEMPLATE_LOCKED');
  }

  const newVersion = existing.version + 1;
  const [updated] = await db
    .update(templates)
    .set({
      ...data,
      version: newVersion,
      updatedAt: new Date(),
    })
    .where(and(eq(templates.id, templateId), eq(templates.practiceId, practiceId)))
    .returning();

  if (data.content) {
    await db.insert(templateVersions).values({
      templateId,
      version: newVersion,
      content: data.content,
      updatedBy: userId ?? null,
    });
  }

  return updated;
}

export async function cloneTemplate(practiceId: string, templateId: string, userId?: string): Promise<Template> {
  const source = await getTemplateById(practiceId, templateId);
  if (!source) throw new NotFoundError('Source template not found');

  const [cloned] = await db
    .insert(templates)
    .values({
      practiceId,
      categoryId: source.categoryId,
      name: `${source.name} (Copy)`,
      description: source.description,
      templateType: source.templateType,
      channel: source.channel,
      content: source.content,
      variables: source.variables,
      status: 'draft',
      isSystem: false,
      version: 1,
      createdBy: userId ?? null,
    })
    .returning();

  await db.insert(templateVersions).values({
    templateId: cloned.id,
    version: 1,
    content: cloned.content,
    updatedBy: userId ?? null,
  });

  return cloned;
}

export async function archiveTemplate(practiceId: string, templateId: string): Promise<void> {
  const existing = await getTemplateById(practiceId, templateId);
  if (!existing) throw new NotFoundError('Template not found');
  if (existing.isSystem) throw new AppError(403, 'System templates cannot be archived.', 'SYSTEM_TEMPLATE_LOCKED');

  await db
    .update(templates)
    .set({ status: 'archived', deletedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(templates.id, templateId), eq(templates.practiceId, practiceId)));
}

export async function renderTemplate(
  practiceId: string,
  templateId: string,
  contextVariables: Record<string, string>
): Promise<{ renderedContent: any; isValid: boolean; unresolved: string[] }> {
  const template = await getTemplateById(practiceId, templateId);
  if (!template) throw new NotFoundError('Template not found');

  const contentStr = JSON.stringify(template.content);
  const allowedVars = (template.variables as string[]) || [];

  const validation = validateTemplateVariables(contentStr, allowedVars);

  // Render content by replacing variables
  let renderedStr = contentStr;
  for (const [key, val] of Object.entries(contextVariables)) {
    renderedStr = renderedStr.replace(new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g'), val);
  }

  return {
    renderedContent: JSON.parse(renderedStr),
    isValid: validation.isValid,
    unresolved: validation.unresolved,
  };
}
