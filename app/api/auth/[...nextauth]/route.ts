const publicOrigin = "https://yunamatch.com";

function forwardToAuthGateway(request: Request) {
  const source = new URL(request.url);
  return Response.redirect(
    new URL(`${source.pathname}${source.search}`, publicOrigin),
    request.method === "GET" || request.method === "HEAD" ? 307 : 308,
  );
}

export const GET = forwardToAuthGateway;
export const POST = forwardToAuthGateway;
