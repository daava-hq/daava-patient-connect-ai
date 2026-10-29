'use client';

import React, { useState, Suspense } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import styles from './login.module.css';
import AppLogo from '@/components/ui/AppLogo/AppLogo';
import FormField from '@/components/form/FormField/FormField';
import { Lock, Mail, ArrowRight, Eye, EyeOff } from 'lucide-react';

function RegisteredBanner() {
  const searchParams = useSearchParams();
  const registered = searchParams.get('registered') === '1';

  if (!registered) return null;

  return (
    <div className={styles.successBanner} role="status">
      Practice created! Sign in with your new credentials.
    </div>
  );
}

function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('doctor@riversbenddental.com');
  const [password, setPassword] = useState('password123');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (res?.error) {
        setError(res.error);
        setLoading(false);
      } else {
        router.push('/workspace/choose-practice');
        router.refresh();
      }
    } catch {
      setError('An unexpected error occurred. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <AppLogo size="lg" />
          <h2 className={styles.subtitle}>Sign in to your practice workspace</h2>
        </div>

        <Suspense fallback={null}>
          <RegisteredBanner />
        </Suspense>

        {error && (
          <div className={styles.errorBanner} role="alert">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className={styles.form}>
          <FormField label="Email Address" htmlFor="email" required>
            <div className={styles.inputWrapper}>
              <Mail size={18} className={styles.inputIcon} />
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="doctor@practice.com"
                required
                className={styles.input}
              />
            </div>
          </FormField>

          <FormField label="Password" htmlFor="password" required>
            <div className={styles.inputWrapper}>
              <Lock size={18} className={styles.inputIcon} />
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
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
            <span>{loading ? 'Signing in...' : 'Sign In'}</span>
            {!loading && <ArrowRight size={18} />}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className={styles.container} />}>
      <LoginForm />
    </Suspense>
  );
}

