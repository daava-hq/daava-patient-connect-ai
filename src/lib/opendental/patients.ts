import 'server-only';
import { fetchOpenDental } from './client';
import { OpenDentalPatient, OpenDentalQueryParams } from './types';

export async function getOpenDentalPatients(
  developerKey: string,
  customerKey: string,
  params?: OpenDentalQueryParams
): Promise<OpenDentalPatient[]> {
  return fetchOpenDental<OpenDentalPatient[]>(developerKey, customerKey, 'patients/Simple', {
    params: params as Record<string, string | number>,
  });
}
