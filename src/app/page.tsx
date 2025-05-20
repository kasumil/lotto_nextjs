import Link from 'next/link';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-4xl font-bold mb-8">로또 판매점 지도</h1>
      <p className="text-xl mb-8">내 주변 로또 판매점을 찾아보세요</p>
      <Link 
        href="/map" 
        className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-lg transition-colors"
      >
        지도 보기
      </Link>
    </main>
  );
}
