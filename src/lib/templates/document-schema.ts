export type CanvasBlockType =
  | 'heading'
  | 'paragraph'
  | 'image'
  | 'button'
  | 'divider'
  | 'spacer'
  | 'footer'
  | 'logo';

export interface CanvasBlock {
  id: string;
  type: CanvasBlockType;
  properties: {
    text?: string;
    level?: 'h1' | 'h2' | 'h3';
    fontSize?: string;
    fontFamily?: string;
    color?: string;
    backgroundColor?: string;
    alignment?: 'left' | 'center' | 'right' | 'justify';
    url?: string;
    alt?: string;
    padding?: string;
    borderRadius?: string;
    height?: string;
    width?: string;
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

export function createDefaultDocument(layoutType: string = 'newsletter'): TemplateDocument {
  switch (layoutType) {
    case 'announcement':
      return {
        version: 1,
        subject: 'Important Announcement from {{practice.name}}',
        sections: [
          {
            id: 'sec-1',
            backgroundColor: '#ffffff',
            padding: '24px',
            blocks: [
              { id: 'b-1', type: 'logo', properties: { url: 'https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?w=200&auto=format&fit=crop&q=60', alignment: 'center', width: '120px' } },
              { id: 'b-2', type: 'heading', properties: { text: 'News from {{practice.name}}', level: 'h1', color: '#1e293b', alignment: 'center' } },
              { id: 'b-3', type: 'paragraph', properties: { text: 'Dear {{patient.firstName}}, we wanted to share an important update regarding our office hours and services at {{practice.name}}.', color: '#475569' } },
              { id: 'b-4', type: 'button', properties: { text: 'Read Full Update', url: '{{practice.website}}', backgroundColor: '#2563eb', color: '#ffffff', alignment: 'center' } },
              { id: 'b-5', type: 'footer', properties: { text: '{{practice.name}} | {{practice.phone}} | {{practice.address}}' } },
            ],
          },
        ],
      };
    case 'appointment':
      return {
        version: 1,
        subject: 'Upcoming Appointment Reminder - {{practice.name}}',
        sections: [
          {
            id: 'sec-1',
            backgroundColor: '#ffffff',
            padding: '24px',
            blocks: [
              { id: 'b-1', type: 'heading', properties: { text: 'Appointment Reminder', level: 'h2', color: '#2563eb', alignment: 'left' } },
              { id: 'b-2', type: 'paragraph', properties: { text: 'Hello {{patient.firstName}}, this is a friendly reminder of your upcoming dental visit with {{appointment.provider}} at {{practice.name}}.', color: '#1e293b' } },
              { id: 'b-3', type: 'paragraph', properties: { text: 'Date: {{appointment.date}}\nTime: {{appointment.time}}\nStatus: {{appointment.status}}', color: '#475569' } },
              { id: 'b-4', type: 'button', properties: { text: 'Confirm Appointment', url: '{{practice.website}}', backgroundColor: '#16a34a', color: '#ffffff', alignment: 'center' } },
              { id: 'b-5', type: 'footer', properties: { text: 'If you need to reschedule, please call us at {{practice.phone}}.' } },
            ],
          },
        ],
      };
    case 'birthday':
      return {
        version: 1,
        subject: 'Happy Birthday from {{practice.name}}! 🎉',
        sections: [
          {
            id: 'sec-1',
            backgroundColor: '#ffffff',
            padding: '24px',
            blocks: [
              { id: 'b-1', type: 'heading', properties: { text: 'Happy Birthday, {{patient.firstName}}!', level: 'h1', color: '#db2777', alignment: 'center' } },
              { id: 'b-2', type: 'paragraph', properties: { text: 'Everyone at {{practice.name}} wishes you a wonderful and healthy birthday! As a thank you for being a valued patient, enjoy a special gift on your next visit.', color: '#475569', alignment: 'center' } },
              { id: 'b-3', type: 'button', properties: { text: 'Book Your Next Visit', url: '{{practice.website}}', backgroundColor: '#db2777', color: '#ffffff', alignment: 'center' } },
              { id: 'b-4', type: 'footer', properties: { text: '{{practice.name}} | {{practice.phone}}' } },
            ],
          },
        ],
      };
    case 'payment':
      return {
        version: 1,
        subject: 'Payment Statement / Request from {{practice.name}}',
        sections: [
          {
            id: 'sec-1',
            backgroundColor: '#ffffff',
            padding: '24px',
            blocks: [
              { id: 'b-1', type: 'heading', properties: { text: 'Account Balance Statement', level: 'h2', color: '#1e293b', alignment: 'left' } },
              { id: 'b-2', type: 'paragraph', properties: { text: 'Dear {{patient.firstName}}, this is a reminder regarding your outstanding balance of {{payment.amount}} due by {{payment.dueDate}} at {{practice.name}}.', color: '#475569' } },
              { id: 'b-3', type: 'button', properties: { text: 'Pay Online Now', url: '{{practice.website}}', backgroundColor: '#2563eb', color: '#ffffff', alignment: 'center' } },
              { id: 'b-4', type: 'footer', properties: { text: 'Questions about your bill? Call {{practice.phone}}.' } },
            ],
          },
        ],
      };
    case 'recall':
      return {
        version: 1,
        subject: 'Time for your dental checkup at {{practice.name}}',
        sections: [
          {
            id: 'sec-1',
            backgroundColor: '#ffffff',
            padding: '24px',
            blocks: [
              { id: 'b-1', type: 'heading', properties: { text: 'Preventive Recall Due', level: 'h2', color: '#1e293b', alignment: 'left' } },
              { id: 'b-2', type: 'paragraph', properties: { text: 'Hello {{patient.firstName}}, your routine checkup and cleaning at {{practice.name}} is due around {{recall.dueDate}}.', color: '#475569' } },
              { id: 'b-3', type: 'button', properties: { text: 'Schedule Checkup', url: '{{practice.website}}', backgroundColor: '#2563eb', color: '#ffffff', alignment: 'center' } },
              { id: 'b-4', type: 'footer', properties: { text: '{{practice.name}} | {{practice.phone}}' } },
            ],
          },
        ],
      };
    case 'referral':
      return {
        version: 1,
        subject: 'Thank you for your referral to {{referral.practiceName}}!',
        sections: [
          {
            id: 'sec-1',
            backgroundColor: '#ffffff',
            padding: '24px',
            blocks: [
              { id: 'b-1', type: 'heading', properties: { text: 'Thank You for Your Referral!', level: 'h2', color: '#1e293b', alignment: 'left' } },
              { id: 'b-2', type: 'paragraph', properties: { text: 'Dear {{patient.firstName}}, thank you so much for referring friends or family to {{practice.name}}. We truly appreciate your trust and support.', color: '#475569' } },
              { id: 'b-3', type: 'footer', properties: { text: '{{practice.name}} | {{practice.phone}}' } },
            ],
          },
        ],
      };
    case 'survey':
      return {
        version: 1,
        subject: 'How was your recent visit to {{practice.name}}?',
        sections: [
          {
            id: 'sec-1',
            backgroundColor: '#ffffff',
            padding: '24px',
            blocks: [
              { id: 'b-1', type: 'heading', properties: { text: 'We Value Your Feedback', level: 'h2', color: '#1e293b', alignment: 'left' } },
              { id: 'b-2', type: 'paragraph', properties: { text: 'Hello {{patient.firstName}}, thank you for visiting {{practice.name}} recently. Please take 1 minute to share your feedback with us.', color: '#475569' } },
              { id: 'b-3', type: 'button', properties: { text: 'Take Survey', url: '{{practice.website}}', backgroundColor: '#2563eb', color: '#ffffff', alignment: 'center' } },
              { id: 'b-4', type: 'footer', properties: { text: '{{practice.name}} | {{practice.phone}}' } },
            ],
          },
        ],
      };
    case 'sms':
    case 'internal_response':
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
    default:
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
}

export function renderDocumentToHtml(doc: TemplateDocument): string {
  let html = `<div style="font-family: sans-serif; color: #334155; max-width: 600px; margin: 0 auto; background: #f8fafc; padding: 20px;">`;
  
  if (doc.subject) {
    html += `<div style="font-size: 14px; color: #64748b; margin-bottom: 12px; font-weight: 500;">Subject: ${doc.subject}</div>`;
  }

  for (const sec of doc.sections) {
    html += `<div style="background: ${sec.backgroundColor || '#ffffff'}; padding: ${sec.padding || '20px'}; border-radius: 8px; margin-bottom: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">`;
    for (const b of sec.blocks) {
      const ff = b.properties.fontFamily ? `font-family: ${b.properties.fontFamily};` : '';
      const fs = b.properties.fontSize ? `font-size: ${b.properties.fontSize};` : '';
      const align = b.properties.alignment ? `text-align: ${b.properties.alignment};` : 'text-align: left;';
      const col = b.properties.color ? `color: ${b.properties.color};` : '';

      if (b.type === 'heading') {
        const tag = b.properties.level || 'h2';
        html += `<${tag} style="${col} ${align} ${ff} ${fs} margin: 0 0 12px 0;">${b.properties.text || ''}</${tag}>`;
      } else if (b.type === 'paragraph') {
        html += `<p style="${col} ${align} ${ff} ${fs} line-height: 1.5; margin: 0 0 12px 0;">${b.properties.text || ''}</p>`;
      } else if (b.type === 'image') {
        const imgWidth = b.properties.width || '100%';
        html += `<div style="text-align: ${b.properties.alignment || 'center'}; margin: 12px 0;"><img src="${b.properties.url || ''}" alt="${b.properties.alt || ''}" style="max-width: ${imgWidth}; width: ${imgWidth}; border-radius: 6px;" /></div>`;
      } else if (b.type === 'logo') {
        const logoWidth = b.properties.width || '120px';
        html += `<div style="text-align: ${b.properties.alignment || 'center'}; margin: 12px 0;"><img src="${b.properties.url || ''}" alt="Logo" style="width: ${logoWidth}; max-width: 100%;" /></div>`;
      } else if (b.type === 'button') {
        const btnAlign = b.properties.alignment || 'center';
        const btnWidth = b.properties.width ? `width: ${b.properties.width}; display: block;` : 'display: inline-block;';
        html += `<div style="text-align: ${btnAlign}; margin: 16px 0;"><a href="${b.properties.url || '#'}" style="background: ${b.properties.backgroundColor || '#2563eb'}; color: ${b.properties.color || '#ffffff'}; padding: 10px 20px; border-radius: 6px; text-decoration: none; ${btnWidth} font-weight: 500; box-sizing: border-box;">${b.properties.text || 'Button'}</a></div>`;
      } else if (b.type === 'divider') {
        html += `<hr style="border: none; border-top: 1px solid #e2e8f0; margin: 16px 0;" />`;
      } else if (b.type === 'spacer') {
        html += `<div style="height: ${b.properties.height || '20px'};"></div>`;
      } else if (b.type === 'footer') {
        html += `<div style="font-size: 12px; color: #94a3b8; text-align: center; margin-top: 20px; ${ff}">${b.properties.text || '© Patient Connect. All rights reserved.'}</div>`;
      }
    }
    html += `</div>`;
  }

  html += `</div>`;
  return html;
}
