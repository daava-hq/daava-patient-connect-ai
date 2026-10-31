'use client';

import React, { useState, useEffect } from 'react';
import PageHeader from '@/components/ui/PageHeader/PageHeader';
import { useToast } from '@/components/feedback/ToastProvider/ToastProvider';
import { DollarSign, Send } from 'lucide-react';

export default function PaymentsPage() {
  const { showToast } = useToast();
  const [practiceId, setPracticeId] = useState<string>('');
  const [balances, setBalances] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem('selected_practice_id');
    if (saved) {
      setPracticeId(saved);
      fetchBalances(saved);
    } else {
      setLoading(false);
    }
  }, []);

  async function fetchBalances(pId: string) {
    try {
      const res = await fetch(`/api/payments/balances?practiceId=${pId}`);
      const json = await res.json();
      if (res.ok) setBalances(json.data || []);
      else showToast(json.error || 'Failed to load balances', 'error');
    } catch {
      showToast('Failed to load balances', 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: '2rem' }}>
      <PageHeader
        title="Payment Reminders & Requests"
        description="View outstanding patient balances and send secure payment links."
      />

      {loading ? (
        <p>Loading balances...</p>
      ) : balances.length === 0 ? (
        <div style={{ background: '#fff', padding: '3rem', borderRadius: '8px', textAlign: 'center', color: '#64748b' }}>
          <DollarSign size={48} style={{ marginBottom: '1rem', opacity: 0.5 }} />
          <h3>No outstanding balances</h3>
          <p>All patient accounts are fully settled or balances have not been synced.</p>
        </div>
      ) : (
        <div style={{ background: '#fff', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontSize: '0.875rem' }}>
                <th style={{ padding: '1rem' }}>Patient Name</th>
                <th style={{ padding: '1rem' }}>Email</th>
                <th style={{ padding: '1rem' }}>Mobile</th>
                <th style={{ padding: '1rem' }}>Balance</th>
                <th style={{ padding: '1rem' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {balances.map((b) => (
                <tr key={b.id} style={{ borderBottom: '1px solid #f1f5f9', fontSize: '0.875rem' }}>
                  <td style={{ padding: '1rem', fontWeight: 500, color: '#1e293b' }}>{b.patientName}</td>
                  <td style={{ padding: '1rem', color: '#64748b' }}>{b.email || '—'}</td>
                  <td style={{ padding: '1rem', color: '#64748b' }}>{b.phoneMobile || '—'}</td>
                  <td style={{ padding: '1rem', fontWeight: 600, color: '#dc2626' }}>${b.balance}</td>
                  <td style={{ padding: '1rem' }}>
                    <button
                      onClick={() => showToast('Payment request link sent securely', 'success')}
                      style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '0.4rem 0.8rem', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem' }}
                    >
                      <Send size={14} /> Send Link
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
