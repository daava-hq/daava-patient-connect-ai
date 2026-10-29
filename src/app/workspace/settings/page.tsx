'use client';

import React, { useState, useEffect, useCallback } from 'react';
import PageHeader from '@/components/ui/PageHeader/PageHeader';
import FormField from '@/components/form/FormField/FormField';
import ConfirmDialog from '@/components/ui/ConfirmDialog/ConfirmDialog';
import { useToast } from '@/components/feedback/ToastProvider/ToastProvider';
import styles from './settings.module.css';
import {
  Building2,
  Users,
  KeyRound,
  Phone,
  MapPin,
  Globe,
  ImageIcon,
  RefreshCw,
  Plus,
  Trash2,
  X,
  Copy,
  Check,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
} from 'lucide-react';

interface PracticeData {
  id: string;
  name: string;
  slug: string;
  phone: string | null;
  address: string | null;
  logoUrl: string | null;
  timezone: string;
  organisationName: string;
  userRole: string;
  credentials: {
    configured: boolean;
    developerKeyHint: string;
    customerKeyHint: string;
    lastPatientSyncedAt: string | null;
    lastApptSyncedAt: string | null;
  };
}

interface TeamMember {
  memberId: string;
  role: 'owner' | 'admin' | 'member';
  joinedAt: string;
  userId: string;
  name: string;
  email: string;
  userGlobalRole: string;
}

const TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Phoenix', label: 'Arizona (MST)' },
  { value: 'America/Anchorage', label: 'Alaska Time (AKT)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (HT)' },
  { value: 'UTC', label: 'UTC' },
];

export default function SettingsPage() {
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<'details' | 'team' | 'opendental'>('details');
  const [practiceId, setPracticeId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [savingDetails, setSavingDetails] = useState(false);
  const [savingCreds, setSavingCreds] = useState(false);
  const [syncingPatients, setSyncingPatients] = useState(false);
  const [syncingAppts, setSyncingAppts] = useState(false);

  // Practice form state
  const [practice, setPractice] = useState<PracticeData | null>(null);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [timezone, setTimezone] = useState('America/New_York');
  const [logoUrl, setLogoUrl] = useState('');
  const [copiedId, setCopiedId] = useState(false);

  // Open Dental form state
  const [devKey, setDevKey] = useState('');
  const [custKey, setCustKey] = useState('');
  const [showKeys, setShowKeys] = useState(false);

  // Team state
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberRole, setNewMemberRole] = useState<'admin' | 'member'>('member');
  const [newMemberPassword, setNewMemberPassword] = useState('');
  const [showNewMemberPassword, setShowNewMemberPassword] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState('');

  // Remove member confirm
  const [memberToRemove, setMemberToRemove] = useState<TeamMember | null>(null);

  const fetchPracticeData = useCallback(async (id: string) => {
    if (!id) return;
    setLoading(true);
    try {
      const [resPractice, resMembers] = await Promise.all([
        fetch(`/api/practices/${id}`),
        fetch(`/api/practices/${id}/members`),
      ]);

      if (resPractice.ok) {
        const json = await resPractice.json();
        const p: PracticeData = json.data;
        setPractice(p);
        setName(p.name || '');
        setSlug(p.slug || '');
        setPhone(p.phone || '');
        setAddress(p.address || '');
        setTimezone(p.timezone || 'America/New_York');
        setLogoUrl(p.logoUrl || '');
      }

      if (resMembers.ok) {
        const json = await resMembers.json();
        setMembers(json.data || []);
        if (json.currentUserId) {
          setCurrentUserId(json.currentUserId);
        }
      }
    } catch {
      showToast('Failed to load practice settings.', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  // Initial resolve of practice ID
  useEffect(() => {
    async function resolveCurrentPractice() {
      let currentId = typeof window !== 'undefined' ? localStorage.getItem('selectedClinicId') : null;
      if (!currentId) {
        try {
          const res = await fetch('/api/practices');
          if (res.ok) {
            const json = await res.json();
            if (json.data && json.data.length > 0) {
              currentId = json.data[0].id;
              localStorage.setItem('selectedClinicId', currentId!);
            }
          }
        } catch {
          // ignore
        }
      }

      if (currentId) {
        setPracticeId(currentId);
        fetchPracticeData(currentId);
      } else {
        setLoading(false);
      }
    }

    resolveCurrentPractice();

    const handlePracticeChange = () => {
      const updatedId = localStorage.getItem('selectedClinicId');
      if (updatedId) {
        setPracticeId(updatedId);
        fetchPracticeData(updatedId);
      }
    };

    window.addEventListener('practiceChanged', handlePracticeChange);
    return () => window.removeEventListener('practiceChanged', handlePracticeChange);
  }, [fetchPracticeData]);

  // Save practice details
  const handleSaveDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!practiceId) return;
    setSavingDetails(true);

    try {
      const res = await fetch(`/api/practices/${practiceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          slug: slug.trim().toLowerCase(),
          phone: phone.trim() || null,
          address: address.trim() || null,
          timezone,
          logoUrl: logoUrl.trim() || null,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to update practice settings');
      }

      showToast('Practice details updated successfully!', 'success');
      fetchPracticeData(practiceId);
      window.dispatchEvent(new Event('practiceChanged'));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Update failed';
      showToast(msg, 'error');
    } finally {
      setSavingDetails(false);
    }
  };

  // Save Open Dental credentials
  const handleSaveCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!practiceId) return;
    if (!devKey.trim() || !custKey.trim()) {
      showToast('Both Developer Key and Customer Key are required.', 'error');
      return;
    }

    setSavingCreds(true);
    try {
      const res = await fetch(`/api/practices/${practiceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          openDental: {
            developerKey: devKey.trim(),
            customerKey: custKey.trim(),
          },
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to save credentials');
      }

      showToast('Open Dental credentials saved & encrypted!', 'success');
      setDevKey('');
      setCustKey('');
      setShowKeys(false);
      fetchPracticeData(practiceId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Save failed';
      showToast(msg, 'error');
    } finally {
      setSavingCreds(false);
    }
  };

  // Trigger sync patients
  const handleSyncPatients = async () => {
    if (!practiceId) return;
    setSyncingPatients(true);
    try {
      const res = await fetch(`/api/practices/${practiceId}/sync`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Patient synchronization failed');
      }
      showToast(`Synchronized ${json.data.count} patients from Open Dental!`, 'success');
      fetchPracticeData(practiceId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Sync failed';
      showToast(msg, 'error');
    } finally {
      setSyncingPatients(false);
    }
  };

  // Trigger sync appointments
  const handleSyncAppts = async () => {
    if (!practiceId) return;
    setSyncingAppts(true);
    try {
      const res = await fetch(`/api/practices/${practiceId}/sync-appointments`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Appointment synchronization failed');
      }
      showToast(`Synchronized ${json.data.count} appointments from Open Dental!`, 'success');
      fetchPracticeData(practiceId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Sync failed';
      showToast(msg, 'error');
    } finally {
      setSyncingAppts(false);
    }
  };

  // Add team member
  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!practiceId) return;
    setInviteError('');
    setInviting(true);

    try {
      const res = await fetch(`/api/practices/${practiceId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newMemberName.trim(),
          email: newMemberEmail.trim().toLowerCase(),
          role: newMemberRole,
          password: newMemberPassword.trim() || undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to add team member');
      }

      showToast(`Team member ${newMemberName} added!`, 'success');
      setIsInviteModalOpen(false);
      setNewMemberName('');
      setNewMemberEmail('');
      setNewMemberPassword('');
      setShowNewMemberPassword(false);
      fetchPracticeData(practiceId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to add member';
      setInviteError(msg);
    } finally {
      setInviting(false);
    }
  };

  // Update member role
  const handleRoleChange = async (memberId: string, role: 'owner' | 'admin' | 'member') => {
    if (!practiceId) return;
    try {
      const res = await fetch(`/api/practices/${practiceId}/members/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to update role');
      }
      showToast('Member role updated.', 'success');
      fetchPracticeData(practiceId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Update failed';
      showToast(msg, 'error');
    }
  };

  // Remove member confirm
  const handleConfirmRemoveMember = async () => {
    if (!practiceId || !memberToRemove) return;
    try {
      const res = await fetch(`/api/practices/${practiceId}/members/${memberToRemove.memberId}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to remove member');
      }
      showToast(`${memberToRemove.name} removed from practice.`, 'success');
      setMemberToRemove(null);
      fetchPracticeData(practiceId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Remove failed';
      showToast(msg, 'error');
    }
  };

  const renderRoleBadge = (role: string) => {
    const normalized = role?.toLowerCase() || 'member';
    if (normalized === 'owner') {
      return <span className={`${styles.badge} ${styles.badgeOwner}`}>Owner</span>;
    }
    if (normalized === 'admin') {
      return <span className={`${styles.badge} ${styles.badgeAdmin}`}>Admin</span>;
    }
    return <span className={`${styles.badge} ${styles.badgeMember}`}>Member</span>;
  };

  const copyPracticeId = () => {
    if (!practiceId) return;
    navigator.clipboard.writeText(practiceId);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  return (
    <div className={styles.container}>
      <PageHeader
        title="Practice Settings"
        description="Manage your practice profile, team access, and Open Dental EHR synchronization."
        breadcrumbs={[{ label: 'Workspace' }, { label: 'Settings' }]}
      />

      {loading ? (
        <div className={styles.emptyState}>Loading practice settings...</div>
      ) : !practice ? (
        <div className={styles.emptyState}>
          No practice found or you do not have permission to view this practice.
        </div>
      ) : practice.userRole?.toLowerCase() === 'member' ? (
        <div className={styles.card} style={{ textAlign: 'center', padding: 'var(--space-12)', alignItems: 'center' }}>
          <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text)', marginBottom: 'var(--space-2)' }}>
            Access Denied
          </h2>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', maxWidth: '28rem', margin: '0 auto var(--space-6)' }}>
            Practice settings and configuration are restricted to practice administrators and owners. Regular staff members do not have permission to view or edit practice settings.
          </p>
          <a
            href="/workspace/dashboard"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              backgroundColor: 'var(--color-primary)',
              color: 'var(--color-surface)',
              padding: '0.6rem 1.25rem',
              borderRadius: 'var(--radius-md)',
              fontSize: 'var(--font-size-sm)',
              fontWeight: 'var(--font-weight-medium)',
              textDecoration: 'none',
              width: 'fit-content',
            }}
          >
            Back to Dashboard
          </a>
        </div>
      ) : (
        <>
          {/* Tabs */}
          <nav className={styles.tabsContainer} aria-label="Settings Tabs">
            <button
              onClick={() => setActiveTab('details')}
              className={`${styles.tabButton} ${activeTab === 'details' ? styles.tabActive : ''}`}
            >
              <Building2 size={16} />
              <span>Practice Details</span>
            </button>
            <button
              onClick={() => setActiveTab('team')}
              className={`${styles.tabButton} ${activeTab === 'team' ? styles.tabActive : ''}`}
            >
              <Users size={16} />
              <span>Team Members ({members.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('opendental')}
              className={`${styles.tabButton} ${activeTab === 'opendental' ? styles.tabActive : ''}`}
            >
              <KeyRound size={16} />
              <span>Open Dental Integration</span>
            </button>
          </nav>
          {/* ── TAB 1: PRACTICE DETAILS ── */}
          {activeTab === 'details' && (
            <div className={styles.section}>
              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <div>
                    <h2 className={styles.cardTitle}>Practice Information</h2>
                    <p className={styles.cardDescription}>
                      Configure your clinic profile, address, and contact details shown to patients.
                    </p>
                  </div>
                  <span className={`${styles.badge} ${styles.badgePrimary}`}>
                    Org: {practice.organisationName}
                  </span>
                </div>

                <form onSubmit={handleSaveDetails} className={styles.section}>
                  <div className={styles.formGrid}>
                    <FormField label="Practice Name" htmlFor="practice-name" required>
                      <div className={styles.inputWrapper}>
                        <Building2 size={18} className={styles.inputIcon} />
                        <input
                          id="practice-name"
                          type="text"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          required
                          className={styles.input}
                        />
                      </div>
                    </FormField>

                    <FormField label="Practice URL Slug" htmlFor="practice-slug" required>
                      <div className={styles.inputWrapper}>
                        <Globe size={18} className={styles.inputIcon} />
                        <input
                          id="practice-slug"
                          type="text"
                          value={slug}
                          onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                          required
                          placeholder="e.g. riversbend-dental"
                          className={styles.input}
                        />
                      </div>
                    </FormField>

                    <FormField label="Phone Number" htmlFor="practice-phone">
                      <div className={styles.inputWrapper}>
                        <Phone size={18} className={styles.inputIcon} />
                        <input
                          id="practice-phone"
                          type="tel"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="(555) 000-0000"
                          className={styles.input}
                        />
                      </div>
                    </FormField>

                    <FormField label="Timezone" htmlFor="practice-tz" required>
                      <div className={styles.inputWrapper}>
                        <Globe size={18} className={styles.inputIcon} />
                        <select
                          id="practice-tz"
                          value={timezone}
                          onChange={(e) => setTimezone(e.target.value)}
                          className={styles.input}
                        >
                          {TIMEZONES.map((tz) => (
                            <option key={tz.value} value={tz.value}>
                              {tz.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </FormField>
                  </div>

                  <FormField label="Physical Address" htmlFor="practice-address">
                    <div className={styles.inputWrapper}>
                      <MapPin size={18} className={styles.inputIcon} />
                      <input
                        id="practice-address"
                        type="text"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        placeholder="123 Dental Way, Suite 100, City, State ZIP"
                        className={styles.input}
                      />
                    </div>
                  </FormField>

                  <FormField label="Logo URL" htmlFor="practice-logo">
                    <div className={styles.inputWrapper}>
                      <ImageIcon size={18} className={styles.inputIcon} />
                      <input
                        id="practice-logo"
                        type="url"
                        value={logoUrl}
                        onChange={(e) => setLogoUrl(e.target.value)}
                        placeholder="https://example.com/logo.png"
                        className={styles.input}
                      />
                    </div>
                  </FormField>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                      <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                        Practice UUID:
                      </span>
                      <code style={{ fontSize: 'var(--font-size-xs)', backgroundColor: 'var(--color-background)', padding: '0.2rem 0.5rem', borderRadius: 'var(--radius-sm)' }}>
                        {practiceId}
                      </code>
                      <button
                        type="button"
                        onClick={copyPracticeId}
                        className={styles.btnSecondary}
                        style={{ padding: '0.25rem 0.5rem', fontSize: 'var(--font-size-xs)' }}
                        aria-label="Copy practice ID"
                      >
                        {copiedId ? <Check size={14} /> : <Copy size={14} />}
                        <span>{copiedId ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>

                    <button
                      type="submit"
                      disabled={savingDetails}
                      className={styles.btnPrimary}
                    >
                      {savingDetails ? 'Saving Changes...' : 'Save Practice Details'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* ── TAB 2: TEAM MANAGEMENT ── */}
          {activeTab === 'team' && (
            <div className={styles.section}>
              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <div>
                    <h2 className={styles.cardTitle}>Team Members</h2>
                    <p className={styles.cardDescription}>
                      Manage clinic staff accounts and control their administrative permissions.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setInviteError('');
                      setIsInviteModalOpen(true);
                    }}
                    className={styles.btnPrimary}
                  >
                    <Plus size={16} />
                    <span>Add Team Member</span>
                  </button>
                </div>

                <div className={styles.tableWrapper}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th className={styles.th}>Member</th>
                        <th className={styles.th}>Practice Role</th>
                        <th className={styles.th}>Joined</th>
                        <th className={styles.th} style={{ textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {members.map((m) => {
                        const isCurrentUser = Boolean(currentUserId && m.userId === currentUserId);
                        const isAdminOrOwner = m.role === 'admin' || m.role === 'owner';
                        const canRemove = !isCurrentUser && !isAdminOrOwner;

                        return (
                          <tr key={m.memberId} className={styles.tr}>
                            <td className={styles.td}>
                              <div className={styles.memberInfo}>
                                <div className={styles.avatar}>
                                  {m.name ? m.name.charAt(0).toUpperCase() : 'U'}
                                </div>
                                <div className={styles.nameBlock}>
                                  <span className={styles.memberName}>{m.name}</span>
                                  <span className={styles.memberEmail}>{m.email}</span>
                                </div>
                              </div>
                            </td>
                            <td className={styles.td}>
                              {renderRoleBadge(m.role)}
                            </td>
                            <td className={styles.td}>
                              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                                {new Date(m.joinedAt).toLocaleDateString()}
                              </span>
                            </td>
                            <td className={styles.td} style={{ textAlign: 'right' }}>
                              {isCurrentUser ? (
                                <span className={styles.currentUserBadge}>Current User</span>
                              ) : canRemove ? (
                                <button
                                  type="button"
                                  onClick={() => setMemberToRemove(m)}
                                  className={styles.btnDanger}
                                  aria-label={`Remove ${m.name} from practice`}
                                >
                                  <Trash2 size={14} />
                                  <span>Remove</span>
                                </button>
                              ) : (
                                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ── TAB 3: OPEN DENTAL EHR INTEGRATION ── */}
          {activeTab === 'opendental' && (
            <div className={styles.section}>
              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <div>
                    <h2 className={styles.cardTitle}>Open Dental FHIR / REST Integration</h2>
                    <p className={styles.cardDescription}>
                      Securely authenticate with your on-premise or cloud Open Dental server using AES-256-GCM encryption.
                    </p>
                  </div>
                  <div>
                    {practice.credentials.configured ? (
                      <span className={`${styles.badge} ${styles.badgeSuccess}`}>
                        <CheckCircle2 size={14} />
                        Connected
                      </span>
                    ) : (
                      <span className={`${styles.badge} ${styles.badgeWarning}`}>
                        <AlertCircle size={14} />
                        Keys Required
                      </span>
                    )}
                  </div>
                </div>

                {!(practice.userRole?.toLowerCase() === 'owner' || practice.userRole?.toLowerCase() === 'system-admin') && (
                  <div style={{ padding: 'var(--space-4)', backgroundColor: 'rgb(217 119 6 / 0.1)', border: '1px solid rgb(217 119 6 / 0.25)', borderRadius: 'var(--radius-md)', color: 'var(--color-warning)', fontSize: 'var(--font-size-sm)' }}>
                    Open Dental integration credentials and synchronization actions are restricted to practice owners.
                  </div>
                )}

                {/* Sync status cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-4)' }}>
                  <div style={{ padding: 'var(--space-4)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', backgroundColor: '#f8fafc' }}>
                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', fontWeight: 'var(--font-weight-medium)' }}>
                      PATIENT SYNC STATUS
                    </span>
                    <p style={{ margin: 'var(--space-1) 0 var(--space-3)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text)', fontWeight: 'var(--font-weight-semibold)' }}>
                      {practice.credentials.lastPatientSyncedAt
                        ? new Date(practice.credentials.lastPatientSyncedAt).toLocaleString()
                        : 'Never synced'}
                    </p>
                    <button
                      type="button"
                      disabled={syncingPatients || !(practice.userRole?.toLowerCase() === 'owner' || practice.userRole?.toLowerCase() === 'system-admin')}
                      onClick={handleSyncPatients}
                      className={styles.btnSecondary}
                      style={{ width: '100%' }}
                    >
                      <RefreshCw size={14} className={syncingPatients ? 'animate-spin' : ''} />
                      <span>{syncingPatients ? 'Syncing...' : 'Sync Patients Now'}</span>
                    </button>
                  </div>

                  <div style={{ padding: 'var(--space-4)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', backgroundColor: '#f8fafc' }}>
                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', fontWeight: 'var(--font-weight-medium)' }}>
                      APPOINTMENT SYNC STATUS
                    </span>
                    <p style={{ margin: 'var(--space-1) 0 var(--space-3)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text)', fontWeight: 'var(--font-weight-semibold)' }}>
                      {practice.credentials.lastApptSyncedAt
                        ? new Date(practice.credentials.lastApptSyncedAt).toLocaleString()
                        : 'Never synced'}
                    </p>
                    <button
                      type="button"
                      disabled={syncingAppts || !(practice.userRole?.toLowerCase() === 'owner' || practice.userRole?.toLowerCase() === 'system-admin')}
                      onClick={handleSyncAppts}
                      className={styles.btnSecondary}
                      style={{ width: '100%' }}
                    >
                      <RefreshCw size={14} className={syncingAppts ? 'animate-spin' : ''} />
                      <span>{syncingAppts ? 'Syncing...' : 'Sync Appointments Now'}</span>
                    </button>
                  </div>
                </div>

                {/* API Credentials form */}
                {(practice.userRole?.toLowerCase() === 'owner' || practice.userRole?.toLowerCase() === 'system-admin') && (
                  <form onSubmit={handleSaveCredentials} className={styles.section} style={{ marginTop: 'var(--space-2)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text)', margin: 0 }}>
                        API Credentials (ODFHIR)
                      </h3>
                      <button
                        type="button"
                        onClick={() => setShowKeys(!showKeys)}
                        className={styles.btnSecondary}
                        style={{ fontSize: 'var(--font-size-xs)', padding: '0.25rem 0.6rem' }}
                      >
                        {showKeys ? <EyeOff size={14} /> : <Eye size={14} />}
                        <span>{showKeys ? 'Hide Inputs' : 'Enter New Keys'}</span>
                      </button>
                    </div>

                    {practice.credentials.configured && !showKeys && (
                      <div style={{ padding: 'var(--space-3) var(--space-4)', backgroundColor: 'var(--color-background)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
                        Developer Key: <code style={{ color: 'var(--color-text)' }}>{practice.credentials.developerKeyHint}</code>
                        {' · '}
                        Customer Key: <code style={{ color: 'var(--color-text)' }}>{practice.credentials.customerKeyHint}</code>
                      </div>
                    )}

                    {showKeys && (
                      <div className={styles.formGrid}>
                        <FormField label="Developer Key" htmlFor="dev-key" required>
                          <div className={styles.inputWrapper}>
                            <KeyRound size={18} className={styles.inputIcon} />
                            <input
                              id="dev-key"
                              type="text"
                              value={devKey}
                              onChange={(e) => setDevKey(e.target.value)}
                              placeholder="OD Developer Key"
                              required
                              className={styles.input}
                            />
                          </div>
                        </FormField>

                        <FormField label="Customer Key" htmlFor="cust-key" required>
                          <div className={styles.inputWrapper}>
                            <KeyRound size={18} className={styles.inputIcon} />
                            <input
                              id="cust-key"
                              type="text"
                              value={custKey}
                              onChange={(e) => setCustKey(e.target.value)}
                              placeholder="OD Customer Key"
                              required
                              className={styles.input}
                            />
                          </div>
                        </FormField>
                      </div>
                    )}

                    {showKeys && (
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)' }}>
                        <button
                          type="button"
                          onClick={() => setShowKeys(false)}
                          className={styles.btnSecondary}
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={savingCreds}
                          className={styles.btnPrimary}
                        >
                          {savingCreds ? 'Saving Keys...' : 'Save & Encrypt Keys'}
                        </button>
                      </div>
                    )}
                  </form>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── ADD TEAM MEMBER MODAL ── */}
      {isInviteModalOpen && (
        <div className={styles.modalOverlay} role="dialog" aria-modal="true" aria-labelledby="modal-title">
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h3 id="modal-title" className={styles.modalTitle}>Add Team Member</h3>
              <button
                type="button"
                onClick={() => setIsInviteModalOpen(false)}
                className={styles.closeIconBtn}
                aria-label="Close dialog"
              >
                <X size={18} />
              </button>
            </div>

            {inviteError && (
              <div className={styles.errorBanner} role="alert">
                {inviteError}
              </div>
            )}

            <form onSubmit={handleAddMember} className={styles.section}>
              <FormField label="Full Name" htmlFor="new-name" required>
                <input
                  id="new-name"
                  type="text"
                  value={newMemberName}
                  onChange={(e) => setNewMemberName(e.target.value)}
                  placeholder="e.g. Sarah Jenkins"
                  required
                  className={`${styles.input} ${styles.inputNoIcon}`}
                  autoFocus
                />
              </FormField>

              <FormField label="Email Address" htmlFor="new-email" required>
                <input
                  id="new-email"
                  type="email"
                  value={newMemberEmail}
                  onChange={(e) => setNewMemberEmail(e.target.value)}
                  placeholder="sarah@practice.com"
                  required
                  className={`${styles.input} ${styles.inputNoIcon}`}
                />
              </FormField>

              <FormField label="Practice Role" htmlFor="new-role" required>
                <select
                  id="new-role"
                  value={newMemberRole}
                  onChange={(e) => setNewMemberRole(e.target.value as 'admin' | 'member')}
                  className={`${styles.input} ${styles.inputNoIcon}`}
                >
                  <option value="member">Member (Regular Staff)</option>
                  <option value="admin">Admin (Practice Administrator)</option>
                </select>
              </FormField>

              <FormField label="Initial Password (Optional)" htmlFor="new-password">
                <div className={styles.inputWrapper}>
                  <KeyRound size={18} className={styles.inputIcon} />
                  <input
                    id="new-password"
                    type={showNewMemberPassword ? 'text' : 'password'}
                    value={newMemberPassword}
                    onChange={(e) => setNewMemberPassword(e.target.value)}
                    placeholder="Defaults to TemporaryPass123!"
                    className={`${styles.input} ${styles.passwordInput}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewMemberPassword(!showNewMemberPassword)}
                    className={styles.eyeButton}
                    aria-label={showNewMemberPassword ? 'Hide password' : 'Show password'}
                  >
                    {showNewMemberPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </FormField>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
                <button
                  type="button"
                  onClick={() => setIsInviteModalOpen(false)}
                  className={styles.btnSecondary}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={inviting}
                  className={styles.btnPrimary}
                >
                  {inviting ? 'Adding...' : 'Add Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── CONFIRM REMOVE MEMBER DIALOG ── */}
      <ConfirmDialog
        isOpen={Boolean(memberToRemove)}
        title="Remove Team Member"
        message={`Are you sure you want to remove ${memberToRemove?.name} (${memberToRemove?.email}) from this practice? They will lose access to this clinic workspace.`}
        confirmText="Remove Member"
        cancelText="Cancel"
        variant="danger"
        onConfirm={handleConfirmRemoveMember}
        onCancel={() => setMemberToRemove(null)}
      />
    </div>
  );
}
