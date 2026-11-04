import type { CSSProperties } from 'react';
import styles from './EmailMessagePreview.module.css';

interface EmailMessagePreviewProps {
  html: string;
  style?: CSSProperties;
}

export default function EmailMessagePreview({ html, style }: EmailMessagePreviewProps) {
  return (
    <iframe
      className={styles.frame}
      title="Rendered email message preview"
      srcDoc={html}
      sandbox=""
      style={style}
    />
  );
}
