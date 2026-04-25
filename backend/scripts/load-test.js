const baseUrl = process.env.BASE_URL || 'http://localhost:4000';
const totalRequests = Number(process.env.REQUESTS || 100);

async function run() {
  const start = Date.now();
  let ok = 0;

  const calls = Array.from({ length: totalRequests }, async () => {
    const response = await fetch(`${baseUrl}/health`);
    if (response.ok) ok += 1;
  });

  await Promise.all(calls);

  const elapsedMs = Date.now() - start;
  console.log(JSON.stringify({ totalRequests, ok, elapsedMs, rps: ((ok * 1000) / elapsedMs).toFixed(2) }));
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
