import styles from './EmailMessagePreview.module.css';

interface EmailMessagePreviewProps {
  html: string;
}

export default function EmailMessagePreview({ html }: EmailMessagePreviewProps) {
  return (
    <iframe
      className={styles.frame}
      title="Rendered email message preview"
      srcDoc={html}
      sandbox=""
    />
  );
}
