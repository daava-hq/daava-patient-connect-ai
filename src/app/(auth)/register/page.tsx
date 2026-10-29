import { redirect } from 'next/navigation';
import { db } from '@/db';
import { organisations } from '@/db/schema/organisations';
import { eq } from 'drizzle-orm';
import { decodeOrgToken } from '@/lib/auth/register-token';
import RegisterForm from './RegisterForm';

interface Props {
  searchParams: { org?: string };
}

export default async function RegisterPage({ searchParams }: Props) {
  const token = searchParams.org?.trim();

  if (!token) {
    redirect('/login');
  }

  let orgId: string;
  let orgName: string;

  try {
    ({ orgId } = decodeOrgToken(token));
  } catch {
    redirect('/login');
  }

  const [org] = await db
    .select({ id: organisations.id, name: organisations.name })
    .from(organisations)
    .where(eq(organisations.id, orgId))
    .limit(1);

  if (!org) {
    redirect('/login');
  }

  orgId = org.id;
  orgName = org.name;

  return <RegisterForm orgToken={token} orgName={orgName} />;
}
