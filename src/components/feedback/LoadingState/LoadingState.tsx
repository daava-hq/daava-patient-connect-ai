import React from 'react';
import styles from './LoadingState.module.css';

interface LoadingStateProps {
  text?: string;
}

export default function LoadingState({ text = 'Loading...' }: LoadingStateProps) {
  return (
    <div className={styles.container} role="status" aria-label={text}>
      <div className={styles.spinner} aria-hidden="true" />
      <span className={styles.text}>{text}</span>
    </div>
  );
}
