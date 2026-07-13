import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'EL ORIGEN',
  description: 'Juego de horror doméstico argentino sobre tasación, herencia, conducta observada y una casa que deja de obedecer.',
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
