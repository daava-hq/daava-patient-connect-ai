import type { Metadata } from 'next';
import '../../styles/globals.css';

export const metadata: Metadata = {
  title: 'Patient Connect',
  description: 'Multi-organization dental practice patient engagement platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
