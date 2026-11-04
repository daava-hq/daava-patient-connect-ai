import { describe, expect, it } from 'vitest';
import { extractTemplateBody } from './document-schema';

describe('extractTemplateBody', () => {
  it('uses the explicit SMS body when present', () => {
    expect(extractTemplateBody({ body: 'Text {{patient.firstName}}' })).toBe('Text {{patient.firstName}}');
  });

  it('extracts text from existing section-based templates', () => {
    expect(extractTemplateBody({
      sections: [{
        blocks: [
          { type: 'paragraph', properties: { text: 'Appointment at {{practice.name}}' } },
          { type: 'button', properties: { text: 'Confirm', url: 'https://example.test/confirm' } },
        ],
      }],
    })).toBe('Appointment at {{practice.name}}\n\nConfirm\n\nhttps://example.test/confirm');
  });
});
