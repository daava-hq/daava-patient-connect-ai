'use client';

import React, { useState, useEffect } from 'react';
import PageHeader from '@/components/ui/PageHeader/PageHeader';
import { useToast } from '@/components/feedback/ToastProvider/ToastProvider';
import { Users, Plus } from 'lucide-react';

export default function GroupsPage() {
  const { showToast } = useToast();
  const [practiceId, setPracticeId] = useState<string>('');
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    const saved = localStorage.getItem('selected_practice_id');
    if (saved) {
      setPracticeId(saved);
      fetchGroups(saved);
    } else {
      setLoading(false);
    }
  }, []);

  async function fetchGroups(pId: string) {
    try {
      const res = await fetch(`/api/groups?practiceId=${pId}`);
      const json = await res.json();
      if (res.ok) setGroups(json.data || []);
      else showToast(json.error || 'Failed to load groups', 'error');
    } catch {
      showToast('Failed to load groups', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!practiceId) return;
    try {
      const res = await fetch('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ practiceId, name, description }),
      });
      const json = await res.json();
      if (res.ok) {
        showToast('Patient group created successfully', 'success');
        setIsModalOpen(false);
        setName('');
        setDescription('');
        fetchGroups(practiceId);
      } else {
        showToast(json.error || 'Failed to create group', 'error');
      }
    } catch {
      showToast('Failed to create group', 'error');
    }
  }

  return (
    <div style={{ padding: '2rem' }}>
      <PageHeader
        title="Patient Groups"
        description="Organize patient segments for targeted campaigns and newsletters."
        actions={
          <button
            onClick={() => setIsModalOpen(true)}
            style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '0.6rem 1.2rem', borderRadius: '6px', fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <Plus size={18} /> New Patient Group
          </button>
        }
      />

      {loading ? (
        <p>Loading groups...</p>
      ) : groups.length === 0 ? (
        <div style={{ background: '#fff', padding: '3rem', borderRadius: '8px', textAlign: 'center', color: '#64748b' }}>
          <Users size={48} style={{ marginBottom: '1rem', opacity: 0.5 }} />
          <h3>No patient groups yet</h3>
          <p>Create patient segments to target your engagement campaigns.</p>
        </div>
      ) : (
        <div style={{ background: '#fff', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontSize: '0.875rem' }}>
                <th style={{ padding: '1rem' }}>Group Name</th>
                <th style={{ padding: '1rem' }}>Description</th>
                <th style={{ padding: '1rem' }}>Members</th>
                <th style={{ padding: '1rem' }}>Created</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <tr key={g.id} style={{ borderBottom: '1px solid #f1f5f9', fontSize: '0.875rem' }}>
                  <td style={{ padding: '1rem', fontWeight: 500, color: '#1e293b' }}>{g.name}</td>
                  <td style={{ padding: '1rem', color: '#64748b' }}>{g.description || '—'}</td>
                  <td style={{ padding: '1rem' }}>{g.memberCount} patients</td>
                  <td style={{ padding: '1rem', color: '#64748b' }}>{new Date(g.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: '#fff', padding: '2rem', borderRadius: '8px', width: '100%', maxWidth: '500px' }}>
            <h3 style={{ marginBottom: '1rem' }}>Create Patient Group</h3>
            <form onSubmit={handleCreate}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.5rem' }}>Group Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Active Orthodontic Patients"
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                />
              </div>
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.5rem' }}>Description</label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional description of this segment"
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                <button type="button" onClick={() => setIsModalOpen(false)} style={{ background: '#e2e8f0', border: 'none', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer' }}>Create Group</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
