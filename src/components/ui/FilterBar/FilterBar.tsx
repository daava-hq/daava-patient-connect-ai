import React from 'react';
import styles from './FilterBar.module.css';

interface FilterBarProps {
  children: React.ReactNode;
  className?: string;
}

export default function FilterBar({ children, className = '' }: FilterBarProps) {
  return <div className={`${styles.filterBar} ${className}`}>{children}</div>;
}
