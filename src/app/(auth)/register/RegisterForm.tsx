'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Building2,
  User,
  Mail,
  Lock,
  Phone,
  MapPin,
  Eye,
  EyeOff,
  ArrowRight,
  Globe,
} from 'lucide-react';
import AppLogo from '@/components/ui/AppLogo/AppLogo';
import FormField from '@/components/form/FormField/FormField';
import styles from './register.module.css';

interface Props {
  orgToken: string;
  orgName: string;
}

const TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern (ET)' },
  { value: 'America/Chicago', label: 'Central (CT)' },
  { value: 'America/Denver', label: 'Mountain (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific (PT)' },
  { value: 'America/Phoenix', label: 'Arizona (MST)' },
  { value: 'America/Anchorage', label: 'Alaska (AKT)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii (HT)' },
  { value: 'UTC', label: 'UTC' },
];

export default function RegisterForm({ orgToken, orgName }: Props) {
  const router = useRouter();

  const [practiceName, setPracticeName] = useState('');
  const [practicePhone, setPracticePhone] = useState('');
  const [practiceAddress, setPracticeAddress] = useState('');
  const [timezone, setTimezone] = useState('America/New_York');
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState('');
  const [loading, setLoading] = useState(false);

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (practiceName.trim().length < 2) next.practiceName = 'Practice name must be at least 2 characters.';
    if (!adminName.trim()) next.adminName = 'Your name is required.';
    if (!adminEmail.trim()) next.adminEmail = 'Email is required.';
    if (adminPassword.length < 8) next.adminPassword = 'Password must be at least 8 characters.';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError('');
    if (!validate()) return;
    setLoading(true);

    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgToken,
          practiceName,
          practicePhone: practicePhone || undefined,
          practiceAddress: practiceAddress || undefined,
          timezone,
          adminName,
          adminEmail,
          adminPassword,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setServerError(data.error ?? 'Something went wrong. Please try again.');
        setLoading(false);
        return;
      }

      // Success — redirect to login with a success hint
      router.push('/login?registered=1');
    } catch {
      setServerError('An unexpected error occurred. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <AppLogo size="lg" />
          <p className={styles.subtitle}>Create your practice workspace</p>
          <span className={styles.orgBadge}>
            <Building2 size={14} />
            {orgName}
          </span>
        </div>

        {serverError && (
          <div className={styles.errorBanner} role="alert">
            {serverError}
          </div>
        )}

        <form onSubmit={handleSubmit} className={styles.form} noValidate>
          {/* ── Practice details ── */}
          <p className={styles.sectionTitle}>Practice details</p>

          <FormField label="Practice Name" htmlFor="practiceName" required error={errors.practiceName}>
            <div className={styles.inputWrapper}>
              <Building2 size={18} className={styles.inputIcon} />
              <input
                id="practiceName"
                type="text"
                value={practiceName}
                onChange={(e) => setPracticeName(e.target.value)}
                placeholder="Riverside Dental"
                required
                className={styles.input}
                autoFocus
              />
            </div>
          </FormField>

          <div className={styles.row}>
            <FormField label="Phone" htmlFor="practicePhone">
              <div className={styles.inputWrapper}>
                <Phone size={18} className={styles.inputIcon} />
                <input
                  id="practicePhone"
                  type="tel"
                  value={practicePhone}
                  onChange={(e) => setPracticePhone(e.target.value)}
                  placeholder="(555) 000-0000"
                  className={styles.input}
                />
              </div>
            </FormField>

            <FormField label="Timezone" htmlFor="timezone">
              <div className={styles.inputWrapper}>
                <Globe size={18} className={styles.inputIcon} />
                <select
                  id="timezone"
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

          <FormField label="Address" htmlFor="practiceAddress">
            <div className={styles.inputWrapper}>
              <MapPin size={18} className={styles.inputIcon} />
              <input
                id="practiceAddress"
                type="text"
                value={practiceAddress}
                onChange={(e) => setPracticeAddress(e.target.value)}
                placeholder="123 Main St, City, State"
                className={styles.input}
              />
            </div>
          </FormField>

          {/* ── Admin account ── */}
          <p className={styles.sectionTitle} style={{ marginTop: '0.5rem' }}>Admin account</p>

          <FormField label="Your Name" htmlFor="adminName" required error={errors.adminName}>
            <div className={styles.inputWrapper}>
              <User size={18} className={styles.inputIcon} />
              <input
                id="adminName"
                type="text"
                value={adminName}
                onChange={(e) => setAdminName(e.target.value)}
                placeholder="Dr. Jane Smith"
                required
                className={styles.input}
              />
            </div>
          </FormField>

          <FormField label="Email Address" htmlFor="adminEmail" required error={errors.adminEmail}>
            <div className={styles.inputWrapper}>
              <Mail size={18} className={styles.inputIcon} />
              <input
                id="adminEmail"
                type="email"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                placeholder="you@practice.com"
                required
                className={styles.input}
              />
            </div>
          </FormField>

          <FormField label="Password" htmlFor="adminPassword" required error={errors.adminPassword}>
            <div className={styles.inputWrapper}>
              <Lock size={18} className={styles.inputIcon} />
              <input
                id="adminPassword"
                type={showPassword ? 'text' : 'password'}
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                placeholder="Min. 8 characters"
                required
                className={`${styles.input} ${styles.passwordInput}`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className={styles.eyeButton}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </FormField>

          <button type="submit" disabled={loading} className={styles.submitButton}>
            <span>{loading ? 'Creating practice...' : 'Create Practice'}</span>
            {!loading && <ArrowRight size={18} />}
          </button>
        </form>

        <p className={styles.loginLink}>
          Already have an account?{' '}
          <Link href="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
