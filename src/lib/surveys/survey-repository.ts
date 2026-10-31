import 'server-only';
import { db } from '@/db';
import { surveys, surveyResponses, Survey, NewSurvey, NewSurveyResponse } from '@/db/schema/surveys';
import { eq, and, isNull, desc } from 'drizzle-orm';
import { NotFoundError } from '@/lib/errors';

export async function getPracticeSurveys(practiceId: string) {
  return db
    .select()
    .from(surveys)
    .where(and(eq(surveys.practiceId, practiceId), isNull(surveys.deletedAt)))
    .orderBy(desc(surveys.createdAt));
}

export async function createSurvey(data: NewSurvey): Promise<Survey> {
  const [survey] = await db.insert(surveys).values(data).returning();
  return survey;
}

export async function submitSurveyResponse(data: NewSurveyResponse) {
  const [response] = await db.insert(surveyResponses).values(data).returning();
  return response;
}

export async function getSurveyResponses(surveyId: string) {
  return db
    .select()
    .from(surveyResponses)
    .where(eq(surveyResponses.surveyId, surveyId))
    .orderBy(desc(surveyResponses.submittedAt));
}
