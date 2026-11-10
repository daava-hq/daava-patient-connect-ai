'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import styles from './AppHeader.module.css';
import AppLogo from '../../ui/AppLogo/AppLogo';
import GlobalSearch from '../GlobalSearch/GlobalSearch';
import UserProfileMenu from '../UserProfileMenu/UserProfileMenu';
import { ArrowLeftRight, Building2 } from 'lucide-react';

interface Practice {
  id: string;
  name: string;
}

interface AppHeaderProps {
  practices?: Practice[];
  currentPracticeId?: string;
}

export default function AppHeader({
  practices: initialPractices,
  currentPracticeId,
}: AppHeaderProps) {
  const [practiceList, setPracticeList] = useState<Practice[]>(initialPractices || []);
  const [selectedPractice, setSelectedPractice] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('selectedClinicId') || currentPracticeId || '';
    }
    return currentPracticeId || '';
  });

  useEffect(() => {
    async function loadPractices() {
      try {
        const res = await fetch('/api/practices');
        if (res.ok) {
          const json = await res.json();
          if (json.data && json.data.length > 0) {
            setPracticeList(json.data);
            const saved = localStorage.getItem('selectedClinicId');
            const exists = json.data.some((p: Practice) => p.id === saved);
            setSelectedPractice(saved && exists ? saved : '');
          }
        }
      } catch {
        setSelectedPractice('');
      }
    }

    if (!initialPractices || initialPractices.length === 0) {
      loadPractices();
    }
  }, [initialPractices]);

  useEffect(() => {
    const handlePracticeChange = () => {
      const saved = localStorage.getItem('selectedClinicId');
      setSelectedPractice(saved || '');
    };
    window.addEventListener('practiceChanged', handlePracticeChange);
    return () => window.removeEventListener('practiceChanged', handlePracticeChange);
  }, []);

  const activePractice =
    practiceList.find((p) => p.id === selectedPractice) || practiceList[0];

  return (
    <header className={styles.header}>
      <div className={styles.leftSection}>
        <Link href="/workspace/dashboard" className={styles.logoLink} aria-label="Patient Connect home">
          <AppLogo size="sm" />
        </Link>

        <span className={styles.divider} aria-hidden="true" />

        <div className={styles.practiceWrapper}>
          <div className={styles.currentPracticeBadge} title={activePractice?.name || 'Selected Practice'}>
            <Building2 size={16} className={styles.buildingIcon} />
            <span className={styles.practiceName}>{activePractice?.name || 'Loading practice...'}</span>
          </div>
          <Link
            href="/workspace/choose-practice"
            className={styles.switchPracticeLink}
            aria-label="Switch practice"
            title="Switch practice"
          >
            <ArrowLeftRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </div>

      <div className={styles.centerSection}>
        <GlobalSearch />
      </div>

      <div className={styles.rightSection}>
        <UserProfileMenu />
      </div>
    </header>
  );
}
