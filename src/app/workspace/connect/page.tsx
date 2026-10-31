'use client';

import React from 'react';
import PageHeader from '@/components/ui/PageHeader/PageHeader';
import { MessageSquare } from 'lucide-react';

export default function ConnectPage() {
  return (
    <div style={{ padding: '2rem' }}>
      <PageHeader
        title="Connect Two-Way Messaging"
        description="Real-time SMS conversation inbox with patients."
      />
      <div style={{ background: '#fff', padding: '4rem 2rem', borderRadius: '8px', textAlign: 'center', color: '#64748b', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <MessageSquare size={48} style={{ marginBottom: '1rem', opacity: 0.5 }} />
        <h3>Two-Way SMS Inbox</h3>
        <p>Conversations and direct messaging will appear here when incoming webhooks are configured.</p>
      </div>
    </div>
  );
}
