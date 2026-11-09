import 'server-only';
import { db } from '@/db';
import { templateCategories, templates, NewTemplate } from '@/db/schema/templates';
import { and, eq } from 'drizzle-orm';

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

  const samples: NewTemplate[] = [
    // 1. Appointment Reminders
    {
      categoryId: categoryMap.get('appointment-reminders')!,
      name: '24-Hour Appointment Reminder (SMS)',
      description: 'Standard 24-hour SMS reminder before scheduled visit',
      templateType: 'sms',
      channel: 'sms',
      content: { body: 'Hi {{patient.firstName}}, your appointment at {{practice.name}} is scheduled for {{appointment.date}} at {{appointment.time}}. Please call {{practice.phone}} if you need to make a change.' },
      variables: ['patient.firstName', 'practice.name', 'practice.phone', 'appointment.date', 'appointment.time'],
      status: 'published',
      isSystem: true,
    },
    {
      categoryId: categoryMap.get('appointment-reminders')!,
      name: '24-Hour Appointment Reminder (EMAIL)',
      description: '24-hour appointment reminder with a secure appointment confirmation link',
      templateType: 'newsletter',
      channel: 'email',
      content: {
        subject: 'Please confirm your upcoming appointment at {{practice.name}}',
        sections: [{
          id: 'appointment-confirmation',
          blocks: [
            { id: 'confirmation-greeting', type: 'heading', properties: { text: 'Appointment Reminder' } },
            { id: 'confirmation-details', type: 'paragraph', properties: { text: 'Hello {{patient.firstName}}, your appointment at {{practice.name}} is scheduled for {{appointment.date}} at {{appointment.time}}.' } },
            { id: 'confirmation-action', type: 'button', properties: { text: 'Confirm Appointment', url: '{{appointment.confirmUrl}}' } },
            { id: 'confirmation-contact', type: 'paragraph', properties: { text: 'If you need to make a change, please call {{practice.phone}}.' } },
          ],
        }],
      },
      variables: [
        'patient.firstName',
        'practice.name',
        'appointment.date',
        'appointment.time',
        'appointment.confirmUrl',
        'practice.phone',
      ],
      status: 'published',
      isSystem: true,
    },
    {
      categoryId: categoryMap.get('appointment-reminders')!,
      name: 'Appointment Reminder (Email)',
      description: 'Email reminder with the scheduled visit date and time',
      templateType: 'newsletter',
      channel: 'email',
      content: {
        subject: 'Your upcoming appointment at {{practice.name}}',
        blocks: [
          { type: 'image', url: 'https://images.unsplash.com/photo-1629909613654-28e377c37b09?w=800&auto=format&fit=crop&q=60', alt: 'Dental Care' },
          { type: 'heading', text: 'Appointment Reminder' },
          { type: 'paragraph', text: 'Dear {{patient.firstName}}, this is a reminder that your appointment is scheduled for {{appointment.date}} at {{appointment.time}}.' },
          { type: 'paragraph', text: 'Please call us at {{practice.phone}} if you need to make a change.' },
        ],
      },
      variables: ['patient.firstName', 'appointment.date', 'appointment.time', 'practice.phone'],
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
          { type: 'paragraph', text: 'We hope you have an amazing day filled with joy and smiles. As a gift from our team, {{birthday.offer}}' },
          { type: 'paragraph', text: 'Call {{practice.phone}} to learn more.' },
        ],
      },
      variables: ['patient.firstName', 'practice.name', 'practice.phone', 'birthday.offer'],
      status: 'published',
      isSystem: true,
    },
    {
      categoryId: categoryMap.get('birthdays')!,
      name: 'Birthday Greeting SMS',
      description: 'A warm, concise SMS greeting for a patient birthday',
      templateType: 'sms',
      channel: 'sms',
      content: { body: 'Happy Birthday, {{patient.firstName}}! Everyone at {{practice.name}} hopes your day is full of smiles.' },
      variables: ['patient.firstName', 'practice.name'],
      status: 'published',
      isSystem: true,
    },
    {
      categoryId: categoryMap.get('birthdays')!,
      name: 'Birthday Greeting Email',
      description: 'A personalized email greeting from the practice team',
      templateType: 'email',
      channel: 'email',
      content: {
        subject: 'Happy Birthday, {{patient.firstName}}!',
        blocks: [
          { type: 'heading', text: 'Happy Birthday, {{patient.firstName}}!' },
          { type: 'paragraph', text: 'Wishing you a wonderful birthday from all of us at {{practice.name}}.' },
          { type: 'paragraph', text: 'We hope your day is filled with smiles.' },
        ],
      },
      variables: ['patient.firstName', 'practice.name'],
      status: 'published',
      isSystem: true,
    },
    {
      categoryId: categoryMap.get('birthdays')!,
      name: 'Personalized Birthday Message',
      description: 'A personal birthday message with the birthday date and practice contact',
      templateType: 'sms',
      channel: 'sms',
      content: { body: 'Hi {{patient.firstName}}, happy birthday on {{birthday.date}}! Your friends at {{practice.name}} are thinking of you. Call us at {{practice.phone}} anytime.' },
      variables: ['patient.firstName', 'practice.name', 'practice.phone', 'birthday.date'],
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
      name: 'Monthly Dental Newsletter',
      description: 'Monthly practice newsletter with oral hygiene tips and a booking link',
      templateType: 'newsletter',
      channel: 'email',
      content: {
        subject: 'Your Monthly Smile Report & Oral Health Tips',
        sections: [{
          id: 'monthly-newsletter',
          blocks: [
            { id: 'monthly-title', type: 'heading', properties: { text: 'Your Monthly Smile Report', level: 'h1', alignment: 'center' } },
            { id: 'monthly-intro', type: 'paragraph', properties: { text: 'Hello {{patient.firstName}}, here are this month’s practice updates and ideas for keeping your smile healthy.' } },
            { id: 'monthly-tips', type: 'paragraph', properties: { text: 'Brush twice a day with fluoride toothpaste, clean between your teeth daily, and book regular preventive visits.' } },
            { id: 'monthly-action', type: 'button', properties: { text: 'Visit Our Website', url: '{{practice.website}}', alignment: 'center' } },
            { id: 'monthly-footer', type: 'footer', properties: { text: '{{practice.name}} · {{practice.phone}} · {{practice.address}}' } },
          ],
        }],
      },
      variables: ['patient.firstName', 'practice.name', 'practice.website'],
      status: 'published',
      isSystem: true,
    },
    {
      categoryId: categoryMap.get('newsletters')!,
      name: 'Oral Hygiene Tips',
      description: 'Practical daily brushing and flossing reminders',
      templateType: 'newsletter',
      channel: 'email',
      content: {
        subject: 'Simple habits for a healthier smile',
        sections: [{ id: 'hygiene-tips', blocks: [
          { id: 'hygiene-title', type: 'heading', properties: { text: 'Small Habits, Healthy Smiles', level: 'h1' } },
          { id: 'hygiene-greeting', type: 'paragraph', properties: { text: 'Hi {{patient.firstName}}, consistency is the key to a healthy smile.' } },
          { id: 'hygiene-brush', type: 'paragraph', properties: { text: 'Brush gently for two minutes, twice each day, using a soft-bristled toothbrush.' } },
          { id: 'hygiene-floss', type: 'paragraph', properties: { text: 'Clean between your teeth daily and replace your toothbrush when the bristles become worn.' } },
          { id: 'hygiene-contact', type: 'footer', properties: { text: 'Questions? Contact {{practice.name}} at {{practice.phone}}.' } },
        ] }],
      },
      variables: ['patient.firstName', 'practice.name', 'practice.phone'],
      status: 'published',
      isSystem: true,
    },
    {
      categoryId: categoryMap.get('newsletters')!,
      name: 'Dental Health Awareness',
      description: 'Patient-friendly guidance for preventive dental health',
      templateType: 'newsletter',
      channel: 'email',
      content: {
        subject: 'Your dental health matters',
        sections: [{ id: 'dental-awareness', blocks: [
          { id: 'awareness-title', type: 'heading', properties: { text: 'Prevention Makes a Difference', level: 'h1' } },
          { id: 'awareness-copy', type: 'paragraph', properties: { text: 'Hello {{patient.firstName}}, regular preventive care can help you maintain a comfortable, healthy smile.' } },
          { id: 'awareness-tips', type: 'paragraph', properties: { text: 'Keep up with daily brushing and interdental cleaning, and let your dental team know about changes in your oral health.' } },
          { id: 'awareness-practice', type: 'footer', properties: { text: 'Your care team at {{practice.name}} · {{practice.phone}}' } },
        ] }],
      },
      variables: ['patient.firstName', 'practice.name', 'practice.phone'],
      status: 'published',
      isSystem: true,
    },
    {
      categoryId: categoryMap.get('newsletters')!,
      name: 'Practice Announcements',
      description: 'Share office updates and important practice information',
      templateType: 'newsletter',
      channel: 'email',
      content: {
        subject: 'News and updates from {{practice.name}}',
        sections: [{ id: 'practice-announcement', blocks: [
          { id: 'announcement-title', type: 'heading', properties: { text: 'A Note from Our Practice', level: 'h1' } },
          { id: 'announcement-copy', type: 'paragraph', properties: { text: 'Hello {{patient.firstName}}, we have an update to share with you. Add your practice news here before sending.' } },
          { id: 'announcement-contact', type: 'paragraph', properties: { text: 'For questions, call {{practice.phone}} or visit {{practice.website}}.' } },
          { id: 'announcement-footer', type: 'footer', properties: { text: '{{practice.name}} · {{practice.address}}' } },
        ] }],
      },
      variables: ['patient.firstName', 'practice.name', 'practice.phone', 'practice.website', 'practice.address'],
      status: 'published',
      isSystem: true,
    },
    {
      categoryId: categoryMap.get('newsletters')!,
      name: 'Seasonal Dental Tips',
      description: 'Seasonal reminders for keeping your smile healthy',
      templateType: 'newsletter',
      channel: 'email',
      content: {
        subject: 'A few seasonal tips for your smile',
        sections: [{ id: 'seasonal-tips', blocks: [
          { id: 'seasonal-title', type: 'heading', properties: { text: 'Care for Your Smile This Season', level: 'h1' } },
          { id: 'seasonal-copy', type: 'paragraph', properties: { text: 'Hi {{patient.firstName}}, changing routines can make daily oral care easy to overlook.' } },
          { id: 'seasonal-tip', type: 'paragraph', properties: { text: 'Keep a toothbrush and floss with your travel essentials, drink water throughout the day, and enjoy treats in moderation.' } },
          { id: 'seasonal-footer', type: 'footer', properties: { text: 'Warm wishes from {{practice.name}} · {{practice.phone}}' } },
        ] }],
      },
      variables: ['patient.firstName', 'practice.name', 'practice.phone'],
      status: 'published',
      isSystem: true,
    },
    {
      categoryId: categoryMap.get('newsletters')!,
      name: 'New Services Announcement',
      description: 'Introduce a new service offered by your practice',
      templateType: 'newsletter',
      channel: 'email',
      content: {
        subject: 'Discover what’s new at {{practice.name}}',
        sections: [{ id: 'new-services', blocks: [
          { id: 'services-title', type: 'heading', properties: { text: 'A New Service for Our Patients', level: 'h1' } },
          { id: 'services-copy', type: 'paragraph', properties: { text: 'Hello {{patient.firstName}}, we are pleased to share that our practice has a new service. Add the service details and eligibility information here.' } },
          { id: 'services-link', type: 'button', properties: { text: 'Learn More', url: '{{practice.website}}', alignment: 'center' } },
          { id: 'services-footer', type: 'footer', properties: { text: 'Contact {{practice.name}} at {{practice.phone}} for details.' } },
        ] }],
      },
      variables: ['patient.firstName', 'practice.name', 'practice.phone', 'practice.website'],
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
      const [existing] = await db
        .select({ id: templates.id })
        .from(templates)
        .where(
          and(
            eq(templates.categoryId, s.categoryId),
            eq(templates.name, s.name),
            eq(templates.isSystem, true)
          )
        )
        .limit(1);
      if (!existing) await db.insert(templates).values(s);
    }
  }
}
