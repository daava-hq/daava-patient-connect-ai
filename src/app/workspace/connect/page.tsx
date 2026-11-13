import { MessageSquare } from 'lucide-react';
import EmptyState from '@/components/feedback/EmptyState/EmptyState';
import PageHeader from '@/components/ui/PageHeader/PageHeader';
import styles from './ConnectPage.module.css';

export default function ConnectPage() {
  return (
    <main className={styles.page}>
      <PageHeader
        title="Connect Two-Way Messaging"
        description="Two-way patient messaging is unavailable until the messaging provider and incoming webhook are configured."
      />
      <EmptyState
        icon={<MessageSquare size={32} aria-hidden="true" />}
        title="Two-Way SMS Inbox"
        description="Patient conversations and direct messages will appear here once those integrations are configured."
      />
    </main>
  );
}
