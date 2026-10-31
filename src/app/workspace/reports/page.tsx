'use client';

import React from 'react';
import PageHeader from '@/components/ui/PageHeader/PageHeader';
import { BarChart3 } from 'lucide-react';

export default function ReportsPage() {
  return (
    <div style={{ padding: '2rem' }}>
      <PageHeader
        title="Engagement & Operations Reports"
        description="Comprehensive analytics and exportable reports across all modules."
      />
      <div style={{ background: '#fff', padding: '4rem 2rem', borderRadius: '8px', textAlign: 'center', color: '#64748b', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <BarChart3 size={48} style={{ marginBottom: '1rem', opacity: 0.5 }} />
        <h3>Engagement Analytics</h3>
        <p>Delivery rates, campaign performance, response metrics, and CSV exports.</p>
      </div>
    </div>
  );
}
