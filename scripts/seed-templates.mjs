import postgres from 'postgres';
import 'dotenv/config';

const sql = postgres(process.env.DATABASE_URL || 'postgresql://premkumark@localhost:5432/patient_connect2');

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

  // Clear existing system templates to re-seed with block structures
  await sql`DELETE FROM templates WHERE is_system = true`;

  const samples = [
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
              { id: 'b-1', type: 'paragraph', properties: { text: 'Hi {{patient.firstName}}, this is a reminder from {{practice.name}} for your appointment tomorrow at {{appointment.time}} with {{appointment.provider}}. Reply C to confirm.' } }
            ]
          }
        ]
      }),
      variables: JSON.stringify(['patient.firstName', 'practice.name', 'appointment.time', 'appointment.provider']),
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
              { id: 'b-3', type: 'paragraph', properties: { text: 'Dear {{patient.firstName}}, your visit is confirmed for {{appointment.date}} at {{appointment.time}} with {{appointment.provider}}.', color: '#475569' } },
              { id: 'b-4', type: 'button', properties: { text: 'View Appointment Details', url: '{{practice.website}}', backgroundColor: '#2563eb', color: '#ffffff', alignment: 'center' } },
              { id: 'b-5', type: 'paragraph', properties: { text: 'Please call us at {{practice.phone}} if you need to reschedule.', color: '#64748b' } }
            ]
          }
        ]
      }),
      variables: JSON.stringify(['patient.firstName', 'practice.name', 'appointment.date', 'appointment.time', 'appointment.provider', 'practice.website', 'practice.phone']),
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

  for (const s of samples) {
    const category_id = catMap.get(s.category_slug);
    if (category_id) {
      await sql`
        INSERT INTO templates (category_id, name, description, template_type, channel, content, variables, status, is_system, version)
        VALUES (${category_id}, ${s.name}, ${s.description}, ${s.template_type}, ${s.channel}, ${s.content}::jsonb, ${s.variables}::jsonb, ${s.status}, ${s.is_system}, ${s.version})
      `;
    }
  }

  console.log('Successfully seeded block-based system templates.');
  process.exit(0);
}

main().catch(err => {
  console.error('Seed error:', err);
  process.exit(1);
});
