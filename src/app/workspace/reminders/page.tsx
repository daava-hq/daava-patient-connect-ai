'use client';

import React, { useState, useEffect } from 'react';
import PageHeader from '@/components/ui/PageHeader/PageHeader';
import { useToast } from '@/components/feedback/ToastProvider/ToastProvider';
import { Bell, Plus } from 'lucide-react';

export default function RemindersPage() {
  const { showToast } = useToast();
  const [practiceId, setPracticeId] = useState<string>('');
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState('');

  useEffect(() => {
    const saved = localStorage.getItem('selected_practice_id');
    if (saved) {
      setPracticeId(saved);
      fetchCampaigns(saved);
    } else {
      setLoading(false);
    }
  }, []);

  async function fetchCampaigns(pId: string) {
    try {
      const res = await fetch(`/api/campaigns?practiceId=${pId}&type=reminder`);
      const json = await res.json();
      if (res.ok) setCampaigns(json.data.campaigns || []);
      else showToast(json.error || 'Failed to load reminders', 'error');
    } catch {
      showToast('Failed to load reminders', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!practiceId) return;
    try {
      const res = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          practiceId,
          name,
          type: 'reminder',
          channel: 'sms',
          audienceFilter: { consentSms: true },
        }),
      });
      const json = await res.json();
      if (res.ok) {
        showToast('Appointment reminder campaign created successfully', 'success');
        setIsModalOpen(false);
        setName('');
        fetchCampaigns(practiceId);
      } else {
        showToast(json.error || 'Failed to create campaign', 'error');
      }
    } catch {
      showToast('Failed to create campaign', 'error');
    }
  }

  return (
    <div style={{ padding: '2rem' }}>
      <PageHeader
        title="Appointment Reminders"
        description="Automated SMS and email reminders for upcoming appointments."
        actions={
          <button
            onClick={() => setIsModalOpen(true)}
            style={{
              background: '#2563eb',
              color: '#fff',
              border: 'none',
              padding: '0.6rem 1.2rem',
              borderRadius: '6px',
              fontWeight: 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <Plus size={18} /> New Reminder Campaign
          </button>
        }
      />

      {loading ? (
        <p>Loading reminders...</p>
      ) : campaigns.length === 0 ? (
        <div style={{ background: '#fff', padding: '3rem', borderRadius: '8px', textAlign: 'center', color: '#64748b' }}>
          <Bell size={48} style={{ marginBottom: '1rem', opacity: 0.5 }} />
          <h3>No reminder campaigns yet</h3>
          <p>Create your first automated appointment reminder campaign to engage patients.</p>
        </div>
      ) : (
        <div style={{ background: '#fff', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontSize: '0.875rem' }}>
                <th style={{ padding: '1rem' }}>Campaign Name</th>
                <th style={{ padding: '1rem' }}>Channel</th>
                <th style={{ padding: '1rem' }}>Status</th>
                <th style={{ padding: '1rem' }}>Delivered / Total</th>
                <th style={{ padding: '1rem' }}>Created</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => (
                <tr key={c.id} style={{ borderBottom: '1px solid #f1f5f9', fontSize: '0.875rem' }}>
                  <td style={{ padding: '1rem', fontWeight: 500, color: '#1e293b' }}>{c.name}</td>
                  <td style={{ padding: '1rem', textTransform: 'uppercase' }}>{c.channel}</td>
                  <td style={{ padding: '1rem' }}>
                    <span style={{ padding: '0.25rem 0.75rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 500, background: c.status === 'completed' ? '#dcfce7' : '#fef3c7', color: c.status === 'completed' ? '#166534' : '#92400e' }}>
                      {c.status}
                    </span>
                  </td>
                  <td style={{ padding: '1rem' }}>{c.deliveredCount} / {c.totalRecipients}</td>
                  <td style={{ padding: '1rem', color: '#64748b' }}>{new Date(c.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: '#fff', padding: '2rem', borderRadius: '8px', width: '100%', maxWidth: '500px' }}>
            <h3 style={{ marginBottom: '1rem' }}>Create Appointment Reminder Campaign</h3>
            <form onSubmit={handleCreate}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.5rem' }}>Campaign Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., 48-Hour SMS Reminder"
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  style={{ background: '#e2e8f0', border: 'none', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer' }}
                >
                  Create Campaign
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
