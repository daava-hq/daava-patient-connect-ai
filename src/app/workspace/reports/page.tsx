import { BarChart3 } from 'lucide-react';
import EmptyState from '@/components/feedback/EmptyState/EmptyState';
import PageHeader from '@/components/ui/PageHeader/PageHeader';
import styles from './ReportsPage.module.css';

export default function ReportsPage() {
  return (
    <main className={styles.page}>
      <PageHeader
        title="Engagement & Operations Reports"
        description="Centralized reporting and CSV exports are not yet available."
      />
      <EmptyState
        icon={<BarChart3 size={32} aria-hidden="true" />}
        title="Cross-Module Reports"
        description="Delivery rates, campaign performance, response metrics, and CSV exports will appear here once report data sources are connected."
      />
    </main>
  );
}
