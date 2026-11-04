import 'server-only';
import { fetchOpenDental } from './client';
import { OpenDentalAppointment, OpenDentalQueryParams } from './types';

export async function getOpenDentalAppointments(
  developerKey: string,
  customerKey: string,
  params?: OpenDentalQueryParams
): Promise<OpenDentalAppointment[]> {
  return fetchOpenDental<OpenDentalAppointment[]>(developerKey, customerKey, 'appointments', {
    params: params as Record<string, string | number>,
  });
}

export async function getOpenDentalAppointment(
  developerKey: string,
  customerKey: string,
  appointmentNumber: number
): Promise<OpenDentalAppointment> {
  return fetchOpenDental<OpenDentalAppointment>(
    developerKey,
    customerKey,
    `appointments/${appointmentNumber}`
  );
}

export async function confirmOpenDentalAppointment(
  developerKey: string,
  customerKey: string,
  appointmentNumber: number
): Promise<void> {
  await fetchOpenDental<unknown>(
    developerKey,
    customerKey,
    `appointments/${appointmentNumber}/Confirm`,
    {
      method: 'PUT',
      body: { confirmVal: 'Confirmed' },
      allowEmptyResponse: true,
    }
  );
}
