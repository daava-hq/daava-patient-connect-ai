import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import PracticeRouteGate from '@/components/auth/PracticeRouteGate';
import { authOptions } from '@/lib/auth/options';

export default async function HomePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect('/login');

  return <PracticeRouteGate mode="entry" />;
}
