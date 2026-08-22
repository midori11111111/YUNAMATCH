const publicOrigin = "https://yunamatch.com";

export function GET(request: Request) {
  const source = new URL(request.url);
  return Response.redirect(new URL(`/login${source.search}`, publicOrigin), 307);
}
