import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "First Mate · 에고이즘 CS 코파일럿",
  description: "브랜드 정책 근거로 CS 답변 초안을 만들고, 자동화할 것과 사람이 할 것을 규칙으로 나누는 코파일럿 (지원용 프로토타입)",
};

const NAV = [
  { href: "/", label: "받은함" },
  { href: "/eval", label: "평가" },
  { href: "/decisions", label: "설계 결정" },
] as const;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full antialiased">
      <head>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css" />
      </head>
      <body className="min-h-full flex flex-col">
        <div className="bg-ink text-white/80 text-xs px-4 py-1.5 text-center">
          비공식 지원용 프로토타입 · 모든 문의·주문은 합성 데이터 · 브랜드 정책은 각 몰의 공개 이용안내 기준
        </div>
        <header className="border-b border-line bg-white">
          <div className="mx-auto max-w-6xl px-4 h-14 flex items-center gap-6">
            <Link href="/" className="font-bold tracking-tight">
              First Mate <span className="text-muted font-normal text-sm">· CS 일등항해사</span>
            </Link>
            <nav className="flex gap-4 text-sm">
              {NAV.map((n) => (
                <Link key={n.href} href={n.href} className="text-muted hover:text-ink">
                  {n.label}
                </Link>
              ))}
            </nav>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl px-4 py-6 flex-1">{children}</main>
      </body>
    </html>
  );
}
