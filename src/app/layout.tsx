import type { Metadata } from "next";
import { ClerkProvider, SignedIn, SignedOut, UserButton } from "@clerk/nextjs";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "R41 Lab",
  description: "Improve creative win rate",
};

function Nav() {
  return (
    <nav className="border-b border-zinc-800 bg-zinc-950 px-6 py-3">
      <div className="mx-auto flex max-w-7xl items-center justify-between">
        <div className="flex items-center gap-8">
          <Link href="/" className="text-lg font-bold text-white">
            R41 Lab
          </Link>
          <SignedIn>
            <div className="flex items-center gap-6 text-sm">
              <Link
                href="/"
                className="text-zinc-400 transition hover:text-white"
              >
                Board
              </Link>
              <Link
                href="/inbox"
                className="text-zinc-400 transition hover:text-white"
              >
                Inbox Triage
              </Link>
              <Link
                href="/produced-ads"
                className="text-zinc-400 transition hover:text-white"
              >
                Briefs
              </Link>
              <Link
                href="/performance"
                className="text-zinc-400 transition hover:text-white"
              >
                Performance
              </Link>
            </div>
          </SignedIn>
        </div>
        <div className="flex items-center gap-4">
          <SignedIn>
            <UserButton afterSignOutUrl="/sign-in" />
          </SignedIn>
          <SignedOut>
            <Link
              href="/sign-in"
              className="rounded bg-white px-4 py-1.5 text-sm font-medium text-black transition hover:bg-zinc-200"
            >
              Sign in
            </Link>
          </SignedOut>
        </div>
      </div>
    </nav>
  );
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="en" className="dark">
        <body className="min-h-screen bg-zinc-950 text-zinc-100 antialiased">
          <Nav />
          <main className="mx-auto max-w-7xl px-6 py-6">{children}</main>
        </body>
      </html>
    </ClerkProvider>
  );
}
