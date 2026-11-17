import { Link } from 'react-router';

/** Shown when a page fails to load or throws while rendering. */
export function RouteError() {
  return (
    <main className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-2xl font-bold text-danger">Có lỗi xảy ra</h1>
      <p className="text-muted-foreground">Trang không tải được. Hãy thử tải lại.</p>
      <Link to="/" className="underline">
        Về trang chủ
      </Link>
    </main>
  );
}
