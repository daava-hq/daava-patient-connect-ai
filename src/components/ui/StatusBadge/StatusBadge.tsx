import React from 'react';
import styles from './StatusBadge.module.css';

interface StatusBadgeProps {
  status: 'success' | 'warning' | 'error' | 'info' | 'default';
  children: React.ReactNode;
}

export default function StatusBadge({ status = 'default', children }: StatusBadgeProps) {
  return (
    <span className={`${styles.badge} ${styles[status]}`}>
      {children}
    </span>
  );
}
