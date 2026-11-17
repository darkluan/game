import { Link } from 'react-router';

export default function NotFoundPage() {
  return (
    <main className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-2xl font-bold">Không tìm thấy trang</h1>
      <Link to="/" className="underline">
        Về trang chủ
      </Link>
    </main>
  );
}
