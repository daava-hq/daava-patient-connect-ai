import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/feedback/ToastProvider/ToastProvider';
import RemindersPage from './page';

const practiceId = 'c678c32c-2eeb-47ae-95ff-3938bc40e54b';

describe('RemindersPage', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('shows a rendered reminder message in a modal above the schedule dialog', async () => {
    localStorage.setItem('selectedClinicId', practiceId);
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith('/api/appointment-reminders?')) {
        return Response.json({
          data: {
            practice: { name: 'Sample Practice', timezone: 'Asia/Kolkata' },
            sampleDataResetAvailable: false,
            schedules: [{
              id: 'schedule-1',
              name: 'Email reminder',
              interval: '24_hours',
              channel: 'email',
              localSendTime: '09:00',
              templateId: 'template-1',
              templateName: 'Appointment reminder',
              enabled: true,
            }],
            upcoming: [{
              appointmentId: 'appointment-1',
              patientId: 'patient-1',
              patientName: 'Jordan Sample',
              scheduledAt: '2026-11-15T12:00:00.000Z',
              appointmentStatus: 'Scheduled',
              description: 'Cleaning',
              scheduleId: 'schedule-1',
              scheduleName: 'Email reminder',
              interval: '24_hours',
              channel: 'email',
              reminderAt: '2026-11-14T12:00:00.000Z',
              reminderStatus: 'scheduled',
              lastErrorMessage: null,
              eligible: true,
            }],
            history: [],
            stats: { scheduled: 1, attempted: 0, sent: 0, delivered: 0, failed: 0, skipped: 0 },
            providerAvailability: { sms: false, email: true },
          },
        });
      }
      if (url.startsWith('/api/appointment-reminders/templates?')) return Response.json({ data: [] });
      if (url === '/api/appointment-reminders/preview') {
        return Response.json({
          data: {
            templateName: 'Appointment reminder',
            channel: 'email',
            subject: 'Your upcoming appointment',
            body: 'Hello Jordan',
            html: '<html><body><p>Hello Jordan</p></body></html>',
            unresolved: [],
            isValid: true,
          },
        });
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <ToastProvider>
        <RemindersPage />
      </ToastProvider>,
    );

    const report = await screen.findByRole('region', { name: 'Reminder report' });
    expect(within(report).getByText('Scheduled')).toBeTruthy();
    expect(within(report).getByText('1')).toBeTruthy();

    fireEvent.click(await screen.findByRole('button', { name: 'Edit' }));
    const scheduleDialog = screen.getByRole('dialog', { name: 'Edit reminder schedule' });
    expect(within(scheduleDialog).queryByText('Patient groups')).toBeNull();
    fireEvent.click(within(scheduleDialog).getByRole('button', { name: 'Preview message' }));

    const messagePreview = await screen.findByRole('dialog', { name: 'Reminder message preview' });
    expect(within(messagePreview).getByText('Subject:')).toBeTruthy();
    expect(within(messagePreview).getByTitle('Rendered email message preview')).toBeTruthy();

    fireEvent.click(within(messagePreview).getByRole('button', { name: 'Close message preview' }));
    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: 'Edit reminder schedule' })).toBeTruthy();
      expect(screen.queryByRole('dialog', { name: 'Reminder message preview' })).toBeNull();
    });
  });

  it('creates reminder schedules for all eligible appointments without loading patient groups', async () => {
    localStorage.setItem('selectedClinicId', practiceId);
    const template = {
      id: 'template-1',
      name: 'Appointment reminder',
      channel: 'sms',
      templateType: 'sms',
      status: 'published',
      isSystem: true,
      practiceId: null,
    };
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.startsWith('/api/appointment-reminders?')) {
        return Response.json({
          data: {
            practice: { name: 'Sample Practice', timezone: 'UTC' },
            sampleDataResetAvailable: false,
            schedules: [],
            upcoming: [],
            history: [],
            stats: { scheduled: 0, attempted: 0, sent: 0, delivered: 0, failed: 0, skipped: 0 },
            providerAvailability: { sms: true, email: false },
          },
        });
      }
      if (url.startsWith('/api/appointment-reminders/templates?')) return Response.json({ data: [template] });
      if (url === '/api/appointment-reminders' && init?.method === 'POST') {
        return Response.json({ data: { id: 'schedule-1' } }, { status: 201 });
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <ToastProvider>
        <RemindersPage />
      </ToastProvider>,
    );

    await screen.findByRole('region', { name: 'Reminder report' });
    fireEvent.click(screen.getByRole('button', { name: /Configure schedule/ }));
    fireEvent.change(screen.getByLabelText('Schedule name'), { target: { value: 'All-appointments reminder' } });
    const dialog = screen.getByRole('dialog', { name: 'Add reminder schedule' });
    expect(within(dialog).queryByText('Patient groups')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Choose template' }));
    const picker = await screen.findByRole('dialog', { name: 'Appointment reminder templates' });
    fireEvent.click(within(picker).getByRole('button', { name: 'Select' }));
    fireEvent.click(screen.getByRole('button', { name: 'Create schedule' }));

    await waitFor(() => {
      const request = fetchMock.mock.calls.find(
        ([input, request]) => String(input) === '/api/appointment-reminders' && request?.method === 'POST'
      );
      expect(request).toBeDefined();
      const payload = JSON.parse(String(request?.[1]?.body));
      expect(payload).not.toHaveProperty('groupIds');
      expect(fetchMock.mock.calls.some(([input]) => String(input).startsWith('/api/groups/options?'))).toBe(false);
    });
  });
});
