(function() {
  var runtimeConfig = window.NITROCRAFT_SERVER_BROWSER_CONFIG || {};
  var maxConcurrency = clampInt(runtimeConfig.maxConcurrency, 4, 1, 16);
  var maxPerPage = clampInt(runtimeConfig.maxPerPage, 100, 1, 100);
  var defaultEdition = String(runtimeConfig.defaultEdition || "java").toLowerCase() === "bedrock"
    ? "bedrock"
    : "java";
  var defaultPerPage = clampInt(runtimeConfig.defaultPerPage, 10, 1, maxPerPage);

  var defaults = {
    edition: defaultEdition,
    timeoutMs: 2200,
    concurrency: Math.min(3, maxConcurrency),
    page: 1,
    perPage: defaultPerPage
  };

  var DEFAULT_SERVER_ICON = "/avatars/069a79f444e94726a5befca90e38aaf5?size=64&overlay";

  var controls = {
    edition: document.querySelector("#nsb-edition"),
    timeoutMs: document.querySelector("#nsb-timeout-ms"),
    concurrency: document.querySelector("#nsb-concurrency"),
    page: document.querySelector("#nsb-page"),
    perPage: document.querySelector("#nsb-per-page"),
    probeBtn: document.querySelector("#nsb-probe-btn"),
    prevBtn: document.querySelector("#nsb-page-prev"),
    nextBtn: document.querySelector("#nsb-page-next"),
    resetBtn: document.querySelector("#nsb-reset-btn"),
    copyShareBtn: document.querySelector("#nsb-copy-share"),
    shareUrl: document.querySelector("#nsb-share-url"),
    summary: document.querySelector("#nsb-summary"),
    pageInfo: document.querySelector("#nsb-page-info"),
    status: document.querySelector("#nsb-status"),
    resultsList: document.querySelector("#nsb-results-list")
  };

  if (!controls.edition || !controls.probeBtn || !controls.resultsList) {
    return;
  }

  var inFlight = false;
  var lastKnownPage = 1;
  var lastKnownTotalPages = 1;

  function clampInt(value, fallback, min, max) {
    var parsed = Number.parseInt(String(value || ""), 10);
    if (!Number.isFinite(parsed)) {
      parsed = fallback;
    }
    if (parsed < min) {
      parsed = min;
    }
    if (parsed > max) {
      parsed = max;
    }
    return parsed;
  }

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function setNote(message, isError) {
    if (!controls.status) {
      return;
    }
    controls.status.textContent = message || "";
    controls.status.classList.toggle("is-error", Boolean(isError && message));
    controls.status.classList.toggle("is-ok", Boolean(!isError && message));
  }

  function normalizeEdition(value) {
    return String(value || "").trim().toLowerCase() === "bedrock" ? "bedrock" : "java";
  }

  function readState() {
    var edition = normalizeEdition(controls.edition.value || defaults.edition);
    var timeoutMs = clampInt(controls.timeoutMs.value, defaults.timeoutMs, 100, 10000);
    var concurrency = clampInt(controls.concurrency.value, defaults.concurrency, 1, maxConcurrency);
    var page = clampInt(controls.page.value, defaults.page, 1, 100000);
    var perPage = clampInt(controls.perPage.value, defaults.perPage, 1, maxPerPage);

    controls.edition.value = edition;
    controls.timeoutMs.value = String(timeoutMs);
    controls.concurrency.value = String(concurrency);
    controls.page.value = String(page);
    controls.perPage.value = String(perPage);

    return {
      edition: edition,
      timeoutMs: timeoutMs,
      concurrency: concurrency,
      page: page,
      perPage: perPage
    };
  }

  function buildQuery(state) {
    var params = new URLSearchParams();
    params.set("dataset", state.edition);
    params.set("edition", state.edition);
    params.set("page", String(state.page));
    params.set("perPage", String(state.perPage));
    params.set("timeoutMs", String(state.timeoutMs));
    params.set("concurrency", String(state.concurrency));
    return params;
  }

  function updateShareUrl(state) {
    if (!controls.shareUrl) {
      return;
    }

    var params = buildQuery(state);
    var queryString = params.toString();
    var relative = window.location.pathname + (queryString ? ("?" + queryString) : "");
    controls.shareUrl.value = window.location.origin + relative;
    history.replaceState(null, "", relative);
  }

  function clearResults() {
    controls.resultsList.innerHTML = '<p class="server-browser-empty">Run a probe to see results.</p>';
  }

  function stripCodes(value) {
    return String(value || "")
      .replace(/(?:\u00a7|&)[0-9A-FK-ORa-fk-or]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function truncateForLine(value, maxLength) {
    var text = String(value || "").trim();
    if (text.length <= maxLength) {
      return text;
    }
    return text.slice(0, Math.max(1, maxLength - 3)).trim() + "...";
  }

  function readPlayerCount(status) {
    if (!status || typeof status !== "object") {
      return "n/a";
    }
    var players = status.players;
    if (!players || typeof players !== "object") {
      return "n/a";
    }

    var online = Number(players.online);
    var max = Number(players.max);
    if (Number.isFinite(online) && Number.isFinite(max)) {
      return Math.max(0, Math.trunc(online)) + "/" + Math.max(0, Math.trunc(max));
    }
    if (Number.isFinite(online)) {
      return String(Math.max(0, Math.trunc(online)));
    }
    return "n/a";
  }

  function readOnlineCount(status) {
    if (!status || typeof status !== "object") {
      return -1;
    }
    var players = status.players;
    if (!players || typeof players !== "object") {
      return -1;
    }
    var online = Number(players.online);
    if (!Number.isFinite(online)) {
      return -1;
    }
    return Math.max(0, Math.trunc(online));
  }

  function readVersion(status) {
    if (!status || typeof status !== "object") {
      return "n/a";
    }
    var version = status.version;
    if (!version || typeof version !== "object") {
      return "n/a";
    }
    if (typeof version.name === "string" && version.name.trim()) {
      return version.name.trim();
    }
    var protocol = Number(version.protocol);
    if (Number.isFinite(protocol)) {
      return "Protocol " + Math.trunc(protocol);
    }
    return "n/a";
  }

  function readLatency(status) {
    if (!status || typeof status !== "object") {
      return null;
    }
    var latencyMs = Number(status.latencyMs);
    if (!Number.isFinite(latencyMs)) {
      return null;
    }
    return Math.max(0, Math.trunc(latencyMs));
  }

  function readLatencyLabel(status) {
    var latencyMs = readLatency(status);
    if (!Number.isFinite(latencyMs)) {
      return "n/a";
    }
    return latencyMs + " ms";
  }

  function splitMotdLines(status) {
    if (!status || typeof status !== "object") {
      return ["No MOTD", ""];
    }
    var motd = String(status.motd || "").replaceAll("\r", "");
    var stripped = stripCodes(motd);
    if (!stripped) {
      return ["No MOTD", ""];
    }
    var split = stripped.split("\n");
    var line1 = truncateForLine(split[0] || "", 72);
    var line2 = truncateForLine(split.slice(1).join(" ").trim(), 72);
    return [line1 || "No MOTD", line2];
  }

  function readEdition(status) {
    if (!status || typeof status !== "object") {
      return "unknown";
    }
    var edition = String(status.edition || "").trim().toLowerCase();
    if (edition === "java" || edition === "bedrock") {
      return edition;
    }
    return "unknown";
  }

  function readIcon(result) {
    if (!result || !result.ok || !result.status || typeof result.status !== "object") {
      return DEFAULT_SERVER_ICON;
    }
    var status = result.status;
    if (status.edition !== "java") {
      return DEFAULT_SERVER_ICON;
    }
    if (typeof status.favicon === "string" && status.favicon.startsWith("data:image/")) {
      return status.favicon;
    }
    return DEFAULT_SERVER_ICON;
  }

  function readPingBars(result) {
    if (!result || !result.ok || !result.status || typeof result.status !== "object") {
      return 0;
    }
    if (result.status.online === false) {
      return 0;
    }
    var latencyMs = readLatency(result.status);
    if (!Number.isFinite(latencyMs)) {
      return 0;
    }
    if (latencyMs <= 150) {
      return 5;
    }
    if (latencyMs <= 300) {
      return 4;
    }
    if (latencyMs <= 600) {
      return 3;
    }
    if (latencyMs <= 1000) {
      return 2;
    }
    return 1;
  }

  function pingBarsHtml(level) {
    var normalized = clampInt(level, 0, 0, 5);
    var bars = [];
    for (var i = 0; i < 5; i++) {
      bars.push("<span" + (i < normalized ? " class=\"is-on\"" : "") + "></span>");
    }
    return "<span class=\"mc-ping-bars\" aria-label=\"" + normalized + " ping bars\" data-bars=\"" + normalized + "\">" + bars.join("") + "</span>";
  }

  function rowBadge(result) {
    if (!result || typeof result !== "object") {
      return { label: "Error", className: "is-error" };
    }
    if (!result.ok) {
      return { label: "Error", className: "is-error" };
    }

    var status = result.status;
    if (status && status.online === false) {
      return { label: "Offline", className: "is-down" };
    }
    return { label: "Online", className: "is-up" };
  }

  function compareResults(a, b) {
    if (!!a.ok !== !!b.ok) {
      return a.ok ? -1 : 1;
    }
    if (!a.ok || !b.ok) {
      return String(a.address || "").localeCompare(String(b.address || ""));
    }
    var aOnline = readOnlineCount(a.status);
    var bOnline = readOnlineCount(b.status);
    if (aOnline !== bOnline) {
      return bOnline - aOnline;
    }
    return String(a.address || "").localeCompare(String(b.address || ""));
  }

  function renderResults(payload) {
    var results = Array.isArray(payload && payload.results) ? payload.results.slice() : [];
    if (!results.length) {
      clearResults();
      return;
    }

    results.sort(compareResults);

    var rows = [];
    for (var i = 0; i < results.length; i++) {
      var result = results[i];
      var badge = rowBadge(result);
      var status = result && result.status ? result.status : null;
      var edition = readEdition(status);
      var players = result.ok ? readPlayerCount(status) : "n/a";
      var version = result.ok ? readVersion(status) : "n/a";
      var latency = result.ok ? readLatencyLabel(status) : "n/a";
      var motdLines = result.ok
        ? splitMotdLines(status)
        : [
          truncateForLine(result && result.error ? result.error : "Probe failed.", 72),
          ""
        ];
      var serverAddress = String(result && result.address ? result.address : "").trim() || "Unknown server";
      var pingBars = pingBarsHtml(readPingBars(result));
      var iconSrc = readIcon(result);
      var iconAlt = "Server icon for " + serverAddress;
      var versionMeta = edition + " | " + version + " | " + latency;

      rows.push(
        "<article class=\"mc-server-entry server-browser-entry " + badge.className + "\" role=\"listitem\">" +
          "<img src=\"" + escapeHtml(iconSrc) + "\" alt=\"" + escapeHtml(iconAlt) + "\" width=\"64\" height=\"64\" loading=\"lazy\" decoding=\"async\">" +
          "<div class=\"mc-server-content\">" +
            "<div class=\"mc-java-line mc-java-line-top\">" +
              "<span class=\"mc-server-name server-browser-address\">" + escapeHtml(serverAddress) + "</span>" +
              "<span class=\"mc-java-status\">" +
                "<span class=\"mc-server-players\">" + escapeHtml(players) + "</span>" +
                pingBars +
              "</span>" +
            "</div>" +
            "<div class=\"mc-java-line\"><span class=\"mc-java-motd-line\">" + escapeHtml(motdLines[0] || "") + "</span></div>" +
            "<div class=\"mc-java-line\"><span class=\"mc-java-motd-line\">" + escapeHtml(motdLines[1] || "") + "</span></div>" +
            "<div class=\"mc-java-line mc-java-line-version\">" +
              "<span class=\"mc-server-version\">" + escapeHtml(versionMeta) + "</span>" +
              "<span class=\"server-browser-badge " + badge.className + "\">" + escapeHtml(badge.label) + "</span>" +
            "</div>" +
          "</div>" +
        "</article>"
      );
    }

    controls.resultsList.innerHTML = rows.join("");
  }

  function renderSummary(payload) {
    if (!controls.summary) {
      return;
    }

    var processed = Number(payload && payload.processed);
    var succeeded = Number(payload && payload.succeeded);
    var failed = Number(payload && payload.failed);
    var edition = String(payload && payload.edition ? payload.edition : defaults.edition);
    var timeoutMs = Number(payload && payload.timeoutMs);
    var page = Number(payload && payload.page);
    var totalPages = Number(payload && payload.totalPages);
    var totalCandidates = Number(payload && payload.totalCandidates);

    if (!Number.isFinite(processed) || !Number.isFinite(succeeded) || !Number.isFinite(failed)) {
      controls.summary.textContent = "Run a probe to view summary stats.";
      return;
    }

    var timeoutLabel = Number.isFinite(timeoutMs) ? (Math.trunc(timeoutMs) + "ms") : "n/a";
    var pageLabel = Number.isFinite(page) && Number.isFinite(totalPages)
      ? ("page " + Math.trunc(page) + "/" + Math.trunc(totalPages))
      : "page n/a";
    var totalLabel = Number.isFinite(totalCandidates) ? (" from " + Math.trunc(totalCandidates) + " targets") : "";

    controls.summary.textContent =
      "Dataset " + edition +
      " " + pageLabel +
      totalLabel +
      ": processed " + Math.trunc(processed) +
      " (" + Math.trunc(succeeded) + " ok, " + Math.trunc(failed) + " failed), timeout=" + timeoutLabel + ".";
  }

  function updatePaginationState(payload, fallbackState) {
    var page = clampInt(payload && payload.page, fallbackState.page, 1, 100000);
    var totalPages = clampInt(payload && payload.totalPages, Math.max(page, 1), 1, 100000);
    var totalCandidates = Number(payload && payload.totalCandidates);

    lastKnownPage = page;
    lastKnownTotalPages = totalPages;
    controls.page.value = String(page);

    if (controls.pageInfo) {
      var suffix = Number.isFinite(totalCandidates) ? (" (" + Math.trunc(totalCandidates) + " targets)") : "";
      controls.pageInfo.textContent = "Page " + page + " of " + totalPages + suffix;
    }

    if (controls.prevBtn) {
      controls.prevBtn.disabled = inFlight || page <= 1;
    }
    if (controls.nextBtn) {
      controls.nextBtn.disabled = inFlight || page >= totalPages;
    }
  }

  function updatePaginationPlaceholder(state) {
    lastKnownPage = state.page;
    lastKnownTotalPages = Math.max(1, state.page);
    if (controls.pageInfo) {
      controls.pageInfo.textContent = "Page " + state.page + " of ?";
    }
    if (controls.prevBtn) {
      controls.prevBtn.disabled = inFlight || state.page <= 1;
    }
    if (controls.nextBtn) {
      controls.nextBtn.disabled = inFlight;
    }
  }

  function parseErrorMessage(response, payload, fallback) {
    if (payload && typeof payload.error === "string" && payload.error.trim()) {
      return payload.error.trim();
    }
    if (response && Number.isFinite(response.status)) {
      return fallback + " (HTTP " + response.status + ")";
    }
    return fallback;
  }

  function setLoadingState(isLoading) {
    inFlight = isLoading;
    controls.probeBtn.disabled = isLoading;
    controls.probeBtn.textContent = isLoading ? "Probing..." : "Probe Page";
    if (controls.resetBtn) {
      controls.resetBtn.disabled = isLoading;
    }
    if (controls.prevBtn) {
      controls.prevBtn.disabled = isLoading || lastKnownPage <= 1;
    }
    if (controls.nextBtn) {
      controls.nextBtn.disabled = isLoading || lastKnownPage >= lastKnownTotalPages;
    }
  }

  function probeServers(optionalPage) {
    if (inFlight) {
      return;
    }

    var state = readState();
    if (Number.isFinite(optionalPage)) {
      state.page = clampInt(optionalPage, state.page, 1, 100000);
      controls.page.value = String(state.page);
    }

    updateShareUrl(state);
    setLoadingState(true);
    setNote(
      "Probing " + state.edition + " dataset page " + state.page + " (" + state.perPage + " per page)...",
      false
    );

    var params = buildQuery(state);
    fetch("/status/browser?" + params.toString(), {
      cache: "no-store",
      headers: {
        Accept: "application/json"
      }
    })
      .then(function(response) {
        return response.json().catch(function() {
          return {};
        }).then(function(payload) {
          if (!response.ok) {
            throw new Error(parseErrorMessage(response, payload, "Server browser probe failed."));
          }
          return payload;
        });
      })
      .then(function(payload) {
        renderResults(payload);
        renderSummary(payload);
        updatePaginationState(payload, state);
        var succeeded = Number(payload && payload.succeeded);
        var failed = Number(payload && payload.failed);
        if (Number.isFinite(succeeded) && Number.isFinite(failed)) {
          setNote("Probe complete: " + Math.trunc(succeeded) + " succeeded, " + Math.trunc(failed) + " failed.", false);
        } else {
          setNote("Probe complete.", false);
        }
      })
      .catch(function(err) {
        setNote(err && err.message ? err.message : "Server browser probe failed.", true);
      })
      .then(function() {
        setLoadingState(false);
      });
  }

  function copyShareUrl() {
    if (!controls.shareUrl || !controls.shareUrl.value) {
      return;
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(controls.shareUrl.value)
        .then(function() {
          setNote("Share URL copied.", false);
        })
        .catch(function() {
          setNote("Could not copy share URL.", true);
        });
      return;
    }

    controls.shareUrl.select();
    try {
      var copied = document.execCommand("copy");
      setNote(copied ? "Share URL copied." : "Could not copy share URL.", !copied);
    } catch {
      setNote("Could not copy share URL.", true);
    }
  }

  function resetForm() {
    controls.edition.value = defaults.edition;
    controls.timeoutMs.value = String(defaults.timeoutMs);
    controls.concurrency.value = String(defaults.concurrency);
    controls.page.value = String(defaults.page);
    controls.perPage.value = String(defaults.perPage);
    setNote("", false);
    if (controls.summary) {
      controls.summary.textContent = "Run a probe to view summary stats.";
    }
    clearResults();
    var state = readState();
    updateShareUrl(state);
    updatePaginationPlaceholder(state);
  }

  function applyInitialState() {
    var params = new URLSearchParams(window.location.search);
    var dataset = normalizeEdition(params.get("dataset") || params.get("edition") || defaults.edition);
    var timeoutMs = clampInt(params.get("timeoutMs"), defaults.timeoutMs, 100, 10000);
    var concurrency = clampInt(params.get("concurrency"), defaults.concurrency, 1, maxConcurrency);
    var page = clampInt(params.get("page"), defaults.page, 1, 100000);
    var perPage = clampInt(params.get("perPage"), defaults.perPage, 1, maxPerPage);

    controls.edition.value = dataset;
    controls.timeoutMs.value = String(timeoutMs);
    controls.concurrency.value = String(concurrency);
    controls.page.value = String(page);
    controls.perPage.value = String(perPage);

    var state = readState();
    updateShareUrl(state);
    updatePaginationPlaceholder(state);
  }

  controls.probeBtn.addEventListener("click", function() {
    probeServers();
  });
  if (controls.prevBtn) {
    controls.prevBtn.addEventListener("click", function() {
      probeServers(clampInt(controls.page.value, 1, 1, 100000) - 1);
    });
  }
  if (controls.nextBtn) {
    controls.nextBtn.addEventListener("click", function() {
      probeServers(clampInt(controls.page.value, 1, 1, 100000) + 1);
    });
  }
  if (controls.resetBtn) {
    controls.resetBtn.addEventListener("click", resetForm);
  }
  if (controls.copyShareBtn) {
    controls.copyShareBtn.addEventListener("click", copyShareUrl);
  }

  var reactiveControls = [
    controls.edition,
    controls.timeoutMs,
    controls.concurrency,
    controls.page,
    controls.perPage
  ];
  for (var i = 0; i < reactiveControls.length; i++) {
    if (!reactiveControls[i]) {
      continue;
    }
    reactiveControls[i].addEventListener("input", function(event) {
      if (event && event.target === controls.edition) {
        controls.page.value = "1";
      }
      if (event && event.target === controls.perPage) {
        controls.page.value = "1";
      }
      var state = readState();
      updateShareUrl(state);
      updatePaginationPlaceholder(state);
    });
  }

  applyInitialState();
  probeServers();
})();
