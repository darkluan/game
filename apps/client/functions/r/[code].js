// Runs on Cloudflare Pages for every link to a room, /r/CODE.
//
// The game is one page for every address, so on its own a link to a room would unfurl in a chat
// exactly like a link to the front page. Apps that draw a preview of a link do not run the page's
// code: they read the title, the description and the picture named in its head. This rewrites
// those, as the page goes out, into an invitation to that room.

const TEXT = {
  title: (code) => `⚔️ Vào phòng ${code} đấu 3v3 cùng tôi! · Tứ Tộc`,
  description:
    'Bấm link là vào trận: MOBA 3v3 chơi ngay trên trình duyệt, không cần tải, không cần đăng ký. Chọn tướng và chiến thôi!',
};

export async function onRequestGet(context) {
  const response = await context.next();
  if (!(response.headers.get('content-type') ?? '').includes('text/html')) return response;
  // Only letters and digits ever reach the page: the code is written into its head.
  const code = String(context.params.code ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 8);
  const url = new URL(context.request.url);
  const title = TEXT.title(code);
  const fields = {
    description: TEXT.description,
    'og:title': title,
    'og:description': TEXT.description,
    'og:image': `${url.origin}/og-room.jpg`,
    'og:url': `${url.origin}/r/${code}`,
    'twitter:title': title,
    'twitter:description': TEXT.description,
    'twitter:image': `${url.origin}/og-room.jpg`,
  };
  return new HTMLRewriter()
    .on('title', {
      element(element) {
        element.setInnerContent(title);
      },
    })
    .on('meta', {
      element(element) {
        const value = fields[element.getAttribute('property') ?? element.getAttribute('name') ?? ''];
        if (value) element.setAttribute('content', value);
      },
    })
    .transform(response);
}
