import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ORIGIN',
  description: 'La habitación no recuerda igual.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>
        {children}
      </body>
    </html>
  );
}
