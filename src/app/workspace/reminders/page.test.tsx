import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/feedback/ToastProvider/ToastProvider';
import RemindersPage from './page';

const practiceId = 'c678c32c-2eeb-47ae-95ff-3938bc40e54b';

describe('RemindersPage', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
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
            upcomingAppointments: [{
              appointmentId: 'appointment-1',
              patientName: 'Jordan Sample',
              scheduledAt: '2026-11-15T12:00:00.000Z',
              smsEligible: false,
              emailEligible: true,
            }],
            schedules: [{
              id: 'schedule-1',
              name: 'Email reminder',
              interval: '24_hours',
              channel: 'email',
              localSendTime: '09:00',
              templateId: 'template-1',
              templateName: 'Appointment reminder',
              enabled: true,
            }, {
              id: 'schedule-2',
              name: 'SMS reminder',
              interval: '3_days',
              channel: 'sms',
              localSendTime: '09:00',
              templateId: 'template-2',
              templateName: 'Appointment SMS',
              enabled: true,
            }, {
              id: 'schedule-3',
              name: 'Disabled reminder',
              interval: '7_days',
              channel: 'email',
              localSendTime: '10:00',
              templateId: 'template-3',
              templateName: 'Disabled appointment reminder',
              enabled: false,
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
              smsEligible: false,
              emailEligible: true,
            }, {
              appointmentId: 'appointment-1',
              patientId: 'patient-1',
              patientName: 'Jordan Sample',
              scheduledAt: '2026-11-15T12:00:00.000Z',
              appointmentStatus: 'Scheduled',
              description: 'Cleaning',
              scheduleId: 'schedule-2',
              scheduleName: 'SMS reminder',
              interval: '3_days',
              channel: 'sms',
              reminderAt: '2026-11-12T12:00:00.000Z',
              reminderStatus: 'failed',
              lastErrorMessage: null,
              eligible: false,
              smsEligible: false,
              emailEligible: true,
            }],
            history: [{
              id: 'reminder-history-1',
              patientName: 'Jordan Sample',
              appointmentAt: '2026-11-15T12:00:00.000Z',
              scheduleName: 'Email reminder',
              channel: 'email',
              status: 'sent',
              attemptCount: 1,
              attemptedAt: '2026-11-14T12:00:00.000Z',
              sentAt: '2026-11-14T12:00:01.000Z',
              deliveredAt: null,
              providerMessageId: 'provider-message-1',
              lastErrorMessage: null,
              scheduledFor: '2026-11-14T12:00:00.000Z',
              manual: false,
            }],
            stats: { scheduled: 1, attempted: 0, sent: 1, delivered: 0, failed: 0, skipped: 0 },
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

    expect(await screen.findByRole('heading', { name: 'Upcoming appointments' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Reminder templates' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'New reminder' })).toBeTruthy();
    expect(screen.queryByText('Provider status:')).toBeNull();
    expect(screen.queryByRole('tab', { name: 'Calendar' })).toBeNull();
    expect(screen.queryByRole('region', { name: 'Reminder report' })).toBeNull();
    const appointmentMetrics = screen.getByRole('region', { name: 'Appointment metrics' });
    expect(within(appointmentMetrics).getByText('Today')).toBeTruthy();
    expect(within(appointmentMetrics).getByText('Tomorrow')).toBeTruthy();
    expect(within(appointmentMetrics).getByText('Next 7 days')).toBeTruthy();
    expect(within(appointmentMetrics).getByText('This month')).toBeTruthy();
    expect(screen.queryByLabelText('Scheduled date')).toBeNull();
    expect(screen.queryByLabelText('Patient search')).toBeNull();
    const appointmentRow = screen.getByRole('article');
    expect(within(appointmentRow).getByText('Jordan Sample')).toBeTruthy();
    expect(within(appointmentRow).getByText('Nov 15, 2026, 5:30 PM')).toBeTruthy();
    expect(within(appointmentRow).getByTitle('SMS unavailable or opted out')).toBeTruthy();
    expect(within(appointmentRow).getByTitle('Email consent and address available')).toBeTruthy();

    fireEvent.click(screen.getByRole('tab', { name: 'Scheduled reminders' }));
    expect(await screen.findByRole('heading', { name: 'Scheduled reminders' })).toBeTruthy();
    expect(screen.getByLabelText('Scheduled date')).toBeTruthy();
    expect(screen.getByLabelText('Schedule')).toBeTruthy();
    expect(screen.getByLabelText('Channel')).toBeTruthy();
    expect(screen.getByLabelText('Status')).toBeTruthy();
    expect(screen.getByLabelText('Patient search')).toBeTruthy();
    expect(screen.queryByLabelText('Audience')).toBeNull();
    const scheduledTable = screen.getByRole('table');
    expect(within(scheduledTable).getAllByRole('row', { name: /Jordan Sample/ })).toHaveLength(2);
    expect(within(scheduledTable).getByRole('row', { name: /Jordan Sample.*Email reminder/ })).toBeTruthy();
    expect(within(scheduledTable).queryByRole('columnheader', { name: 'Actions' })).toBeNull();
    expect(within(scheduledTable).queryByRole('button', { name: /Preview|Send now/ })).toBeNull();
    fireEvent.change(screen.getByLabelText('Channel'), { target: { value: 'email' } });
    expect(screen.getAllByRole('row', { name: /Jordan Sample/ })).toHaveLength(1);
    expect(screen.getByRole('row', { name: /Jordan Sample.*Email reminder/ })).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Channel'), { target: { value: 'all' } });
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'failed' } });
    expect(screen.getAllByRole('row', { name: /Jordan Sample/ })).toHaveLength(1);
    expect(screen.getByRole('row', { name: /Jordan Sample.*SMS reminder/ })).toBeTruthy();

    fireEvent.click(screen.getByRole('tab', { name: 'Delivery history' }));
    expect(await screen.findByRole('heading', { name: 'Delivery history' })).toBeTruthy();
    expect(screen.getByText('provider-message-1')).toBeTruthy();

    fireEvent.click(screen.getByRole('tab', { name: 'Reports' }));
    const report = await screen.findByRole('region', { name: 'Reminder report' });
    expect(within(report).getByText('Scheduled')).toBeTruthy();
    expect(within(report).getByText('Sent')).toBeTruthy();

    fireEvent.click(screen.getByRole('tab', { name: 'Reminder settings' }));
    const disabledScheduleCard = screen.getByRole('heading', { name: 'Disabled reminder' }).closest('article');
    expect(disabledScheduleCard).not.toBeNull();
    expect(within(disabledScheduleCard as HTMLElement).getByText('Disabled')).toBeTruthy();
    expect(within(disabledScheduleCard as HTMLElement).queryByText('Paused')).toBeNull();
    fireEvent.click(within(disabledScheduleCard as HTMLElement).getByRole('button', { name: 'Edit Disabled reminder' }));
    const disabledScheduleDialog = screen.getByRole('dialog', { name: 'Edit reminder schedule' });
    const disabledScheduleCheckbox = within(disabledScheduleDialog).getByRole('checkbox', { name: /Enable scheduled reminders/ });
    expect((disabledScheduleCheckbox as HTMLInputElement).checked).toBe(false);
    fireEvent.click(within(disabledScheduleDialog).getByRole('button', { name: 'Cancel' }));

    const emailScheduleCard = screen.getByRole('heading', { name: 'Email reminder' }).closest('article');
    expect(emailScheduleCard).not.toBeNull();
    expect(within(emailScheduleCard as HTMLElement).getByText(/24 hours before.*EMAIL.*09:00 local.*Template: Appointment reminder.*All eligible appointments/)).toBeTruthy();
    expect(within(emailScheduleCard as HTMLElement).getByText('Enabled')).toBeTruthy();
    expect(within(emailScheduleCard as HTMLElement).queryByRole('button', { name: 'Pause' })).toBeNull();
    expect(within(emailScheduleCard as HTMLElement).queryByRole('button', { name: 'Enable' })).toBeNull();
    expect(within(emailScheduleCard as HTMLElement).getByRole('button', { name: 'Remove Email reminder' })).toBeTruthy();
    fireEvent.click(within(emailScheduleCard as HTMLElement).getByRole('button', { name: 'Edit Email reminder' }));
    const scheduleDialog = screen.getByRole('dialog', { name: 'Edit reminder schedule' });
    const enableScheduleCheckbox = within(scheduleDialog).getByRole('checkbox', { name: /Enable scheduled reminders/ });
    expect((enableScheduleCheckbox as HTMLInputElement).checked).toBe(true);
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

  it('filters upcoming appointments by date range even when no reminder schedules are configured', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-13T12:00:00.000Z'));
    localStorage.setItem('selectedClinicId', practiceId);
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith('/api/appointment-reminders?')) {
        return Response.json({
          data: {
            practice: { name: 'Sample Practice', timezone: 'UTC' },
            sampleDataResetAvailable: false,
            schedules: [],
            upcoming: [],
            upcomingAppointments: [
              ['today', 'Today Patient', '2026-11-13T13:00:00.000Z'],
              ['tomorrow', 'Tomorrow Patient', '2026-11-14T13:00:00.000Z'],
              ['last-day-of-next-seven', 'Last Day Patient', '2026-11-19T13:00:00.000Z'],
              ['outside-next-seven', 'Outside Seven Patient', '2026-11-20T13:00:00.000Z'],
              ['month-end', 'Month End Patient', '2026-11-30T13:00:00.000Z'],
              ['next-month', 'Next Month Patient', '2026-12-01T13:00:00.000Z'],
            ].map(([appointmentId, patientName, scheduledAt]) => ({
              appointmentId,
              patientName,
              scheduledAt,
              smsEligible: true,
              emailEligible: true,
            })),
            history: [],
            stats: { scheduled: 0, attempted: 0, sent: 0, delivered: 0, failed: 0, skipped: 0 },
            providerAvailability: { sms: false, email: false },
          },
        });
      }
      if (url.startsWith('/api/appointment-reminders/templates?')) return Response.json({ data: [] });
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <ToastProvider>
        <RemindersPage />
      </ToastProvider>,
    );

    expect(await screen.findByText('Today Patient')).toBeTruthy();
    const rangeSelect = screen.getByLabelText('Show');
    expect((rangeSelect as HTMLSelectElement).value).toBe('thisMonth');
    expect(screen.getByText('Tomorrow Patient')).toBeTruthy();
    expect(screen.getByText('Last Day Patient')).toBeTruthy();
    expect(screen.getByText('Outside Seven Patient')).toBeTruthy();
    expect(screen.getByText('Month End Patient')).toBeTruthy();
    expect(screen.queryByText('Next Month Patient')).toBeNull();

    fireEvent.change(rangeSelect, { target: { value: 'today' } });
    expect(screen.getByText('Today Patient')).toBeTruthy();
    expect(screen.queryByText('Tomorrow Patient')).toBeNull();

    fireEvent.change(rangeSelect, { target: { value: 'tomorrow' } });
    expect(screen.getByText('Tomorrow Patient')).toBeTruthy();
    expect(screen.queryByText('Today Patient')).toBeNull();

    fireEvent.change(rangeSelect, { target: { value: 'next7' } });
    expect(screen.getByText('Last Day Patient')).toBeTruthy();
    expect(screen.queryByText('Outside Seven Patient')).toBeNull();

    fireEvent.change(rangeSelect, { target: { value: 'thisMonth' } });
    expect(screen.getByText('Month End Patient')).toBeTruthy();
    expect(screen.getByText('Outside Seven Patient')).toBeTruthy();
    expect(screen.queryByText('Next Month Patient')).toBeNull();
    expect(screen.queryByText('No upcoming appointments')).toBeNull();
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
            upcomingAppointments: [],
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

    await screen.findByRole('heading', { name: 'Upcoming appointments' });
    fireEvent.click(screen.getByRole('tab', { name: 'Reminder settings' }));
    fireEvent.click(within(screen.getByRole('tabpanel')).getByRole('button', { name: 'New reminder' }));
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
