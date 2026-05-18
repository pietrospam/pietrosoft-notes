import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "Bitácora",
  description: "Sistema de notas y gestión de tareas",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const isTest = process.env.APP_ENV === 'test';

  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased${isTest ? ' test-theme' : ''}`}
      >
        {isTest && (
          <div className="fixed top-0 left-0 right-0 z-50 bg-emerald-200 text-emerald-900 text-xs font-bold text-center py-1 tracking-widest uppercase shadow-lg shadow-emerald-500/20">
            ⚠ ENTORNO DE PRUEBAS — TEST
          </div>
        )}
        <div className={isTest ? 'pt-6' : ''}>
          {children}
        </div>
      </body>
    </html>
  );
}
