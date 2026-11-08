import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { connection } from "next/server";
import { KakaoSdkProvider } from "@/components/KakaoSdkProvider";

const inter = Inter({ subsets: ["latin"] });

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
  const appKey = ["KAKAO_APP_KEY", "NEXT_PUBLIC_KAKAO_APP_KEY", "NEXT_PUBLIC_KAKAO_MAP_API_KEY"]
    .map((name) => process.env[name]?.trim())
    .find(Boolean);

  return (
    <html lang="ko">
      <body className={inter.className}><KakaoSdkProvider appKey={appKey}>{children}</KakaoSdkProvider></body>
    </html>
  );
}
