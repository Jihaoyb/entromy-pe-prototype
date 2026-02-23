import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Entromy Private Equity Prototype',
  description: 'One-page marketing prototype for a private equity offering.',
  icons: {
    icon: '/browser_tab.png',
    shortcut: '/browser_tab.png',
    apple: '/browser_tab.png'
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans">{children}</body>
    </html>
  );
}
