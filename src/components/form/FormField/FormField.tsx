import React from 'react';
import styles from './FormField.module.css';

interface FormFieldProps {
  label: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
  htmlFor?: string;
}

export default function FormField({ label, error, required, children, htmlFor }: FormFieldProps) {
  return (
    <div className={styles.fieldWrapper}>
      <label htmlFor={htmlFor} className={styles.label}>
        {label}
        {required && <span className={styles.required} aria-hidden="true">*</span>}
      </label>
      {children}
      {error && <span className={styles.errorText} role="alert">{error}</span>}
    </div>
  );
}
