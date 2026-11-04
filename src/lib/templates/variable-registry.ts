export interface TemplateVariableDefinition {
  key: string;
  label: string;
  category: 'patient' | 'practice' | 'appointment' | 'other';
  description: string;
  example: string;
}

export const VARIABLE_REGISTRY: TemplateVariableDefinition[] = [
  // Patient
  { key: 'patient.firstName', label: 'Patient First Name', category: 'patient', description: "Patient's first name", example: 'Jane' },
  { key: 'patient.lastName', label: 'Patient Last Name', category: 'patient', description: "Patient's last name", example: 'Doe' },
  { key: 'patient.fullName', label: 'Patient Full Name', category: 'patient', description: "Patient's full name", example: 'Jane Doe' },
  { key: 'patient.email', label: 'Patient Email', category: 'patient', description: "Patient's email address", example: 'jane@example.com' },
  { key: 'patient.phone', label: 'Patient Phone', category: 'patient', description: "Patient's mobile phone", example: '(555) 019-2834' },
  { key: 'patient.birthDate', label: 'Patient Birth Date', category: 'patient', description: "Patient's date of birth", example: '1990-05-12' },

  // Practice
  { key: 'practice.name', label: 'Practice Name', category: 'practice', description: 'Dental practice name', example: 'Smile Dental Care' },
  { key: 'practice.phone', label: 'Practice Phone', category: 'practice', description: 'Practice phone number', example: '(555) 839-2010' },
  { key: 'practice.email', label: 'Practice Email', category: 'practice', description: 'Practice email address', example: 'contact@smiledental.com' },
  { key: 'practice.address', label: 'Practice Address', category: 'practice', description: 'Physical address', example: '123 Main St, Suite 400' },
  { key: 'practice.website', label: 'Practice Website', category: 'practice', description: 'Practice website URL', example: 'https://smiledental.com' },

  // Appointment
  { key: 'appointment.date', label: 'Appointment Date', category: 'appointment', description: 'Scheduled date of visit', example: 'November 15, 2026' },
  { key: 'appointment.time', label: 'Appointment Time', category: 'appointment', description: 'Scheduled time of visit', example: '10:30 AM' },
  { key: 'appointment.provider', label: 'Provider Name', category: 'appointment', description: 'Treating dentist or hygienist', example: 'Dr. Smith, DDS' },
  { key: 'appointment.status', label: 'Appointment Status', category: 'appointment', description: 'Current status of appointment', example: 'Confirmed' },
  { key: 'appointment.confirmUrl', label: 'Appointment Confirmation Link', category: 'appointment', description: 'Secure link for the patient to confirm this appointment', example: 'https://patient.example.com/appointment-confirmation?token=preview' },

  // Other
  { key: 'campaign.name', label: 'Campaign Name', category: 'other', description: 'Name of outreach campaign', example: 'Fall Hygiene Recall' },
  { key: 'recall.dueDate', label: 'Recall Due Date', category: 'other', description: 'Preventive recall due date', example: 'December 1, 2026' },
  { key: 'payment.amount', label: 'Payment Amount', category: 'other', description: 'Outstanding balance amount', example: '$150.00' },
  { key: 'payment.dueDate', label: 'Payment Due Date', category: 'other', description: 'Payment due date', example: 'November 30, 2026' },
  { key: 'referral.practiceName', label: 'Referred To Practice', category: 'other', description: 'Specialist or referral recipient', example: 'Apex Oral Surgery' },
];

export function validateTemplateVariables(contentStr: string, providedVariables: string[]): { isValid: boolean; unresolved: string[] } {
  const matches = contentStr.match(/\{\{([^}]+)\}\}/g) || [];
  const usedKeys = Array.from(new Set(matches.map((m) => m.slice(2, -2).trim())));
  const unresolved = usedKeys.filter((key) => !providedVariables.includes(key));
  return {
    isValid: unresolved.length === 0,
    unresolved,
  };
}
