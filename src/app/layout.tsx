import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Séchoir Solaire – Dashboard IoT | Université Béchar",
  description:
    "Tableau de bord de surveillance en temps réel du séchoir solaire – Température et humidité des 8 capteurs DHT22.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
