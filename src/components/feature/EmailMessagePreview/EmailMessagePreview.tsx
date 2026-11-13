import styles from './EmailMessagePreview.module.css';

interface EmailMessagePreviewProps {
  html: string;
  className?: string;
}

export default function EmailMessagePreview({ html, className }: EmailMessagePreviewProps) {
  return (
    <iframe
      className={`${styles.frame} ${className ?? ''}`}
      title="Rendered email message preview"
      srcDoc={html}
      sandbox=""
    />
  );
}
