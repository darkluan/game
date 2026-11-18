import { tr } from '@/i18n';
import { Link } from 'react-router';

export default function NotFoundPage() {
  return (
    <main className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-2xl font-bold">{tr('Không tìm thấy trang')}</h1>
      <Link to="/" className="underline">
        {tr('Về trang chủ')}
      </Link>
    </main>
  );
}
