const baseUrl = process.env.BASE_URL || 'http://localhost:4000';

async function check(path) {
  const res = await fetch(`${baseUrl}${path}`);
  return { path, ok: res.ok, status: res.status };
}

async function main() {
  const checks = await Promise.all([
    check('/health'),
    check('/admin/cities')
  ]);

  console.log(JSON.stringify({ checks }, null, 2));

  if (checks.some((c) => !c.ok && c.path !== '/admin/cities')) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
