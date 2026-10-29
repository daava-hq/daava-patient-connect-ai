import React from 'react';
import styles from './SearchInput.module.css';
import { Search } from 'lucide-react';

interface SearchInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export default function SearchInput({ label = 'Search', className = '', ...props }: SearchInputProps) {
  return (
    <div className={`${styles.searchContainer} ${className}`}>
      <Search className={styles.searchIcon} size={18} aria-hidden="true" />
      <input
        type="search"
        aria-label={label}
        className={styles.searchInput}
        {...props}
      />
    </div>
  );
}
