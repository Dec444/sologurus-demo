import type { Metadata } from "next";
import { Comic_Neue, DM_Sans } from "next/font/google";
import "./globals.css";

const sans = DM_Sans({ variable: "--font-sans", subsets: ["latin"] });
const display = Comic_Neue({ variable: "--font-display", subsets: ["latin"], weight: ["400", "700"] });

export const metadata: Metadata = {
  metadataBase: new URL("https://sologurus-study-agent.lu-liu398220.chatgpt.site"),
  title: "Sologurus — Your self-directed study agent",
  description: "Turn a language-test goal into verified resources and a calendar-ready study plan.",
  icons: { icon: "/favicon.svg" },
  openGraph: {
    title: "Sologurus — Your self-directed study agent",
    description: "One goal. A plan you can actually follow.",
    type: "website",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Sologurus study planning agent" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Sologurus — Your self-directed study agent",
    description: "One goal. A plan you can actually follow.",
    images: ["/og.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body className={`${sans.variable} ${display.variable}`}>{children}</body></html>;
}
