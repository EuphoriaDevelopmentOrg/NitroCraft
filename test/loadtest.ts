import autocannon from "autocannon";
import { once } from "node:events";

function envNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }
  const parsed = Number.parseFloat(raw);
  return Number.isNaN(parsed) ? fallback : parsed;
}

async function run(): Promise<void> {
  const baseUrl = (process.env.LOADTEST_URL || "http://127.0.0.1:3000").trim();
  const path = (process.env.LOADTEST_PATH || "/status/mc").trim();
  const method = (process.env.LOADTEST_METHOD || "GET").trim().toUpperCase();
  const connections = Math.max(1, Math.floor(envNumber("LOADTEST_CONNECTIONS", 25)));
  const duration = Math.max(1, Math.floor(envNumber("LOADTEST_DURATION", 15)));
  const pipelining = Math.max(1, Math.floor(envNumber("LOADTEST_PIPELINING", 1)));

  const target = new URL(path, baseUrl).toString();
  console.log("Running load test:", JSON.stringify({
    target,
    method,
    connections,
    duration,
    pipelining,
  }));

  const instance = autocannon({
    url: target,
    method,
    connections,
    duration,
    pipelining,
  });

  autocannon.track(instance, { renderProgressBar: true });

  const [result] = await once(instance, "done") as [autocannon.Result];

  const errors = result.errors || 0;
  const timeouts = result.timeouts || 0;
  const non2xx = result.non2xx || 0;
  const minRps = envNumber("LOADTEST_MIN_RPS", 0);
  const maxP99Ms = envNumber("LOADTEST_MAX_P99_MS", 0);

  if (errors > 0 || timeouts > 0 || non2xx > 0) {
    console.error(
      `Load test failed: errors=${errors}, timeouts=${timeouts}, non2xx=${non2xx}`,
    );
    process.exit(1);
  }

  if (minRps > 0 && result.requests.average < minRps) {
    console.error(`Load test failed: avg RPS ${result.requests.average.toFixed(2)} < required ${minRps.toFixed(2)}`);
    process.exit(1);
  }

  if (maxP99Ms > 0 && result.latency.p99 > maxP99Ms) {
    console.error(`Load test failed: p99 ${result.latency.p99.toFixed(2)}ms > allowed ${maxP99Ms.toFixed(2)}ms`);
    process.exit(1);
  }

  console.log(
    "Load test passed:",
    JSON.stringify({
      avgRps: Number(result.requests.average.toFixed(2)),
      p99Ms: Number(result.latency.p99.toFixed(2)),
      errors,
      timeouts,
      non2xx,
    }),
  );
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
