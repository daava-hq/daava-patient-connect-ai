import React from 'react';
import styles from './DataTable.module.css';

interface Column<T> {
  header: string;
  accessorKey: keyof T | ((row: T) => React.ReactNode);
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (row: T, index: number) => string | number;
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
}

export default function DataTable<T>({
  columns,
  data,
  keyExtractor,
  onRowClick,
  emptyMessage = 'No records found.',
}: DataTableProps<T>) {
  if (data.length === 0) {
    return (
      <div className={styles.emptyTable}>
        <p>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={styles.tableContainer}>
      <table className={styles.table}>
        <thead>
          <tr className={styles.headerRow}>
            {columns.map((col, idx) => (
              <th key={idx} className={`${styles.th} ${col.className || ''}`}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, rowIndex) => (
            <tr
              key={keyExtractor(row, rowIndex)}
              className={`${styles.row} ${onRowClick ? styles.clickable : ''}`}
              onClick={() => onRowClick && onRowClick(row)}
            >
              {columns.map((col, colIndex) => {
                const content =
                  typeof col.accessorKey === 'function'
                    ? col.accessorKey(row)
                    : (row[col.accessorKey] as React.ReactNode);
                return (
                  <td key={colIndex} className={`${styles.td} ${col.className || ''}`}>
                    {content}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
