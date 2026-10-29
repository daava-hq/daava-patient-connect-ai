'use client';

import React, { useState } from 'react';
import styles from './AppSidebar.module.css';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Calendar,
  MessageSquare,
  BarChart3,
  Settings,
  ChevronDown,
  Bell,
  Gift,
  FolderOpen,
  Mail,
  CreditCard,
  Clock,
  Share2,
  FileQuestion,
} from 'lucide-react';

export default function AppSidebar() {
  const pathname = usePathname();
  const [isEngagementsOpen, setIsEngagementsOpen] = useState(true);

  const engagementSubitems = [
    { label: 'Appointment Reminders', href: '/workspace/reminders', icon: Bell },
    { label: 'Birthdays', href: '/workspace/birthdays', icon: Gift },
    { label: 'Groups', href: '/workspace/groups', icon: FolderOpen },
    { label: 'Newsletters', href: '/workspace/newsletters', icon: Mail },
    { label: 'Payment Reminders', href: '/workspace/payments', icon: CreditCard },
    { label: 'Recall', href: '/workspace/recall', icon: Clock },
    { label: 'Referrals', href: '/workspace/referrals', icon: Share2 },
    { label: 'Surveys', href: '/workspace/surveys', icon: FileQuestion },
  ];

  const isEngagementActive = engagementSubitems.some((item) => pathname?.startsWith(item.href));

  return (
    <aside className={styles.sidebar} aria-label="Sidebar navigation">
      <nav className={styles.nav}>
        <ul className={styles.navList}>
          <li>
            <Link
              href="/workspace/dashboard"
              className={`${styles.navItem} ${pathname === '/workspace/dashboard' ? styles.active : ''}`}
            >
              <LayoutDashboard size={20} />
              <span>Dashboard</span>
            </Link>
          </li>
          <li>
            <Link
              href="/workspace/patients"
              className={`${styles.navItem} ${pathname?.startsWith('/workspace/patients') ? styles.active : ''}`}
            >
              <Users size={20} />
              <span>Patients</span>
            </Link>
          </li>
          <li>
            <Link
              href="/workspace/appointments"
              className={`${styles.navItem} ${pathname?.startsWith('/workspace/appointments') ? styles.active : ''}`}
            >
              <Calendar size={20} />
              <span>Appointments</span>
            </Link>
          </li>

          {/* Patient Engagements Dropdown */}
          <li>
            <button
              onClick={() => setIsEngagementsOpen(!isEngagementsOpen)}
              className={`${styles.navItem} ${styles.submenuButton} ${isEngagementActive ? styles.active : ''}`}
              aria-expanded={isEngagementsOpen}
            >
              <div className={styles.submenuButtonLeft}>
                <MessageSquare size={20} />
                <span>Patient Engagements</span>
              </div>
              <ChevronDown
                size={16}
                className={`${styles.chevron} ${isEngagementsOpen ? styles.chevronOpen : ''}`}
              />
            </button>

            {isEngagementsOpen && (
              <ul className={styles.subnavList}>
                {engagementSubitems.map((sub) => {
                  const Icon = sub.icon;
                  const isActive = pathname === sub.href;
                  return (
                    <li key={sub.href}>
                      <Link href={sub.href} className={`${styles.subNavItem} ${isActive ? styles.activeSub : ''}`}>
                        <Icon size={16} />
                        <span>{sub.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </li>

          <li>
            <Link
              href="/workspace/connect"
              className={`${styles.navItem} ${pathname?.startsWith('/workspace/connect') ? styles.active : ''}`}
            >
              <MessageSquare size={20} />
              <span>Connect (2-Way)</span>
            </Link>
          </li>
          <li>
            <Link
              href="/workspace/reports"
              className={`${styles.navItem} ${pathname?.startsWith('/workspace/reports') ? styles.active : ''}`}
            >
              <BarChart3 size={20} />
              <span>Reports</span>
            </Link>
          </li>
          <li>
            <Link
              href="/workspace/settings"
              className={`${styles.navItem} ${pathname?.startsWith('/workspace/settings') ? styles.active : ''}`}
            >
              <Settings size={20} />
              <span>Settings</span>
            </Link>
          </li>
        </ul>
      </nav>
    </aside>
  );
}
