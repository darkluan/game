import { tr } from '@/i18n';
import { Link } from 'react-router';
import { LobbyShell } from '@/components/LobbyShell';

/** What the game keeps about a player, in plain words. Each entry is one heading and its paragraphs. */
const SECTIONS: { title: string; body: string[] }[] = [
  {
    title: tr('Chơi không cần tài khoản'),
    body: [
      tr(
        'Bạn chơi được ngay mà không cần đăng ký. Lần đầu vào phòng hoặc tìm trận, máy chủ cấp cho trình duyệt của bạn một mã khách ngẫu nhiên. Mã này không chứa tên, email hay số điện thoại.',
      ),
    ],
  },
  {
    title: tr('Những gì được lưu trên máy của bạn'),
    body: [
      tr(
        'Trình duyệt lưu các lựa chọn của bạn: biệt danh, tướng đã chọn, ngôn ngữ, âm thanh, đồ họa, và mã khách nói trên. Trình duyệt cũng giữ một bản các tệp của game để lần sau vào nhanh hơn. Xóa dữ liệu trang web trong trình duyệt là xóa hết những thứ này.',
      ),
    ],
  },
  {
    title: tr('Những gì máy chủ lưu'),
    body: [
      tr(
        'Máy chủ lưu mã khách, biệt danh bạn đặt, điểm trình độ, số trận đã chơi, và kết quả các trận ghép tự động: tướng đã dùng, số hạ gục, số lần bị hạ, số hỗ trợ. Nếu bạn rời một trận ghép giữa chừng, máy chủ ghi lại thời hạn tạm khóa tìm trận.',
      ),
      tr(
        'Tin nhắn chat và tín hiệu trong trận chỉ được chuyển tới người nhận rồi bỏ, không được lưu. Chữ gõ trong chat được lọc từ tục tự động trước khi gửi đi.',
      ),
    ],
  },
  {
    title: tr('Đăng nhập bằng Google'),
    body: [
      tr(
        'Đăng nhập Google là tùy chọn, để giữ điểm của bạn khi đổi máy. Khi bạn đăng nhập, game chỉ lưu mã định danh tài khoản do Google cấp. Game không lưu và không đọc email, tên, ảnh đại diện hay danh bạ của bạn.',
      ),
    ],
  },
  {
    title: tr('Bên thứ ba'),
    body: [
      tr(
        'Trang web chạy trên Cloudflare Pages và máy chủ game chạy trên Render. Hai dịch vụ này thấy địa chỉ IP của bạn khi bạn kết nối, như mọi trang web khác. Game không dùng quảng cáo, không dùng công cụ theo dõi và không bán hay chia sẻ dữ liệu cho ai.',
      ),
    ],
  },
  {
    title: tr('Xóa dữ liệu'),
    body: [
      tr(
        'Xóa dữ liệu trang web trong trình duyệt sẽ bỏ mã khách khỏi máy của bạn; phần điểm gắn với mã đó trên máy chủ không còn ai dùng được nữa. Muốn xóa hẳn dữ liệu gắn với tài khoản Google, hãy liên hệ người vận hành game.',
      ),
    ],
  },
];

/** The privacy policy: what is stored, where, and what is not. */
export default function PrivacyPage() {
  return (
    <LobbyShell>
      <div>
        <p className="animate-rise text-xs font-bold tracking-[0.35em] text-primary uppercase">{tr('Tứ Tộc')}</p>
        <h1 className="animate-rise text-title text-4xl leading-tight font-black tracking-[0.08em] uppercase sm:text-5xl">
          {tr('Quyền riêng tư')}
        </h1>
      </div>
      {SECTIONS.map((section) => (
        <section
          key={section.title}
          className="glass-panel flex w-full flex-col gap-2 rounded-xl p-4 text-left text-sm"
        >
          <h2 className="font-semibold">{section.title}</h2>
          {section.body.map((paragraph) => (
            <p key={paragraph} className="text-muted-foreground">
              {paragraph}
            </p>
          ))}
        </section>
      ))}
      <Link to="/" className="text-sm text-muted-foreground underline hover:text-foreground">
        {tr('Về trang chính')}
      </Link>
    </LobbyShell>
  );
}
