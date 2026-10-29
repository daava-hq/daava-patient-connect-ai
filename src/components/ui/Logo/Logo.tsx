import React from 'react';
import styles from './Logo.module.css';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
}

export default function Logo({ size = 'md' }: LogoProps) {
  return (
    <div className={`${styles.logoContainer} ${styles[size]}`}>
      <div className={styles.iconBox} aria-hidden="true">
        <span>PC</span>
      </div>
      <span className={styles.wordmark}>Patient Connect</span>
    </div>
  );
}
