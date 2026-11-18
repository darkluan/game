import { tr } from '@/i18n';
import { reloadHome } from '@/lib/reloadHome';

/** Shown when a page fails to load or throws while rendering. */
export function RouteError() {
  return (
    <main className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-2xl font-bold text-danger">{tr('Có lỗi xảy ra')}</h1>
      <p className="text-muted-foreground">{tr('Trang không tải được. Hãy thử tải lại.')}</p>
      {/* A fresh load, not a switch of screens: see reloadHome. */}
      <button type="button" onClick={reloadHome} className="cursor-pointer underline">
        {tr('Về trang chủ')}
      </button>
    </main>
  );
}
