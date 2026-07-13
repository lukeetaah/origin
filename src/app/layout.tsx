import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'EL ORIGEN',
  description: 'Juego narrativo doméstico sobre una libreta azul, una casa heredada y el derecho a dejar registro.',
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
