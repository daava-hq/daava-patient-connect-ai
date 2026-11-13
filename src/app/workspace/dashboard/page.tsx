import PageHeader from '@/components/ui/PageHeader/PageHeader';
import StatCard from '@/components/ui/StatCard/StatCard';
import SectionCard from '@/components/ui/SectionCard/SectionCard';
import { Users, Calendar, Bell, DollarSign } from 'lucide-react';
import SampleDataReset from './SampleDataReset';
import styles from './DashboardPage.module.css';

export default function DashboardPage() {
  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Overview of your practice engagement and appointments."
        breadcrumbs={[{ label: 'Workspace' }, { label: 'Dashboard' }]}
      />

      <SampleDataReset />

      <div className={styles.statGrid}>
        <StatCard label="Active Patients" value="1,428" change="+12% this month" trend="up" icon={<Users size={20} />} />
        <StatCard label="Appointments Today" value="24" change="4 pending confirmation" trend="neutral" icon={<Calendar size={20} />} />
        <StatCard label="Reminders Sent" value="382" change="+98.2% delivery" trend="up" icon={<Bell size={20} />} />
        <StatCard label="Outstanding Balance" value="$12,450" change="-4.5% vs last month" trend="down" icon={<DollarSign size={20} />} />
      </div>

      <SectionCard title="Recent Activity">
        <p className={styles.activityText}>
          Patient synchronization and appointment reminders are running smoothly. No recent issues reported.
        </p>
      </SectionCard>
    </div>
  );
}
