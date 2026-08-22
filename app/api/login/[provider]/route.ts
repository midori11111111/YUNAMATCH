const publicOrigin = "https://yunamatch.com";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;
  const source = new URL(request.url);
  return Response.redirect(
    new URL(`/api/login/${encodeURIComponent(provider)}${source.search}`, publicOrigin),
    307,
  );
}
