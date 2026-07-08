import type { Metadata } from "next";
import { SiteFooter } from "@/components/site-footer";
import "./globals.css";

export const metadata: Metadata = {
  title: "Deal Lomé — La marketplace B2B & B2C du Togo",
  description:
    "Achetez et vendez en toute confiance au Togo : paiement sécurisé, vendeurs vérifiés, livraison locale à Lomé.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className="h-full antialiased">
      <head>
        {/*
         * Polices chargées au runtime via <link> plutôt que next/font/google,
         * afin que le build ne dépende pas de la disponibilité de Google Fonts.
         * Les familles (Plus Jakarta Sans / Hanken Grotesk / Geist) sont
         * référencées par leur nom dans globals.css (@theme).
         */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,600;12..96,700;12..96,800&family=Hanken+Grotesk:wght@400;500;600&family=Geist:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="flex min-h-full flex-col">
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
