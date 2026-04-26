import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ELearn — English E-Learning Platform",
  description: "An online English learning platform with courses, quizzes, and AI support.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
