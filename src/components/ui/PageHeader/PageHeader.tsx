import React from 'react';
import styles from './PageHeader.module.css';
import Breadcrumbs from '../Breadcrumbs/Breadcrumbs';

interface PageHeaderProps {
  title: string;
  description?: string;
  breadcrumbs?: Array<{ label: string; href?: string }>;
  actions?: React.ReactNode;
}

export default function PageHeader({ title, description, breadcrumbs, actions }: PageHeaderProps) {
  return (
    <div className={styles.header}>
      {breadcrumbs && <Breadcrumbs items={breadcrumbs} />}
      <div className={styles.row}>
        <div>
          <h1 className={styles.title}>{title}</h1>
          {description && <p className={styles.description}>{description}</p>}
        </div>
        {actions && <div className={styles.actions}>{actions}</div>}
      </div>
    </div>
  );
}
