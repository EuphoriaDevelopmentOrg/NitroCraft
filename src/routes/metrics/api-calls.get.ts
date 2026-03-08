import { metrics } from "../../services/metrics";
import { jsonResponse } from "../../utils/toolkit";

export default defineEventHandler((event) => {
  return jsonResponse(event, {
    apiCalls: metrics.getApiCallCount(),
    generatedAt: new Date().toISOString(),
  });
});
