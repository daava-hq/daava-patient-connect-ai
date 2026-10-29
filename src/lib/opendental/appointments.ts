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
