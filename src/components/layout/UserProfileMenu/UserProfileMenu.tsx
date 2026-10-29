'use client';

import React, { useState, useEffect } from 'react';
import { signOut } from 'next-auth/react';
import Link from 'next/link';
import styles from './UserProfileMenu.module.css';
import { User, Settings, LogOut, ChevronDown } from 'lucide-react';

interface UserProfileMenuProps {
  userName?: string;
  userEmail?: string;
}

export default function UserProfileMenu({
  userName: initialName,
  userEmail: initialEmail,
}: UserProfileMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [userName, setUserName] = useState(initialName || 'Dr. Brian Albert');
  const [userEmail, setUserEmail] = useState(initialEmail || 'doctor@riversbenddental.com');

  useEffect(() => {
    async function fetchProfile() {
      try {
        const res = await fetch('/api/user/profile');
        if (res.ok) {
          const json = await res.json();
          if (json.data?.user) {
            setUserName(json.data.user.name || 'User');
            setUserEmail(json.data.user.email || '');
          }
        }
      } catch {
        // Fallback to initial
      }
    }
    fetchProfile();
  }, []);

  const handleLogout = async () => {
    await signOut({ callbackUrl: '/' });
  };

  return (
    <div className={styles.container}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={styles.triggerButton}
        aria-expanded={isOpen}
        aria-label="User profile menu"
      >
        <div className={styles.avatar}>
          <span>{userName.charAt(0).toUpperCase()}</span>
        </div>
        <div className={styles.userInfo}>
          <span className={styles.name}>{userName}</span>
          <span className={styles.email}>{userEmail}</span>
        </div>
        <ChevronDown size={16} className={styles.chevron} />
      </button>

      {isOpen && (
        <div className={styles.dropdown}>
          <div className={styles.dropdownHeader}>
            <span className={styles.dropdownName}>{userName}</span>
            <span className={styles.dropdownEmail}>{userEmail}</span>
          </div>
          <div className={styles.divider} />
          <Link
            href="/workspace/settings"
            className={styles.dropdownItem}
            onClick={() => setIsOpen(false)}
          >
            <Settings size={16} />
            <span>Practice Settings</span>
          </Link>
          <Link
            href="/workspace/profile"
            className={styles.dropdownItem}
            onClick={() => setIsOpen(false)}
          >
            <User size={16} />
            <span>My Profile</span>
          </Link>
          <div className={styles.divider} />
          <button onClick={handleLogout} className={`${styles.dropdownItem} ${styles.logout}`}>
            <LogOut size={16} />
            <span>Log Out</span>
          </button>
        </div>
      )}
    </div>
  );
}
