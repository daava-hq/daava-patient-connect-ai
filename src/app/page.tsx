import Link from 'next/link';
import styles from './home.module.css';

export default function HomePage() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link href="/" className={styles.logoLink} aria-label="Patient Connect home">
          <div className={styles.iconBox} aria-hidden="true">PC</div>
          <span className={styles.wordmark}>Patient Connect</span>
        </Link>

        <nav className={styles.headerActions} aria-label="Main navigation">
          <Link href="/login" className={styles.btnLink}>Sign In</Link>
          <Link href="/login" className={styles.btnPrimary}>Get Started</Link>
        </nav>
      </header>

      <main className={styles.hero}>
        <span className={styles.badge}>Next-Gen Patient Engagement &amp; Operations</span>

        <h1 className={styles.headline}>
          Fill chairs, stop no-shows, and delight patients.
        </h1>

        <p className={styles.subheadline}>
          The all-in-one patient engagement platform built for modern practices.
          Automated SMS reminders, two-way texting, online booking, and 5-star review collection.
        </p>

        <div className={styles.heroActions}>
          <Link href="/login" className={styles.btnHeroPrimary}>
            Start Free Trial →
          </Link>
          <Link href="/login" className={styles.btnHeroSecondary}>
            Sign In to Demo
          </Link>
        </div>
      </main>

      <footer className={styles.footer}>
        <p className={styles.copyright}>© 2026 Patient Connect. All rights reserved.</p>
      </footer>
    </div>
  );
}
