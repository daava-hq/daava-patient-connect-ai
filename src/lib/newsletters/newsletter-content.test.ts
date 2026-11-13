import { describe, expect, it } from 'vitest';
import {
  interpolateNewsletterHtml,
  parseNewsletterDocument,
  renderNewsletterDocument,
} from './newsletter-content';

const newsletter = {
  subject: 'News for {{patient.firstName}}',
  sections: [{
    blocks: [
      { type: 'heading', properties: { text: 'Hello {{patient.firstName}}' } },
      { type: 'paragraph', properties: { text: '<script>alert(1)</script>' } },
      { type: 'button', properties: { text: 'Visit us', url: '{{practice.website}}' } },
    ],
  }],
};

describe('newsletter content', () => {
  it('renders escaped responsive HTML and plain text with patient and practice values', () => {
    const rendered = renderNewsletterDocument(newsletter, {
      'patient.firstName': '<Taylor>',
      'practice.website': 'https://practice.example.test/',
    });

    expect(rendered.subject).toBe('News for <Taylor>');
    expect(rendered.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(rendered.html).not.toContain('<script>');
    expect(rendered.html).toContain('href="https://practice.example.test/"');
    expect(rendered.html).toContain('name="viewport"');
    expect(rendered.text).toContain('Hello <Taylor>');
    expect(rendered.text).toContain('Visit us: https://practice.example.test/');
  });

  it('accepts and renders the Recall due date variable', () => {
    const rendered = renderNewsletterDocument({
      subject: 'Your preventive visit is due',
      blocks: [{ type: 'paragraph', text: 'Your recall is due on {{recall.dueDate}}.' }],
    }, { 'recall.dueDate': 'November 13, 2026' });

    expect(rendered.text).toBe('Your recall is due on November 13, 2026.');
  });

  it('rejects unsupported variables and content without blocks', () => {
    expect(() => parseNewsletterDocument({
      subject: 'Hello',
      blocks: [{ type: 'paragraph', text: '{{patient.dateOfBirth}}' }],
    })).toThrow('Unsupported newsletter variable');
    expect(() => parseNewsletterDocument({ subject: 'Hello' })).toThrow('Add at least one content block');
  });

  it('removes unsafe links after variable interpolation', () => {
    const rendered = renderNewsletterDocument(newsletter, {
      'patient.firstName': 'Sam',
      'practice.website': 'javascript:alert(1)',
    });

    expect(rendered.html).not.toContain('javascript:');
    expect(rendered.html).not.toContain('href=');
  });

  it('escapes variable output and filters unsafe URLs in stored HTML', () => {
    const html = '<a href="{{practice.website}}">{{patient.firstName}}</a>';
    expect(interpolateNewsletterHtml(html, {
      'practice.website': 'javascript:alert(1)',
      'patient.firstName': '<Sam>',
    })).toBe('<a >&lt;Sam&gt;</a>');
  });
});
