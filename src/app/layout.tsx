import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'EL ORIGEN',
  description: 'Horror doméstico argentino sobre una venta familiar preparada de antemano.',
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
