import { metrics } from "../services/metrics";
import { respond } from "../utils/response";

export default defineEventHandler((event) => {
  const body = metrics.toPrometheusText();
  return respond(event, {
    status: 1,
    body,
    type: "text/plain; version=0.0.4; charset=utf-8",
    cacheControl: "no-cache, max-age=0",
  });
});
