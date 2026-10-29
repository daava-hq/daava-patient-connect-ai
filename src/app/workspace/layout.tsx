'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import AppHeader from '@/components/layout/AppHeader/AppHeader';
import AppSidebar from '@/components/layout/AppSidebar/AppSidebar';
import { ToastProvider } from '@/components/feedback/ToastProvider/ToastProvider';
import styles from './workspaceLayout.module.css';

export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isChoosePractice = pathname === '/workspace/choose-practice';

  return (
    <ToastProvider>
      <div className={styles.layoutWrapper}>
        {!isChoosePractice && <AppHeader />}
        <div className={styles.mainBody}>
          {!isChoosePractice && <AppSidebar />}
          <main className={styles.contentArea}>{children}</main>
        </div>
      </div>
    </ToastProvider>
  );
}
