import { tr } from '@/i18n';
import { reloadHome } from '@/lib/reloadHome';

export default function NotFoundPage() {
  return (
    <main className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-2xl font-bold">{tr('Không tìm thấy trang')}</h1>
      {/* A fresh load, not a switch of screens: see reloadHome. */}
      <button type="button" onClick={reloadHome} className="cursor-pointer underline">
        {tr('Về trang chủ')}
      </button>
    </main>
  );
}
