import { NextRequest, NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { getOpenDentalAppointments } from '@/lib/opendental/appointments';
import { getOpenDentalPatients } from '@/lib/opendental/patients';
import {
  getOpenDentalProviders,
  getOpenDentalOperatories,
  buildCalendarColumns,
} from '@/lib/opendental/providers';
import {
  CalendarColumn,
  OpenDentalAppointment,
  OpenDentalPatientDetails,
  OpenDentalProvider,
} from '@/lib/opendental/types';
import { fetchOpenDental } from '@/lib/opendental/client';
import { db } from '@/db';
import { practices } from '@/db/schema/practices';
import { practiceOpendentalCredentials } from '@/db/schema/practice_credentials';
import { eq } from 'drizzle-orm';
import { decrypt } from '@/lib/opendental/crypto';

// In-memory cache for providers, operatories, and patient details (valid for 2 minutes)
interface CachedData {
  timestamp: number;
  columns: CalendarColumn[];
  patientFullMap: Map<number, OpenDentalPatientDetails>;
  providerMap: Map<number, OpenDentalProvider>;
}

let cache: CachedData | null = null;
const CACHE_TTL_MS = 2 * 60 * 1000;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    let practiceId = searchParams.get('practiceId');

    if (!practiceId) {
      const [defaultPractice] = await db
        .select({ id: practices.id })
        .from(practices)
        .limit(1);
      practiceId = defaultPractice?.id || 'c678c32c-2eeb-47ae-95ff-3938bc40e54b';
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const date = searchParams.get('date') || todayStr;
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const refresh = searchParams.get('refresh') === 'true';

    const [creds] = await db
      .select()
      .from(practiceOpendentalCredentials)
      .where(eq(practiceOpendentalCredentials.practiceId, practiceId))
      .limit(1);

    if (!creds) {
      return NextResponse.json(
        { error: 'Open Dental integration keys have not been added for this practice. Please configure them in Practice Settings.' },
        { status: 400 }
      );
    }

    const devKey = decrypt(creds.developerKeyEnc);
    const custKey = decrypt(creds.customerKeyEnc);

    const apptParams: Record<string, string | number> = {
      Offset: offset,
      date: date,
    };

    // Check if cache is still valid
    const isCacheValid = !refresh && cache && Date.now() - cache.timestamp < CACHE_TTL_MS;

    let columns: CalendarColumn[] = [];
    let patientFullMap = new Map<number, OpenDentalPatientDetails>();
    let providerMap = new Map<number, OpenDentalProvider>();

    if (isCacheValid && cache) {
      columns = cache.columns;
      patientFullMap = cache.patientFullMap;
      providerMap = cache.providerMap;
    } else {
      try {
        const [providersRes, operatoriesRes, patientsRes] = await Promise.allSettled([
          getOpenDentalProviders(devKey, custKey),
          getOpenDentalOperatories(devKey, custKey),
          getOpenDentalPatients(devKey, custKey, { Limit: 200 }),
        ]);

        const providers = providersRes.status === 'fulfilled' ? providersRes.value : [];
        const operatories = operatoriesRes.status === 'fulfilled' ? operatoriesRes.value : [];
        const patients = patientsRes.status === 'fulfilled' ? patientsRes.value : [];

        columns = buildCalendarColumns(providers, operatories);

        patientFullMap = new Map(
          patients.map((p) => [Number(p.PatNum), p as OpenDentalPatientDetails])
        );

        providerMap = new Map(
          providers.map((p) => [Number(p.ProvNum), p])
        );

        cache = {
          timestamp: Date.now(),
          columns,
          patientFullMap,
          providerMap,
        };
      } catch (metaErr) {
        if (cache) {
          columns = cache.columns;
          patientFullMap = cache.patientFullMap;
          providerMap = cache.providerMap;
        }
      }
    }

    const rawAppointments = await getOpenDentalAppointments(devKey, custKey, apptParams);

    // Fetch diseases for the unique patients with appointments
    const distinctPatNums = Array.from(
      new Set(rawAppointments.map((a) => Number(a.PatNum)).filter((num) => num > 0))
    );

    const diseaseEntries = await Promise.all(
      distinctPatNums.map(async (patNum): Promise<[number, string[]]> => {
        try {
          const diseases = await fetchOpenDental<Array<{ diseaseDefName?: string }>>(
            devKey,
            custKey,
            'diseases',
            { params: { PatNum: patNum } }
          );
          const diseaseNames = Array.isArray(diseases)
            ? diseases.map((d) => d.diseaseDefName || '').filter(Boolean)
            : [];
          return [patNum, diseaseNames];
        } catch {
          return [patNum, []];
        }
      })
    );
    const diseaseMap = new Map<number, string[]>(diseaseEntries);

    // Enrich appointments with patient details, diseases, and proper provider abbreviation
    const enrichedAppointments: OpenDentalAppointment[] = (rawAppointments || []).map((appt) => {
      const patNum = Number(appt.PatNum);
      const patient = patientFullMap.get(patNum);
      const patientName = patient
        ? `${patient.LName}, ${patient.FName}`.trim()
        : patNum
        ? `Patient #${patNum}`
        : '';
      const durationMinutes =
        typeof appt.Pattern === 'string' && appt.Pattern.length > 0
          ? appt.Pattern.length * 5
          : 30;

      // Determine best provider abbreviation (if hygiene appointment, prefer hygienist provider's Abbr)
      const isHygiene = appt.IsHygiene === 'true' || appt.IsHygiene === true;
      let effectiveProvAbbr = appt.provAbbr;
      if (isHygiene && appt.ProvHyg && providerMap.has(Number(appt.ProvHyg))) {
        effectiveProvAbbr = providerMap.get(Number(appt.ProvHyg))?.Abbr || appt.provAbbr;
      } else if (appt.ProvNum && providerMap.has(Number(appt.ProvNum))) {
        effectiveProvAbbr = providerMap.get(Number(appt.ProvNum))?.Abbr || appt.provAbbr;
      }

      const diseases = diseaseMap.get(patNum) || [];

      return {
        ...appt,
        provAbbr: effectiveProvAbbr,
        patientName,
        durationMinutes,
        patientDetails: patient,
        diseases,
      };
    });

    return NextResponse.json(
      {
        data: enrichedAppointments,
        columns,
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

