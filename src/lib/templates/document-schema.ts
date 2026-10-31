export type CanvasBlockType =
  | 'heading'
  | 'paragraph'
  | 'image'
  | 'button'
  | 'divider'
  | 'spacer'
  | 'footer'
  | 'two-column';

export interface CanvasBlock {
  id: string;
  type: CanvasBlockType;
  properties: {
    text?: string;
    level?: 'h1' | 'h2' | 'h3';
    fontSize?: string;
    color?: string;
    backgroundColor?: string;
    alignment?: 'left' | 'center' | 'right';
    url?: string;
    alt?: string;
    padding?: string;
    borderRadius?: string;
    height?: string;
    columns?: { leftText: string; rightText: string };
    [key: string]: any;
  };
}

export interface CanvasSection {
  id: string;
  backgroundColor?: string;
  padding?: string;
  blocks: CanvasBlock[];
}

export interface TemplateDocument {
  version: number;
  subject?: string;
  sections: CanvasSection[];
}

export function createDefaultDocument(templateType: string): TemplateDocument {
  if (templateType === 'sms' || templateType === 'internal_response') {
    return {
      version: 1,
      sections: [
        {
          id: 'section-1',
          blocks: [
            {
              id: 'block-1',
              type: 'paragraph',
              properties: { text: 'Hello {{patient.firstName}}, this is a message from {{practice.name}}.' },
            },
          ],
        },
      ],
    };
  }

  return {
    version: 1,
    subject: 'Update from {{practice.name}}',
    sections: [
      {
        id: 'section-1',
        backgroundColor: '#ffffff',
        padding: '20px',
        blocks: [
          {
            id: 'block-1',
            type: 'heading',
            properties: { text: 'Hello {{patient.firstName}}', level: 'h2', color: '#1e293b', alignment: 'left' },
          },
          {
            id: 'block-2',
            type: 'paragraph',
            properties: { text: 'Here is your update from {{practice.name}}. We look forward to seeing you soon.', color: '#475569' },
          },
          {
            id: 'block-3',
            type: 'button',
            properties: { text: 'View Details', url: '{{practice.website}}', backgroundColor: '#2563eb', color: '#ffffff', alignment: 'center' },
          },
        ],
      },
    ],
  };
}

export function renderDocumentToHtml(doc: TemplateDocument): string {
  let html = `<div style="font-family: sans-serif; color: #334155; max-width: 600px; margin: 0 auto; background: #f8fafc; padding: 20px;">`;
  
  if (doc.subject) {
    html += `<div style="font-size: 14px; color: #64748b; margin-bottom: 12px; font-weight: 500;">Subject: ${doc.subject}</div>`;
  }

  for (const sec of doc.sections) {
    html += `<div style="background: ${sec.backgroundColor || '#ffffff'}; padding: ${sec.padding || '20px'}; border-radius: 8px; margin-bottom: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">`;
    for (const b of sec.blocks) {
      if (b.type === 'heading') {
        const tag = b.properties.level || 'h2';
        html += `<${tag} style="color: ${b.properties.color || '#1e293b'}; text-align: ${b.properties.alignment || 'left'}; margin: 0 0 12px 0;">${b.properties.text || ''}</${tag}>`;
      } else if (b.type === 'paragraph') {
        html += `<p style="color: ${b.properties.color || '#475569'}; text-align: ${b.properties.alignment || 'left'}; line-height: 1.5; margin: 0 0 12px 0;">${b.properties.text || ''}</p>`;
      } else if (b.type === 'image') {
        html += `<div style="text-align: ${b.properties.alignment || 'center'}; margin: 12px 0;"><img src="${b.properties.url || ''}" alt="${b.properties.alt || ''}" style="max-width: 100%; border-radius: 6px;" /></div>`;
      } else if (b.type === 'button') {
        html += `<div style="text-align: ${b.properties.alignment || 'center'}; margin: 16px 0;"><a href="${b.properties.url || '#'}" style="background: ${b.properties.backgroundColor || '#2563eb'}; color: ${b.properties.color || '#ffffff'}; padding: 10px 20px; border-radius: 6px; text-decoration: none; display: inline-block; font-weight: 500;">${b.properties.text || 'Button'}</a></div>`;
      } else if (b.type === 'divider') {
        html += `<hr style="border: none; border-top: 1px solid #e2e8f0; margin: 16px 0;" />`;
      } else if (b.type === 'spacer') {
        html += `<div style="height: ${b.properties.height || '20px'};"></div>`;
      } else if (b.type === 'footer') {
        html += `<div style="font-size: 12px; color: #94a3b8; text-align: center; margin-top: 20px;">${b.properties.text || '© Patient Connect. All rights reserved.'}</div>`;
      }
    }
    html += `</div>`;
  }

  html += `</div>`;
  return html;
}
