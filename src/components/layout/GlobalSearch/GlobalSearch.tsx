'use client';

import React, { useState } from 'react';
import styles from './GlobalSearch.module.css';
import { Search, Command } from 'lucide-react';

export default function GlobalSearch() {
  const [query, setQuery] = useState('');

  return (
    <div className={styles.searchWrapper}>
      <Search size={16} className={styles.icon} aria-hidden="true" />
      <input
        type="search"
        placeholder="Search patients, appointments, groups..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className={styles.input}
        aria-label="Global search"
      />
      <kbd className={styles.kbd}>
        <Command size={12} /> K
      </kbd>
    </div>
  );
}
