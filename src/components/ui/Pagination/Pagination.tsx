import React from 'react';
import styles from './Pagination.module.css';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export default function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <nav className={styles.pagination} aria-label="Pagination">
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage <= 1}
        className={styles.button}
        aria-label="Previous page"
      >
        <ChevronLeft size={16} />
        <span>Previous</span>
      </button>
      <span className={styles.info}>
        Page {currentPage} of {totalPages}
      </span>
      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage >= totalPages}
        className={styles.button}
        aria-label="Next page"
      >
        <span>Next</span>
        <ChevronRight size={16} />
      </button>
    </nav>
  );
}
