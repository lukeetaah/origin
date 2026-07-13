import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'EL ORIGEN',
  description: 'Juego narrativo doméstico sobre un cuaderno azul, una casa heredada a medias y el origen que se vuelve oficial.',
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
