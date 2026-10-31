import 'server-only';
import { db } from '@/db';
import { templateCategories, templates, NewTemplate } from '@/db/schema/templates';
import { eq } from 'drizzle-orm';

export async function seedSystemTemplates() {
  const cats = await db.select().from(templateCategories);
  if (cats.length === 0) {
    const defaultCats = [
      { slug: 'appointment-reminders', name: 'Appointment Reminders', sortOrder: 1 },
      { slug: 'birthdays', name: 'Birthdays', sortOrder: 2 },
      { slug: 'groups', name: 'Groups', sortOrder: 3 },
      { slug: 'newsletters', name: 'Newsletters', sortOrder: 4 },
      { slug: 'payment-reminders', name: 'Payment Reminders & Requests', sortOrder: 5 },
      { slug: 'recall', name: 'Recall', sortOrder: 6 },
      { slug: 'referrals', name: 'Referrals', sortOrder: 7 },
      { slug: 'surveys', name: 'Surveys', sortOrder: 8 },
      { slug: 'connect', name: 'Connect / Two-Way Texting', sortOrder: 9 },
    ];
    await db.insert(templateCategories).values(defaultCats).onConflictDoNothing();
  }

  const categoryMap = new Map((await db.select().from(templateCategories)).map((c) => [c.slug, c.id]));

  const existingSystem = await db.select({ id: templates.id }).from(templates).where(eq(templates.isSystem, true)).limit(1);
  if (existingSystem.length > 0) return;

  const samples: NewTemplate[] = [
    // 1. Appointment Reminders
    {
      categoryId: categoryMap.get('appointment-reminders')!,
      name: '24-Hour Appointment Reminder (SMS)',
      description: 'Standard 24-hour SMS reminder before scheduled visit',
      templateType: 'sms',
      channel: 'sms',
      content: { body: 'Hi {{patient.firstName}}, this is a reminder from {{practice.name}} for your appointment tomorrow at {{appointment.time}} with {{appointment.provider}}. Reply C to confirm.' },
      variables: ['patient.firstName', 'practice.name', 'appointment.time', 'appointment.provider'],
      status: 'published',
      isSystem: true,
    },
    {
      categoryId: categoryMap.get('appointment-reminders')!,
      name: 'Modern Appointment Confirmation (Email)',
      description: 'Rich HTML email with banner image and visit details',
      templateType: 'newsletter',
      channel: 'email',
      content: {
        subject: 'Your upcoming appointment at {{practice.name}}',
        blocks: [
          { type: 'image', url: 'https://images.unsplash.com/photo-1629909613654-28e377c37b09?w=800&auto=format&fit=crop&q=60', alt: 'Dental Care' },
          { type: 'heading', text: 'Appointment Confirmation' },
          { type: 'paragraph', text: 'Dear {{patient.firstName}}, your visit is confirmed for {{appointment.date}} at {{appointment.time}} with {{appointment.provider}}.' },
          { type: 'button', text: 'View Appointment Details', url: '{{practice.website}}' },
          { type: 'paragraph', text: 'Please call us at {{practice.phone}} if you need to reschedule.' },
        ],
      },
      variables: ['patient.firstName', 'practice.name', 'appointment.date', 'appointment.time', 'appointment.provider', 'practice.website', 'practice.phone'],
      status: 'published',
      isSystem: true,
    },

    // 2. Birthdays
    {
      categoryId: categoryMap.get('birthdays')!,
      name: 'Birthday Greeting with Special Offer',
      description: 'Modern email greeting with celebratory banner and gift',
      templateType: 'newsletter',
      channel: 'email',
      content: {
        subject: 'Happy Birthday from everyone at {{practice.name}}! 🎂',
        blocks: [
          { type: 'image', url: 'https://images.unsplash.com/photo-1513151233558-d860c5398176?w=800&auto=format&fit=crop&q=60', alt: 'Birthday Celebration' },
          { type: 'heading', text: 'Happy Birthday, {{patient.firstName}}!' },
          { type: 'paragraph', text: 'We hope you have an amazing day filled with joy and smiles. As a gift from our team, enjoy 20% off any whitening treatment this month!' },
          { type: 'button', text: 'Claim Your Gift', url: '{{practice.website}}' },
        ],
      },
      variables: ['patient.firstName', 'practice.name', 'practice.website'],
      status: 'published',
      isSystem: true,
    },

    // 3. Groups
    {
      categoryId: categoryMap.get('groups')!,
      name: 'Family Dental Care Program',
      description: 'Broadcast email showcasing family dentistry services and images',
      templateType: 'newsletter',
      channel: 'email',
      content: {
        subject: 'Caring for your whole family at {{practice.name}}',
        blocks: [
          { type: 'image', url: 'https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?w=800&auto=format&fit=crop&q=60', alt: 'Family Smile' },
          { type: 'heading', text: 'Healthy Smiles for the Whole Family' },
          { type: 'paragraph', text: 'Hello {{patient.firstName}}, we make dental visits comfortable and fun for patients of all ages.' },
          { type: 'button', text: 'Book Family Visit', url: '{{practice.website}}' },
        ],
      },
      variables: ['patient.firstName', 'practice.name', 'practice.website'],
      status: 'published',
      isSystem: true,
    },

    // 4. Newsletters
    {
      categoryId: categoryMap.get('newsletters')!,
      name: 'Monthly Smile Newsletter',
      description: 'Rich monthly newsletter with oral hygiene tips and practice news',
      templateType: 'newsletter',
      channel: 'email',
      content: {
        subject: 'Your Monthly Smile Report & Oral Health Tips',
        blocks: [
          { type: 'image', url: 'https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?w=800&auto=format&fit=crop&q=60', alt: 'Newsletter Banner' },
          { type: 'heading', text: 'Spring Into a Brighter Smile' },
          { type: 'paragraph', text: 'Hi {{patient.firstName}}, spring is the perfect time to refresh your brushing routine and schedule your hygiene checkup.' },
          { type: 'button', text: 'Visit Our Website', url: '{{practice.website}}' },
        ],
      },
      variables: ['patient.firstName', 'practice.name', 'practice.website'],
      status: 'published',
      isSystem: true,
    },

    // 5. Payment Reminders
    {
      categoryId: categoryMap.get('payment-reminders')!,
      name: 'Secure Online Payment Request',
      description: 'Modern statement notification with direct secure payment button',
      templateType: 'newsletter',
      channel: 'email',
      content: {
        subject: 'Account Statement from {{practice.name}}',
        blocks: [
          { type: 'heading', text: 'Account Balance Notice' },
          { type: 'paragraph', text: 'Dear {{patient.firstName}}, you have an outstanding balance of {{payment.amount}} due by {{payment.dueDate}}.' },
          { type: 'button', text: 'Pay Securely Online', url: '{{practice.website}}' },
        ],
      },
      variables: ['patient.firstName', 'practice.name', 'payment.amount', 'payment.dueDate', 'practice.website'],
      status: 'published',
      isSystem: true,
    },

    // 6. Recall
    {
      categoryId: categoryMap.get('recall')!,
      name: 'Preventive Care Recall Notice',
      description: 'Encouraging reminder for routine cleaning and examination',
      templateType: 'newsletter',
      channel: 'email',
      content: {
        subject: 'Time for your routine dental checkup at {{practice.name}}',
        blocks: [
          { type: 'image', url: 'https://images.unsplash.com/photo-1606811841689-23dfddce6395?w=800&auto=format&fit=crop&q=60', alt: 'Dental Checkup' },
          { type: 'heading', text: 'Keep Your Smile Healthy & Bright' },
          { type: 'paragraph', text: 'Hello {{patient.firstName}}, it has been 6 months since your last visit. Routine cleanings are essential for preventing cavities and gum disease.' },
          { type: 'button', text: 'Schedule Appointment', url: '{{practice.website}}' },
        ],
      },
      variables: ['patient.firstName', 'practice.name', 'practice.website'],
      status: 'published',
      isSystem: true,
    },

    // 7. Referrals
    {
      categoryId: categoryMap.get('referrals')!,
      name: 'Patient Referral Program Invitation',
      description: 'Inviting patients to refer friends and family',
      templateType: 'newsletter',
      channel: 'email',
      content: {
        subject: 'Share the Smile — Refer a Friend to {{practice.name}}',
        blocks: [
          { type: 'image', url: 'https://images.unsplash.com/photo-1543353071-10c8ba85a904?w=800&auto=format&fit=crop&q=60', alt: 'Friends Smiling' },
          { type: 'heading', text: 'Give $25, Get $25' },
          { type: 'paragraph', text: 'Hi {{patient.firstName}}, love your visits with us? Share the care with your friends and family!' },
          { type: 'button', text: 'Share Referral Link', url: '{{practice.website}}' },
        ],
      },
      variables: ['patient.firstName', 'practice.name', 'practice.website'],
      status: 'published',
      isSystem: true,
    },

    // 8. Surveys
    {
      categoryId: categoryMap.get('surveys')!,
      name: 'Post-Visit Experience Survey',
      description: 'Elegant post-appointment feedback invitation',
      templateType: 'survey',
      channel: 'email',
      content: {
        title: 'How was your recent visit at {{practice.name}}?',
        description: 'Your feedback helps us provide the best possible care.',
        questions: [
          { id: 'q1', text: 'How would you rate your comfort during your visit?', type: 'rating', required: true },
          { id: 'q2', text: 'Did our team address all your questions?', type: 'boolean', required: true },
          { id: 'q3', text: 'Any comments or suggestions?', type: 'text', required: false },
        ],
      },
      variables: ['patient.firstName', 'practice.name'],
      status: 'published',
      isSystem: true,
    },

    // 9. Connect
    {
      categoryId: categoryMap.get('connect')!,
      name: 'Welcome & Two-Way Texting Intro',
      description: 'Introduction to text messaging with the practice',
      templateType: 'sms',
      channel: 'sms',
      content: { body: 'Welcome to {{practice.name}}, {{patient.firstName}}! You can text us anytime at this number for appointments, questions, or assistance.' },
      variables: ['patient.firstName', 'practice.name'],
      status: 'published',
      isSystem: true,
    },
  ];

  for (const s of samples) {
    if (s.categoryId) {
      await db.insert(templates).values(s).onConflictDoNothing();
    }
  }
}
