export function GET() {
  const preview = process.env.GITHUB_PAGES === 'true';
  const body = preview
    ? 'User-agent: *\nDisallow: /\n'
    : 'User-agent: *\nAllow: /\nSitemap: https://hartfordrents.com/sitemap.xml\n';
  return new Response(body, { headers: { 'Content-Type': 'text/plain' } });
}
