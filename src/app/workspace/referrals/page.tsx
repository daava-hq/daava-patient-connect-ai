'use client';

import React, { useState, useEffect } from 'react';
import PageHeader from '@/components/ui/PageHeader/PageHeader';
import { useToast } from '@/components/feedback/ToastProvider/ToastProvider';
import { Users2, Plus } from 'lucide-react';

export default function ReferralsPage() {
  const { showToast } = useToast();
  const [practiceId, setPracticeId] = useState<string>('');
  const [referrals, setReferrals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem('selected_practice_id');
    if (saved) {
      setPracticeId(saved);
      fetchReferrals(saved);
    } else {
      setLoading(false);
    }
  }, []);

  async function fetchReferrals(pId: string) {
    try {
      const res = await fetch(`/api/referrals?practiceId=${pId}`);
      const json = await res.json();
      if (res.ok) setReferrals(json.data || []);
      else showToast(json.error || 'Failed to load referrals', 'error');
    } catch {
      showToast('Failed to load referrals', 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: '2rem' }}>
      <PageHeader
        title="Patient Referrals"
        description="Track inbound and outbound specialist and patient referrals."
      />

      {loading ? (
        <p>Loading referrals...</p>
      ) : referrals.length === 0 ? (
        <div style={{ background: '#fff', padding: '3rem', borderRadius: '8px', textAlign: 'center', color: '#64748b' }}>
          <Users2 size={48} style={{ marginBottom: '1rem', opacity: 0.5 }} />
          <h3>No referral records yet</h3>
          <p>Track your patient referrals and specialist networks here.</p>
        </div>
      ) : (
        <div style={{ background: '#fff', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontSize: '0.875rem' }}>
                <th style={{ padding: '1rem' }}>Patient Name</th>
                <th style={{ padding: '1rem' }}>Referred To</th>
                <th style={{ padding: '1rem' }}>Referrer</th>
                <th style={{ padding: '1rem' }}>Status</th>
                <th style={{ padding: '1rem' }}>Date</th>
              </tr>
            </thead>
            <tbody>
              {referrals.map((r) => (
                <tr key={r.id} style={{ borderBottom: '1px solid #f1f5f9', fontSize: '0.875rem' }}>
                  <td style={{ padding: '1rem', fontWeight: 500, color: '#1e293b' }}>{r.patientName}</td>
                  <td style={{ padding: '1rem', color: '#1e293b' }}>{r.referredTo}</td>
                  <td style={{ padding: '1rem', color: '#64748b' }}>{r.referrerName || '—'}</td>
                  <td style={{ padding: '1rem' }}>
                    <span style={{ padding: '0.25rem 0.75rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 500, background: '#e0f2fe', color: '#0369a1' }}>
                      {r.status}
                    </span>
                  </td>
                  <td style={{ padding: '1rem', color: '#64748b' }}>{new Date(r.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
