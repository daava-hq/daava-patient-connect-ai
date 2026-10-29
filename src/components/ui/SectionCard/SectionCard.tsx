import React from 'react';
import styles from './SectionCard.module.css';

interface SectionCardProps {
  title?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export default function SectionCard({ title, action, children, className = '' }: SectionCardProps) {
  return (
    <section className={`${styles.card} ${className}`}>
      {title && (
        <header className={styles.header}>
          <h2 className={styles.title}>{title}</h2>
          {action && <div className={styles.action}>{action}</div>}
        </header>
      )}
      <div className={styles.content}>{children}</div>
    </section>
  );
}
