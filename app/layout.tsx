import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import "./globals.css";

const sans = DM_Sans({ variable: "--font-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL("https://sologurus-study-agent.lu-liu398220.chatgpt.site"),
  title: "Sologurus — Your self-directed study agent",
  description: "Turn a language-test goal into verified resources and a calendar-ready study plan.",
  icons: { icon: "/favicon.svg" },
  openGraph: {
    title: "Sologurus — Your self-directed study agent",
    description: "Better direction. Smarter study.",
    type: "website",
    images: [{ url: "/og-editorial.png", width: 1200, height: 630, alt: "Sologurus — Better direction. Smarter study." }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Sologurus — Your self-directed study agent",
    description: "Better direction. Smarter study.",
    images: ["/og-editorial.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body className={sans.variable}>{children}</body></html>;
}
