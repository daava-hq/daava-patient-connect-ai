import { z } from 'zod';

const blockSchema = z.object({
  id: z.string().max(100).optional(),
  type: z.enum(['heading', 'paragraph', 'image', 'button', 'link', 'divider', 'spacer', 'footer', 'logo']),
  text: z.string().max(10000).optional(),
  url: z.string().max(2048).optional(),
  alt: z.string().max(500).optional(),
  level: z.enum(['h1', 'h2', 'h3']).optional(),
  alignment: z.enum(['left', 'center', 'right']).optional(),
  properties: z.object({
    text: z.string().max(10000).optional(),
    url: z.string().max(2048).optional(),
    alt: z.string().max(500).optional(),
    level: z.enum(['h1', 'h2', 'h3']).optional(),
    alignment: z.enum(['left', 'center', 'right']).optional(),
    color: z.string().optional(),
    backgroundColor: z.string().optional(),
    width: z.string().optional(),
    height: z.string().optional(),
  }).passthrough().optional(),
}).passthrough();

const sectionSchema = z.object({
  id: z.string().max(100).optional(),
  blocks: z.array(blockSchema).max(40),
}).passthrough();

const documentSchema = z.object({
  subject: z.string().trim().min(1).max(255),
  preheader: z.string().max(255).optional(),
  sections: z.array(sectionSchema).max(10).optional(),
  blocks: z.array(blockSchema).max(40).optional(),
}).passthrough();

export type NewsletterBlock = z.infer<typeof blockSchema>;
export type NewsletterDocument = z.infer<typeof documentSchema>;

export interface NewsletterVariables {
  [key: string]: string;
}

export interface RenderedNewsletter {
  html: string;
  text: string;
  subject: string;
}

interface NewsletterBlockProperties {
  text?: string;
  url?: string;
  alt?: string;
  level?: 'h1' | 'h2' | 'h3';
  alignment?: 'left' | 'center' | 'right';
  color?: string;
}

const variablePattern = /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g;
const allowedVariables = new Set([
  'patient.firstName',
  'patient.lastName',
  'patient.fullName',
  'patient.email',
  'patient.phone',
  'practice.name',
  'practice.phone',
  'practice.email',
  'practice.address',
  'practice.website',
  'campaign.name',
]);

export function parseNewsletterDocument(value: unknown): NewsletterDocument {
  const parsed = documentSchema.parse(value);
  const sections = parsed.sections?.length
    ? parsed.sections
    : parsed.blocks?.length
      ? [{ blocks: parsed.blocks }]
      : [];
  const normalizedSections = sections.map((section, sectionIndex) => ({
    ...section,
    blocks: section.blocks.map((block, blockIndex) => ({
      ...block,
      id: block.id ?? `section-${sectionIndex + 1}-block-${blockIndex + 1}`,
    })),
  }));
  const blocks = normalizedSections.flatMap((section) => section.blocks);

  if (blocks.length === 0) {
    throw new Error('Add at least one content block to the newsletter');
  }

  const documentVariables = extractVariables(JSON.stringify(parsed));
  const unsupportedDocumentVariable = documentVariables.find((key) => !allowedVariables.has(key));
  if (unsupportedDocumentVariable) {
    throw new Error(`Unsupported newsletter variable: ${unsupportedDocumentVariable}`);
  }

  for (const block of blocks) {
    const properties = getBlockProperties(block);
    const url = properties.url;
    if (url && !containsOnlySupportedVariables(url)) {
      throw new Error('Newsletter links and images may only use supported template variables');
    }
    if (url && !safeUrl(url, block.type === 'image' || block.type === 'logo')) {
      throw new Error(block.type === 'image' || block.type === 'logo'
        ? 'Image URLs must use HTTPS'
        : 'Newsletter links must use HTTPS or a supported contact link');
    }

    for (const value of [properties.text, properties.url, properties.alt]) {
      if (value) {
        const unknown = extractVariables(value).filter((key) => !allowedVariables.has(key));
        if (unknown.length) throw new Error(`Unsupported newsletter variable: ${unknown[0]}`);
      }
    }
  }

  return { ...parsed, sections: normalizedSections };
}

export function renderNewsletterDocument(
  input: unknown,
  variables: NewsletterVariables = {},
): RenderedNewsletter {
  const document = parseNewsletterDocument(input);
  const subject = replaceVariables(document.subject, variables);
  const textBlocks: string[] = [];
  const sectionHtml = (document.sections ?? []).map((section) => {
    const blockHtml = section.blocks.map((block) => {
      const properties = getBlockProperties(block);
      const text = properties.text ?? '';
      const renderedText = replaceVariables(text, variables);
      const styleColor = safeColor(properties.color);
      const alignment = properties.alignment ?? 'left';
      const escapedText = escapeHtml(renderedText);

      switch (block.type) {
        case 'heading': {
          textBlocks.push(renderedText);
          const tag = properties.level ?? 'h2';
          return `<${tag} style="margin:0 0 16px;text-align:${alignment};color:${styleColor};font-size:${tag === 'h1' ? '28px' : '22px'};line-height:1.3">${escapedText}</${tag}>`;
        }
        case 'paragraph':
        case 'footer': {
          if (renderedText) textBlocks.push(renderedText);
          const isFooter = block.type === 'footer';
          return `<p style="margin:0 0 16px;text-align:${alignment};color:${isFooter ? '#64748b' : styleColor};font-size:${isFooter ? '13px' : '16px'};line-height:1.6;white-space:pre-wrap">${escapedText}</p>`;
        }
        case 'image':
        case 'logo': {
          const url = safeUrl(replaceVariables(properties.url ?? '', variables), true);
          if (!url) return '';
          const alt = escapeHtml(replaceVariables(properties.alt ?? '', variables));
          return `<div style="margin:16px 0;text-align:${alignment}"><img src="${escapeHtml(url)}" alt="${alt}" style="display:inline-block;width:100%;max-width:${block.type === 'logo' ? '180px' : '560px'};height:auto;border:0" /></div>`;
        }
        case 'button':
        case 'link': {
          const url = safeUrl(replaceVariables(properties.url ?? '', variables), false);
          if (!url || !renderedText) return '';
          textBlocks.push(`${renderedText}: ${url}`);
          return `<div style="margin:20px 0;text-align:${alignment}"><a href="${escapeHtml(url)}" style="display:inline-block;padding:12px 20px;background:#2563eb;border-radius:6px;color:#ffffff;text-decoration:none;font-weight:600">${escapedText}</a></div>`;
        }
        case 'divider':
          return '<hr style="border:0;border-top:1px solid #dbe3ec;margin:20px 0" />';
        case 'spacer':
          return '<div style="height:20px;line-height:20px">&nbsp;</div>';
      }
    }).join('');

    return `<section style="padding:24px;background:#ffffff">${blockHtml}</section>`;
  }).join('');

  const preheader = document.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden">${escapeHtml(replaceVariables(document.preheader, variables))}</div>`
    : '';
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:16px;background:#f1f5f9;font-family:Arial,sans-serif;color:#1e293b">${preheader}<main style="max-width:600px;margin:0 auto;background:#ffffff">${sectionHtml}</main></body></html>`;

  return {
    html,
    text: textBlocks.join('\n\n'),
    subject: subject.replace(/[\r\n]/g, ' ').trim(),
  };
}

export function replaceNewsletterVariables(value: string, variables: NewsletterVariables): string {
  return replaceVariables(value, variables);
}

export function interpolateNewsletterHtml(value: string, variables: NewsletterVariables): string {
  const withSafeUrls = value.replace(/\b(href|src)="([^"]*)"/g, (_match, attribute: string, encodedUrl: string) => {
    const rawUrl = decodeHtml(encodedUrl);
    const interpolated = replaceVariables(rawUrl, variables);
    const safe = safeUrl(interpolated, attribute === 'src');
    return safe ? `${attribute}="${escapeHtml(safe)}"` : '';
  });

  return withSafeUrls.replace(variablePattern, (_match, key: string) =>
    escapeHtml(variables[key] ?? '')
  );
}

export function extractNewsletterVariables(value: unknown): string[] {
  const serialized = JSON.stringify(value);
  return Array.from(new Set(extractVariables(serialized)));
}

function extractVariables(value: string): string[] {
  const matches = Array.from(value.matchAll(variablePattern), (match) => match[1]);
  return matches;
}

function containsOnlySupportedVariables(value: string): boolean {
  return extractVariables(value).every((key) => allowedVariables.has(key));
}

function replaceVariables(value: string, variables: NewsletterVariables): string {
  return value.replace(variablePattern, (match, key: string) => {
    if (!(key in variables)) return match;
    const replacement = variables[key];
    return key === 'practice.website' ? safeUrl(replacement, false) ?? '' : replacement;
  });
}

function safeUrl(value: string, image: boolean): string | null {
  const hasVariables = extractVariables(value).length > 0;
  const candidate = value.replace(variablePattern, (_match, key: string) =>
    allowedVariables.has(key) ? 'https://preview.invalid' : ''
  );
  try {
    const url = new URL(candidate);
    if (url.protocol !== 'https:' && (!(!image && url.protocol === 'mailto:'))) return null;
    if (url.username || url.password) return null;
    return hasVariables ? value : url.toString();
  } catch {
    return null;
  }
}

function safeColor(value: string | undefined): string {
  return value && /^#[0-9a-f]{6}$/i.test(value) ? value : '#1e293b';
}

function getBlockProperties(block: NewsletterBlock): NewsletterBlockProperties {
  if (block.properties) return block.properties;
  return {
    text: block.text,
    url: block.url,
    alt: block.alt,
    level: block.level,
    alignment: block.alignment,
  };
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character] ?? character);
}

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}
