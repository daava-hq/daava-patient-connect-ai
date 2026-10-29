import React from 'react';
import styles from './StatCard.module.css';

interface StatCardProps {
  label: string;
  value: string | number;
  change?: string;
  trend?: 'up' | 'down' | 'neutral';
  icon?: React.ReactNode;
}

export default function StatCard({ label, value, change, trend = 'neutral', icon }: StatCardProps) {
  return (
    <div className={styles.statCard}>
      <div className={styles.topRow}>
        <span className={styles.label}>{label}</span>
        {icon && <div className={styles.iconWrapper}>{icon}</div>}
      </div>
      <div className={styles.valueRow}>
        <span className={styles.value}>{value}</span>
        {change && (
          <span className={`${styles.change} ${styles[trend]}`}>
            {change}
          </span>
        )}
      </div>
    </div>
  );
}
