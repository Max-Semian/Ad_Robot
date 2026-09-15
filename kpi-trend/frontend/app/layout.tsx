import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'KPI Trend Chart — Python + Next.js',
  description:
    'Комбинированный график из 4 time-series: area, spline, line и bar. Бэкенд на FastAPI, фронтенд на Next.js.',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
