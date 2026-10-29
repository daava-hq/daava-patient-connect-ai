'use client';

import React, { useState, useEffect } from 'react';
import PageHeader from '@/components/ui/PageHeader/PageHeader';
import FormField from '@/components/form/FormField/FormField';
import { useToast } from '@/components/feedback/ToastProvider/ToastProvider';
import styles from './profile.module.css';
import {
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Building2,
  KeyRound,
  ShieldCheck,
} from 'lucide-react';

interface UserData {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
  updatedAt: string;
}

interface UserPractice {
  practiceId: string;
  practiceName: string;
  practiceSlug: string;
  organisationName: string;
  role: string;
  joinedAt: string;
}

export default function ProfilePage() {
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<UserData | null>(null);
  const [practices, setPractices] = useState<UserPractice[]>([]);

  // Profile edit state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState('');

  // Password update state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [updatingPassword, setUpdatingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');

  useEffect(() => {
    async function loadProfile() {
      setLoading(true);
      try {
        const res = await fetch('/api/user/profile');
        if (res.ok) {
          const json = await res.json();
          const u: UserData = json.data.user;
          setUser(u);
          setName(u.name || '');
          setEmail(u.email || '');
          setPractices(json.data.practices || []);
        } else {
          showToast('Failed to load profile details.', 'error');
        }
      } catch {
        showToast('Error connecting to server.', 'error');
      } finally {
        setLoading(false);
      }
    }
    loadProfile();
  }, [showToast]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError('');
    if (!name.trim()) {
      setProfileError('Name cannot be empty.');
      return;
    }
    setSavingProfile(true);

    try {
      const res = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to update profile');
      }

      setUser(json.data);
      showToast('Profile updated successfully!', 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Update failed';
      setProfileError(msg);
      showToast(msg, 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (!currentPassword) {
      setPasswordError('Please enter your current password.');
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match.');
      return;
    }

    setUpdatingPassword(true);
    try {
      const res = await fetch('/api/user/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to change password');
      }

      setPasswordSuccess('Password updated successfully!');
      showToast('Password changed successfully!', 'success');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Password update failed';
      setPasswordError(msg);
      showToast(msg, 'error');
    } finally {
      setUpdatingPassword(false);
    }
  };

  return (
    <div className={styles.container}>
      <PageHeader
        title="My Profile"
        description="View your account details, manage assigned clinics, and update your password."
        breadcrumbs={[{ label: 'Workspace' }, { label: 'My Profile' }]}
      />

      {loading ? (
        <div style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--color-text-muted)' }}>
          Loading your profile...
        </div>
      ) : !user ? (
        <div style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--color-text-muted)' }}>
          Profile details could not be found.
        </div>
      ) : (
        <div className={styles.grid}>
          {/* ── CARD 1: USER DETAILS ── */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>Account Details</h2>
              <p className={styles.cardDescription}>
                Update your personal name and contact information.
              </p>
            </div>

            <div className={styles.avatarHeader}>
              <div className={styles.avatarLarge}>
                {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
              </div>
              <div className={styles.avatarText}>
                <h3 className={styles.userName}>{user.name}</h3>
                <p className={styles.userEmail}>{user.email}</p>
                <div style={{ marginTop: 'var(--space-1)' }}>
                  <span className={`${styles.badge} ${styles.badgePrimary}`}>
                    <ShieldCheck size={12} />
                    {user.role === 'admin' ? 'System Administrator' : 'Staff Member'}
                  </span>
                </div>
              </div>
            </div>

            {profileError && (
              <div className={styles.errorBanner} role="alert">
                {profileError}
              </div>
            )}

            <form onSubmit={handleSaveProfile} className={styles.form}>
              <FormField label="Full Name" htmlFor="profile-name" required>
                <div className={styles.inputWrapper}>
                  <User size={18} className={styles.inputIcon} />
                  <input
                    id="profile-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className={styles.input}
                  />
                </div>
              </FormField>

              <FormField label="Email Address" htmlFor="profile-email" required>
                <div className={styles.inputWrapper}>
                  <Mail size={18} className={styles.inputIcon} />
                  <input
                    id="profile-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className={styles.input}
                  />
                </div>
              </FormField>

              <div>
                <button
                  type="submit"
                  disabled={savingProfile}
                  className={styles.btnPrimary}
                >
                  {savingProfile ? 'Saving Details...' : 'Save Profile Changes'}
                </button>
              </div>
            </form>

            {/* Assigned practices */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
              <h3 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text)', margin: 0 }}>
                Assigned Practices ({practices.length})
              </h3>
              {practices.length === 0 ? (
                <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                  No practice assignments found.
                </p>
              ) : (
                practices.map((p) => (
                  <div key={p.practiceId} className={styles.practiceItem}>
                    <div className={styles.practiceInfo}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                        <Building2 size={16} color="var(--color-primary)" />
                        <span className={styles.practiceTitle}>{p.practiceName}</span>
                      </div>
                      <span className={styles.practiceOrg}>Organisation: {p.organisationName}</span>
                    </div>
                    <span className={`${styles.badge} ${styles.badgeMuted}`}>
                      {p.role.toUpperCase()}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* ── CARD 2: PASSWORD UPDATE SCREEN ── */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>Change Password</h2>
              <p className={styles.cardDescription}>
                Keep your practice workspace secure with a strong password (minimum 8 characters).
              </p>
            </div>

            {passwordError && (
              <div className={styles.errorBanner} role="alert">
                {passwordError}
              </div>
            )}

            {passwordSuccess && (
              <div className={styles.successBanner} role="status">
                {passwordSuccess}
              </div>
            )}

            <form onSubmit={handleUpdatePassword} className={styles.form}>
              <FormField label="Current Password" htmlFor="current-password" required>
                <div className={styles.inputWrapper}>
                  <Lock size={18} className={styles.inputIcon} />
                  <input
                    id="current-password"
                    type={showCurrent ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                    placeholder="Enter current password"
                    className={`${styles.input} ${styles.passwordInput}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrent(!showCurrent)}
                    className={styles.eyeButton}
                    aria-label={showCurrent ? 'Hide current password' : 'Show current password'}
                  >
                    {showCurrent ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </FormField>

              <FormField label="New Password" htmlFor="new-password" required>
                <div className={styles.inputWrapper}>
                  <KeyRound size={18} className={styles.inputIcon} />
                  <input
                    id="new-password"
                    type={showNew ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    placeholder="Minimum 8 characters"
                    className={`${styles.input} ${styles.passwordInput}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew(!showNew)}
                    className={styles.eyeButton}
                    aria-label={showNew ? 'Hide new password' : 'Show new password'}
                  >
                    {showNew ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </FormField>

              <FormField label="Confirm New Password" htmlFor="confirm-password" required>
                <div className={styles.inputWrapper}>
                  <KeyRound size={18} className={styles.inputIcon} />
                  <input
                    id="confirm-password"
                    type={showConfirm ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    placeholder="Re-enter new password"
                    className={`${styles.input} ${styles.passwordInput}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className={styles.eyeButton}
                    aria-label={showConfirm ? 'Hide confirm password' : 'Show confirm password'}
                  >
                    {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </FormField>

              <div>
                <button
                  type="submit"
                  disabled={updatingPassword}
                  className={styles.btnPrimary}
                >
                  {updatingPassword ? 'Updating Password...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
