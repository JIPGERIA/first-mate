import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Nav } from "@/components/nav";
import { REPO_URL } from "@/lib/present";
import "./globals.css";

export const metadata: Metadata = {
  title: "First Mate · 에고이즘 CS 코파일럿",
  description: "브랜드 정책 근거로 CS 답변 초안을 만들고, 자동화할 것과 사람이 할 것을 규칙으로 나누는 코파일럿 (지원용 프로토타입)",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full antialiased">
      <head>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css" />
      </head>
      <body className="min-h-full flex flex-col">
        <div className="bg-ink px-4 py-1.5 text-center text-xs text-white/80">
          에고이즘 AX Engineer 지원용 비공식 프로토타입 · 모든 문의·주문은 합성 데이터 · 브랜드 정책은 각 몰의 공개 이용안내 기준
        </div>
        <header className="sticky top-0 z-10 border-b border-line bg-white/95 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
            <Link href="/" className="shrink-0 font-bold tracking-tight">
              First Mate <span className="hidden text-sm font-normal text-muted sm:inline">· CS 일등항해사</span>
            </Link>
            <div className="-mx-1 flex min-w-0 flex-1 overflow-x-auto px-1">
              <Suspense>
                <Nav />
              </Suspense>
            </div>
            <a href={REPO_URL} target="_blank" rel="noopener" className="hidden shrink-0 rounded-md border border-line px-2.5 py-1 text-xs text-muted hover:text-ink md:inline-block">
              GitHub ↗
            </a>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl px-4 py-6 flex-1">{children}</main>
      </body>
    </html>
  );
}
