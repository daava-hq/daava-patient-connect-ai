import 'server-only';
import { fetchOpenDental } from './client';
import {
  OpenDentalProvider,
  OpenDentalOperatory,
  CalendarColumn,
  OpenDentalQueryParams,
} from './types';

export async function getOpenDentalProviders(
  developerKey: string,
  customerKey: string,
  params?: OpenDentalQueryParams
): Promise<OpenDentalProvider[]> {
  return fetchOpenDental<OpenDentalProvider[]>(developerKey, customerKey, 'providers', {
    params: params as Record<string, string | number>,
  });
}

export async function getOpenDentalOperatories(
  developerKey: string,
  customerKey: string,
  params?: OpenDentalQueryParams
): Promise<OpenDentalOperatory[]> {
  return fetchOpenDental<OpenDentalOperatory[]>(developerKey, customerKey, 'operatories', {
    params: params as Record<string, string | number>,
  });
}

export function displayName(provider: OpenDentalProvider, role?: 'Doctor' | 'Hygienist'): string {
  const isDoctor = role === 'Doctor' || provider.Suffix === 'DMD' || provider.Suffix === 'DDS';
  const prefix = isDoctor ? 'Dr. ' : '';
  const first = provider.FName || '';
  const last = provider.LName || '';
  const fullName = `${first} ${last}`.trim();
  return `${prefix}${fullName}`.trim() || provider.Abbr || '';
}

export function shortName(provider: OpenDentalProvider, role?: 'Doctor' | 'Hygienist'): string {
  const firstInitial = provider.FName ? `${provider.FName.charAt(0)}. ` : '';
  const last = provider.LName || '';
  return `${firstInitial}${last}`.trim() || provider.Abbr || '';
}

export function buildCalendarColumns(
  providers: OpenDentalProvider[],
  operatories: OpenDentalOperatory[]
): CalendarColumn[] {
  // Build a fast lookup map of active providers by ProvNum:
  const providerByNum = new Map(
    providers
      .filter((p) => {
        const isHidden = p.IsHidden === true || p.IsHidden === 'true';
        const isActive = !p.ProvStatus || p.ProvStatus === 'Active';
        return !isHidden && isActive;
      })
      .map((p) => [Number(p.ProvNum), p])
  );

  return operatories
    .filter((op) => {
      const isHidden = op.IsHidden === true || op.IsHidden === 'true';
      return !isHidden;
    })
    .sort((a, b) => Number(a.ItemOrder ?? 0) - Number(b.ItemOrder ?? 0))
    .flatMap((operatory) => {
      // 1. Determine role: Is this a hygiene chair or a doctor chair?
      const isHygiene = operatory.IsHygiene === true || operatory.IsHygiene === 'true';
      const role: 'Doctor' | 'Hygienist' = isHygiene ? 'Hygienist' : 'Doctor';

      // 2. Resolve the foreign key to the provider:
      const rawProvNum = role === 'Hygienist' ? operatory.ProvHygienist : operatory.ProvDentist;
      const providerNum = Number(rawProvNum ?? 0);
      const provider = providerByNum.get(providerNum);
      const operatoryNum = Number(operatory.OperatoryNum);

      if (operatoryNum <= 0) return [];

      // 3. Construct unified calendar column definition:
      if (provider) {
        const resolvedShortName =
          role === 'Doctor' ? shortName(provider, role) : operatory.OpName || shortName(provider, role);

        return [
          {
            id: `provider-${providerNum}-operatory-${operatoryNum}`,
            name: displayName(provider, role),
            shortName: resolvedShortName,
            providerNum,
            operatoryNum,
            operatoryName: operatory.OpName,
            role,
          },
        ];
      }

      // If no provider (e.g. Doctor Overflow)
      return [
        {
          id: `operatory-${operatoryNum}`,
          name: operatory.OpName,
          shortName: operatory.OpName,
          providerNum: 0,
          operatoryNum,
          operatoryName: operatory.OpName,
          role,
        },
      ];
    });
}

export async function getCalendarColumns(
  developerKey: string,
  customerKey: string
): Promise<CalendarColumn[]> {
  const [providers, operatories] = await Promise.all([
    getOpenDentalProviders(developerKey, customerKey),
    getOpenDentalOperatories(developerKey, customerKey),
  ]);

  return buildCalendarColumns(providers, operatories);
}
