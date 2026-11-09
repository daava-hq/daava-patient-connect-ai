import postgres from 'postgres';
import 'dotenv/config';

if (!['local', 'dev'].includes(process.env.APP_ENVIRONMENT)) {
  throw new Error('Template seeding is restricted to APP_ENVIRONMENT=local or dev');
}
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL must be explicitly configured');
}

const sql = postgres(process.env.DATABASE_URL);

async function main() {
  console.log('Seeding template categories and block-based sample system templates...');

  const categories = [
    { slug: 'appointment-reminders', name: 'Appointment Reminders', sort_order: 1 },
    { slug: 'birthdays', name: 'Birthdays', sort_order: 2 },
    { slug: 'groups', name: 'Groups', sort_order: 3 },
    { slug: 'newsletters', name: 'Newsletters', sort_order: 4 },
    { slug: 'payment-reminders', name: 'Payment Reminders & Requests', sort_order: 5 },
    { slug: 'recall', name: 'Recall', sort_order: 6 },
    { slug: 'referrals', name: 'Referrals', sort_order: 7 },
    { slug: 'surveys', name: 'Surveys', sort_order: 8 },
    { slug: 'connect', name: 'Connect / Two-Way Texting', sort_order: 9 },
  ];

  for (const cat of categories) {
    await sql`
      INSERT INTO template_categories (slug, name, sort_order)
      VALUES (${cat.slug}, ${cat.name}, ${cat.sort_order})
      ON CONFLICT (slug) DO NOTHING
    `;
  }

  const catRows = await sql`SELECT id, slug FROM template_categories`;
  const catMap = new Map(catRows.map(r => [r.slug, r.id]));

  const samples = [
    {
      category_slug: 'appointment-reminders',
      name: '24-Hour Appointment Reminder (EMAIL)',
      description: '24-hour appointment reminder with a secure appointment confirmation link',
      template_type: 'newsletter',
      channel: 'email',
      content: JSON.stringify({
        version: 1,
        subject: 'Please confirm your upcoming appointment at {{practice.name}}',
        sections: [
          {
            id: 'appointment-confirmation',
            blocks: [
              { id: 'confirmation-greeting', type: 'heading', properties: { text: 'Appointment Reminder' } },
              { id: 'confirmation-details', type: 'paragraph', properties: { text: 'Hello {{patient.firstName}}, your appointment at {{practice.name}} is scheduled for {{appointment.date}} at {{appointment.time}}.' } },
              { id: 'confirmation-action', type: 'button', properties: { text: 'Confirm Appointment', url: '{{appointment.confirmUrl}}' } },
              { id: 'confirmation-contact', type: 'paragraph', properties: { text: 'If you need to make a change, please call {{practice.phone}}.' } }
            ]
          }
        ]
      }),
      variables: JSON.stringify([
        'patient.firstName',
        'practice.name',
        'appointment.date',
        'appointment.time',
        'appointment.confirmUrl',
        'practice.phone'
      ]),
      status: 'published',
      is_system: true,
      version: 1
    },
    {
      category_slug: 'appointment-reminders',
      name: '24-Hour Appointment Reminder (SMS)',
      description: 'Standard 24-hour SMS reminder before scheduled visit',
      template_type: 'sms',
      channel: 'sms',
      content: JSON.stringify({
        version: 1,
        sections: [
          {
            id: 'sec-1',
            blocks: [
              { id: 'b-1', type: 'paragraph', properties: { text: 'Hi {{patient.firstName}}, this is a reminder from {{practice.name}} for your dental visit on {{appointment.date}} at {{appointment.time}}. Reply C to confirm or call {{practice.phone}} to reschedule.' } }
            ]
          }
        ]
      }),
      variables: JSON.stringify(['patient.firstName', 'practice.name', 'appointment.date', 'appointment.time', 'practice.phone']),
      status: 'published',
      is_system: true,
      version: 1
    },
    {
      category_slug: 'appointment-reminders',
      name: 'Modern Appointment Confirmation (Email)',
      description: 'Rich HTML email with banner image and visit details',
      template_type: 'newsletter',
      channel: 'email',
      content: JSON.stringify({
        version: 1,
        subject: 'Your upcoming appointment at {{practice.name}}',
        sections: [
          {
            id: 'sec-1',
            backgroundColor: '#ffffff',
            padding: '20px',
            blocks: [
              { id: 'b-1', type: 'image', properties: { url: 'https://images.unsplash.com/photo-1629909613654-28e377c37b09?w=800&auto=format&fit=crop&q=60', alt: 'Dental Care', alignment: 'center' } },
              { id: 'b-2', type: 'heading', properties: { text: 'Appointment Confirmation', level: 'h2', color: '#1e293b', alignment: 'left' } },
              { id: 'b-3', type: 'paragraph', properties: { text: 'Dear {{patient.firstName}}, your visit is confirmed for {{appointment.date}} at {{appointment.time}}.', color: '#475569' } },
              { id: 'b-4', type: 'paragraph', properties: { text: 'Location: {{practice.name}}, {{practice.address}}', color: '#475569' } },
              { id: 'b-5', type: 'paragraph', properties: { text: 'Please call us at {{practice.phone}} if you need to reschedule.', color: '#64748b' } }
            ]
          }
        ]
      }),
      variables: JSON.stringify(['patient.firstName', 'practice.name', 'appointment.date', 'appointment.time', 'practice.name', 'practice.address', 'practice.phone']),
      status: 'published',
      is_system: true,
      version: 1
    },
    {
      category_slug: 'birthdays',
      name: 'Birthday Greeting with Special Offer',
      description: 'Modern email greeting with celebratory banner and gift',
      template_type: 'newsletter',
      channel: 'email',
      content: JSON.stringify({
        version: 1,
        subject: 'Happy Birthday from everyone at {{practice.name}}! 🎂',
        sections: [
          {
            id: 'sec-1',
            backgroundColor: '#ffffff',
            padding: '20px',
            blocks: [
              { id: 'b-1', type: 'image', properties: { url: 'https://images.unsplash.com/photo-1513151233558-d860c5398176?w=800&auto=format&fit=crop&q=60', alt: 'Birthday Celebration', alignment: 'center' } },
              { id: 'b-2', type: 'heading', properties: { text: 'Happy Birthday, {{patient.firstName}}!', level: 'h2', color: '#1e293b', alignment: 'left' } },
              { id: 'b-3', type: 'paragraph', properties: { text: 'We hope you have an amazing day filled with joy and smiles. As a gift from our team, enjoy 20% off any whitening treatment this month!', color: '#475569' } },
              { id: 'b-4', type: 'button', properties: { text: 'Claim Your Gift', url: '{{practice.website}}', backgroundColor: '#2563eb', color: '#ffffff', alignment: 'center' } }
            ]
          }
        ]
      }),
      variables: JSON.stringify(['patient.firstName', 'practice.name', 'practice.website']),
      status: 'published',
      is_system: true,
      version: 1
    },
    {
      category_slug: 'groups',
      name: 'Family Dental Care Program',
      description: 'Broadcast email showcasing family dentistry services and images',
      template_type: 'newsletter',
      channel: 'email',
      content: JSON.stringify({
        version: 1,
        subject: 'Caring for your whole family at {{practice.name}}',
        sections: [
          {
            id: 'sec-1',
            backgroundColor: '#ffffff',
            padding: '20px',
            blocks: [
              { id: 'b-1', type: 'image', properties: { url: 'https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?w=800&auto=format&fit=crop&q=60', alt: 'Family Smile', alignment: 'center' } },
              { id: 'b-2', type: 'heading', properties: { text: 'Healthy Smiles for the Whole Family', level: 'h2', color: '#1e293b', alignment: 'left' } },
              { id: 'b-3', type: 'paragraph', properties: { text: 'Hello {{patient.firstName}}, we make dental visits comfortable and fun for patients of all ages.', color: '#475569' } },
              { id: 'b-4', type: 'button', properties: { text: 'Book Family Visit', url: '{{practice.website}}', backgroundColor: '#2563eb', color: '#ffffff', alignment: 'center' } }
            ]
          }
        ]
      }),
      variables: JSON.stringify(['patient.firstName', 'practice.name', 'practice.website']),
      status: 'published',
      is_system: true,
      version: 1
    },
    {
      category_slug: 'newsletters',
      name: 'Monthly Smile Newsletter',
      description: 'Rich monthly newsletter with oral hygiene tips and practice news',
      template_type: 'newsletter',
      channel: 'email',
      content: JSON.stringify({
        version: 1,
        subject: 'Your Monthly Smile Report & Oral Health Tips',
        sections: [
          {
            id: 'sec-1',
            backgroundColor: '#ffffff',
            padding: '20px',
            blocks: [
              { id: 'b-1', type: 'image', properties: { url: 'https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?w=800&auto=format&fit=crop&q=60', alt: 'Newsletter Banner', alignment: 'center' } },
              { id: 'b-2', type: 'heading', properties: { text: 'Spring Into a Brighter Smile', level: 'h2', color: '#1e293b', alignment: 'left' } },
              { id: 'b-3', type: 'paragraph', properties: { text: 'Hi {{patient.firstName}}, spring is the perfect time to refresh your brushing routine and schedule your hygiene checkup.', color: '#475569' } },
              { id: 'b-4', type: 'button', properties: { text: 'Visit Our Website', url: '{{practice.website}}', backgroundColor: '#2563eb', color: '#ffffff', alignment: 'center' } }
            ]
          }
        ]
      }),
      variables: JSON.stringify(['patient.firstName', 'practice.name', 'practice.website']),
      status: 'published',
      is_system: true,
      version: 1
    },
    {
      category_slug: 'newsletters',
      name: 'Monthly Dental Newsletter',
      description: 'Monthly practice newsletter with oral hygiene tips and a booking link',
      template_type: 'newsletter',
      channel: 'email',
      content: JSON.stringify({
        version: 1,
        subject: 'Your Monthly Smile Report & Oral Health Tips',
        sections: [{
          id: 'monthly-newsletter',
          blocks: [
            { id: 'monthly-title', type: 'heading', properties: { text: 'Your Monthly Smile Report', level: 'h1', alignment: 'center' } },
            { id: 'monthly-intro', type: 'paragraph', properties: { text: 'Hello {{patient.firstName}}, here are this month’s practice updates and ideas for keeping your smile healthy.' } },
            { id: 'monthly-tips', type: 'paragraph', properties: { text: 'Brush twice a day with fluoride toothpaste, clean between your teeth daily, and book regular preventive visits.' } },
            { id: 'monthly-action', type: 'button', properties: { text: 'Visit Our Website', url: '{{practice.website}}', alignment: 'center' } },
            { id: 'monthly-footer', type: 'footer', properties: { text: '{{practice.name}} · {{practice.phone}} · {{practice.address}}' } }
          ]
        }]
      }),
      variables: JSON.stringify(['patient.firstName', 'practice.name', 'practice.website', 'practice.phone', 'practice.address']),
      status: 'published',
      is_system: true,
      version: 1
    },
    {
      category_slug: 'newsletters',
      name: 'Oral Hygiene Tips',
      description: 'Practical daily brushing and flossing reminders',
      template_type: 'newsletter',
      channel: 'email',
      content: JSON.stringify({
        version: 1,
        subject: 'Simple habits for a healthier smile',
        sections: [{
          id: 'hygiene-tips',
          blocks: [
            { id: 'hygiene-title', type: 'heading', properties: { text: 'Small Habits, Healthy Smiles', level: 'h1' } },
            { id: 'hygiene-greeting', type: 'paragraph', properties: { text: 'Hi {{patient.firstName}}, consistency is the key to a healthy smile.' } },
            { id: 'hygiene-brush', type: 'paragraph', properties: { text: 'Brush gently for two minutes, twice each day, using a soft-bristled toothbrush.' } },
            { id: 'hygiene-floss', type: 'paragraph', properties: { text: 'Clean between your teeth daily and replace your toothbrush when the bristles become worn.' } },
            { id: 'hygiene-contact', type: 'footer', properties: { text: 'Questions? Contact {{practice.name}} at {{practice.phone}}.' } }
          ]
        }]
      }),
      variables: JSON.stringify(['patient.firstName', 'practice.name', 'practice.phone']),
      status: 'published',
      is_system: true,
      version: 1
    },
    {
      category_slug: 'newsletters',
      name: 'Dental Health Awareness',
      description: 'Patient-friendly guidance for preventive dental health',
      template_type: 'newsletter',
      channel: 'email',
      content: JSON.stringify({
        version: 1,
        subject: 'Your dental health matters',
        sections: [{
          id: 'dental-awareness',
          blocks: [
            { id: 'awareness-title', type: 'heading', properties: { text: 'Prevention Makes a Difference', level: 'h1' } },
            { id: 'awareness-copy', type: 'paragraph', properties: { text: 'Hello {{patient.firstName}}, regular preventive care can help you maintain a comfortable, healthy smile.' } },
            { id: 'awareness-tips', type: 'paragraph', properties: { text: 'Keep up with daily brushing and interdental cleaning, and let your dental team know about changes in your oral health.' } },
            { id: 'awareness-practice', type: 'footer', properties: { text: 'Your care team at {{practice.name}} · {{practice.phone}}' } }
          ]
        }]
      }),
      variables: JSON.stringify(['patient.firstName', 'practice.name', 'practice.phone']),
      status: 'published',
      is_system: true,
      version: 1
    },
    {
      category_slug: 'newsletters',
      name: 'Practice Announcements',
      description: 'Share office updates and important practice information',
      template_type: 'newsletter',
      channel: 'email',
      content: JSON.stringify({
        version: 1,
        subject: 'News and updates from {{practice.name}}',
        sections: [{
          id: 'practice-announcement',
          blocks: [
            { id: 'announcement-title', type: 'heading', properties: { text: 'A Note from Our Practice', level: 'h1' } },
            { id: 'announcement-copy', type: 'paragraph', properties: { text: 'Hello {{patient.firstName}}, we have an update to share with you. Add your practice news here before sending.' } },
            { id: 'announcement-contact', type: 'paragraph', properties: { text: 'For questions, call {{practice.phone}} or visit {{practice.website}}.' } },
            { id: 'announcement-footer', type: 'footer', properties: { text: '{{practice.name}} · {{practice.address}}' } }
          ]
        }]
      }),
      variables: JSON.stringify(['patient.firstName', 'practice.name', 'practice.phone', 'practice.website', 'practice.address']),
      status: 'published',
      is_system: true,
      version: 1
    },
    {
      category_slug: 'newsletters',
      name: 'Seasonal Dental Tips',
      description: 'Seasonal reminders for keeping your smile healthy',
      template_type: 'newsletter',
      channel: 'email',
      content: JSON.stringify({
        version: 1,
        subject: 'A few seasonal tips for your smile',
        sections: [{
          id: 'seasonal-tips',
          blocks: [
            { id: 'seasonal-title', type: 'heading', properties: { text: 'Care for Your Smile This Season', level: 'h1' } },
            { id: 'seasonal-copy', type: 'paragraph', properties: { text: 'Hi {{patient.firstName}}, changing routines can make daily oral care easy to overlook.' } },
            { id: 'seasonal-tip', type: 'paragraph', properties: { text: 'Keep a toothbrush and floss with your travel essentials, drink water throughout the day, and enjoy treats in moderation.' } },
            { id: 'seasonal-footer', type: 'footer', properties: { text: 'Warm wishes from {{practice.name}} · {{practice.phone}}' } }
          ]
        }]
      }),
      variables: JSON.stringify(['patient.firstName', 'practice.name', 'practice.phone']),
      status: 'published',
      is_system: true,
      version: 1
    },
    {
      category_slug: 'newsletters',
      name: 'New Services Announcement',
      description: 'Introduce a new service offered by your practice',
      template_type: 'newsletter',
      channel: 'email',
      content: JSON.stringify({
        version: 1,
        subject: 'Discover what’s new at {{practice.name}}',
        sections: [{
          id: 'new-services',
          blocks: [
            { id: 'services-title', type: 'heading', properties: { text: 'A New Service for Our Patients', level: 'h1' } },
            { id: 'services-copy', type: 'paragraph', properties: { text: 'Hello {{patient.firstName}}, we are pleased to share that our practice has a new service. Add the service details and eligibility information here.' } },
            { id: 'services-link', type: 'button', properties: { text: 'Learn More', url: '{{practice.website}}', alignment: 'center' } },
            { id: 'services-footer', type: 'footer', properties: { text: 'Contact {{practice.name}} at {{practice.phone}} for details.' } }
          ]
        }]
      }),
      variables: JSON.stringify(['patient.firstName', 'practice.name', 'practice.phone', 'practice.website']),
      status: 'published',
      is_system: true,
      version: 1
    },
    {
      category_slug: 'payment-reminders',
      name: 'Secure Online Payment Request',
      description: 'Modern statement notification with direct secure payment button',
      template_type: 'newsletter',
      channel: 'email',
      content: JSON.stringify({
        version: 1,
        subject: 'Account Statement from {{practice.name}}',
        sections: [
          {
            id: 'sec-1',
            backgroundColor: '#ffffff',
            padding: '20px',
            blocks: [
              { id: 'b-1', type: 'heading', properties: { text: 'Account Balance Notice', level: 'h2', color: '#1e293b', alignment: 'left' } },
              { id: 'b-2', type: 'paragraph', properties: { text: 'Dear {{patient.firstName}}, you have an outstanding balance of {{payment.amount}} due by {{payment.dueDate}}.', color: '#475569' } },
              { id: 'b-3', type: 'button', properties: { text: 'Pay Securely Online', url: '{{practice.website}}', backgroundColor: '#2563eb', color: '#ffffff', alignment: 'center' } }
            ]
          }
        ]
      }),
      variables: JSON.stringify(['patient.firstName', 'practice.name', 'payment.amount', 'payment.dueDate', 'practice.website']),
      status: 'published',
      is_system: true,
      version: 1
    },
    {
      category_slug: 'recall',
      name: 'Preventive Care Recall Notice',
      description: 'Encouraging reminder for routine cleaning and examination',
      template_type: 'newsletter',
      channel: 'email',
      content: JSON.stringify({
        version: 1,
        subject: 'Time for your routine dental checkup at {{practice.name}}',
        sections: [
          {
            id: 'sec-1',
            backgroundColor: '#ffffff',
            padding: '20px',
            blocks: [
              { id: 'b-1', type: 'image', properties: { url: 'https://images.unsplash.com/photo-1606811841689-23dfddce6395?w=800&auto=format&fit=crop&q=60', alt: 'Dental Checkup', alignment: 'center' } },
              { id: 'b-2', type: 'heading', properties: { text: 'Keep Your Smile Healthy & Bright', level: 'h2', color: '#1e293b', alignment: 'left' } },
              { id: 'b-3', type: 'paragraph', properties: { text: 'Hello {{patient.firstName}}, it has been 6 months since your last visit. Routine cleanings are essential for preventing cavities and gum disease.', color: '#475569' } },
              { id: 'b-4', type: 'button', properties: { text: 'Schedule Appointment', url: '{{practice.website}}', backgroundColor: '#2563eb', color: '#ffffff', alignment: 'center' } }
            ]
          }
        ]
      }),
      variables: JSON.stringify(['patient.firstName', 'practice.name', 'practice.website']),
      status: 'published',
      is_system: true,
      version: 1
    },
    {
      category_slug: 'referrals',
      name: 'Patient Referral Program Invitation',
      description: 'Inviting patients to refer friends and family',
      template_type: 'newsletter',
      channel: 'email',
      content: JSON.stringify({
        version: 1,
        subject: 'Share the Smile — Refer a Friend to {{practice.name}}',
        sections: [
          {
            id: 'sec-1',
            backgroundColor: '#ffffff',
            padding: '20px',
            blocks: [
              { id: 'b-1', type: 'image', properties: { url: 'https://images.unsplash.com/photo-1543353071-10c8ba85a904?w=800&auto=format&fit=crop&q=60', alt: 'Friends Smiling', alignment: 'center' } },
              { id: 'b-2', type: 'heading', properties: { text: 'Give $25, Get $25', level: 'h2', color: '#1e293b', alignment: 'left' } },
              { id: 'b-3', type: 'paragraph', properties: { text: 'Hi {{patient.firstName}}, love your visits with us? Share the care with your friends and family!', color: '#475569' } },
              { id: 'b-4', type: 'button', properties: { text: 'Share Referral Link', url: '{{practice.website}}', backgroundColor: '#2563eb', color: '#ffffff', alignment: 'center' } }
            ]
          }
        ]
      }),
      variables: JSON.stringify(['patient.firstName', 'practice.name', 'practice.website']),
      status: 'published',
      is_system: true,
      version: 1
    },
    {
      category_slug: 'surveys',
      name: 'Post-Visit Experience Survey',
      description: 'Elegant post-appointment feedback invitation',
      template_type: 'survey',
      channel: 'email',
      content: JSON.stringify({
        version: 1,
        title: 'How was your recent visit at {{practice.name}}?',
        description: 'Your feedback helps us provide the best possible care.',
        questions: [
          { id: 'q1', text: 'How would you rate your comfort during your visit?', type: 'rating', required: true },
          { id: 'q2', text: 'Did our team address all your questions?', type: 'boolean', required: true },
          { id: 'q3', text: 'Any comments or suggestions?', type: 'text', required: false }
        ]
      }),
      variables: JSON.stringify(['patient.firstName', 'practice.name']),
      status: 'published',
      is_system: true,
      version: 1
    },
    {
      category_slug: 'connect',
      name: 'Welcome & Two-Way Texting Intro',
      description: 'Introduction to text messaging with the practice',
      template_type: 'sms',
      channel: 'sms',
      content: JSON.stringify({
        version: 1,
        sections: [
          {
            id: 'sec-1',
            blocks: [
              { id: 'b-1', type: 'paragraph', properties: { text: 'Welcome to {{practice.name}}, {{patient.firstName}}! You can text us anytime at this number for appointments, questions, or assistance.' } }
            ]
          }
        ]
      }),
      variables: JSON.stringify(['patient.firstName', 'practice.name']),
      status: 'published',
      is_system: true,
      version: 1
    }
  ];

  const confirmationOnly = process.argv.includes('--appointment-confirmation-only');
  for (const s of samples) {
    if (confirmationOnly && s.name !== '24-Hour Appointment Reminder (EMAIL)') continue;
    const category_id = catMap.get(s.category_slug);
    if (category_id) {
      const [existing] = await sql`
        SELECT id FROM templates
        WHERE category_id = ${category_id} AND name = ${s.name} AND is_system = true
        LIMIT 1
      `;
      if (existing) continue;
      await sql`
        INSERT INTO templates (category_id, name, description, template_type, channel, content, variables, status, is_system, version)
        VALUES (${category_id}, ${s.name}, ${s.description}, ${s.template_type}, ${s.channel}, ${s.content}::jsonb, ${s.variables}::jsonb, ${s.status}, ${s.is_system}, ${s.version})
      `;
    }
  }

  console.log('Successfully added missing block-based system templates.');
  process.exit(0);
}

main().catch(err => {
  console.error('Seed error:', err);
  process.exit(1);
});
