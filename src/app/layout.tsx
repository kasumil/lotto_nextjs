import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { connection } from "next/server";
import { KakaoSdkProvider } from "@/components/KakaoSdkProvider";

const inter = Inter({ subsets: ["latin"] });

function getRuntimeMapJavascriptKey(name: string) {
  return process.env[name]?.trim();
}

export const metadata: Metadata = {
  title: "로또 판매점 지도",
  description: "내 주변 로또 판매점을 찾아보세요",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await connection();
  // Only an explicitly configured Maps JavaScript key may reach the browser.
  const appKey = getRuntimeMapJavascriptKey("NEXT_PUBLIC_KAKAO_MAP_API_KEY");

  return (
    <html lang="ko">
      <body className={inter.className}><KakaoSdkProvider appKey={appKey}>{children}</KakaoSdkProvider></body>
    </html>
  );
}
