(function() {
  var runtimeConfig = window.NITROCRAFT_SERVER_BROWSER_CONFIG || {};
  var defaults = {
    addresses: "mc.hypixel.net\nplay.cubecraft.net",
    edition: "auto",
    timeoutMs: 2200,
    concurrency: 3,
    limit: 10,
    sources: []
  };
  var DEFAULT_SERVER_ICON = "/avatars/069a79f444e94726a5befca90e38aaf5?size=64&overlay";

  var maxAddresses = clampInt(runtimeConfig.maxAddresses, 20, 1, 100);
  var maxConcurrency = clampInt(runtimeConfig.maxConcurrency, 4, 1, 16);
  defaults.concurrency = clampInt(defaults.concurrency, Math.min(3, maxConcurrency), 1, maxConcurrency);
  defaults.limit = clampInt(defaults.limit, Math.min(10, maxAddresses), 1, maxAddresses);

  var controls = {
    addresses: document.querySelector("#nsb-addresses"),
    edition: document.querySelector("#nsb-edition"),
    timeoutMs: document.querySelector("#nsb-timeout-ms"),
    concurrency: document.querySelector("#nsb-concurrency"),
    limit: document.querySelector("#nsb-limit"),
    probeBtn: document.querySelector("#nsb-probe-btn"),
    resetBtn: document.querySelector("#nsb-reset-btn"),
    copyShareBtn: document.querySelector("#nsb-copy-share"),
    shareUrl: document.querySelector("#nsb-share-url"),
    summary: document.querySelector("#nsb-summary"),
    status: document.querySelector("#nsb-status"),
    resultsList: document.querySelector("#nsb-results-list"),
    sourceInputs: document.querySelectorAll("input[name='nsb-source']")
  };

  if (!controls.addresses || !controls.probeBtn || !controls.resultsList) {
    return;
  }

  var inFlight = false;

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

  function splitAddresses(value) {
    return String(value || "")
      .replaceAll("\r", "\n")
      .split(/[\n,]/)
      .map(function(entry) {
        return entry.trim();
      })
      .filter(Boolean);
  }

  function dedupeAddresses(addresses) {
    var seen = Object.create(null);
    var deduped = [];
    for (var i = 0; i < addresses.length; i++) {
      var address = String(addresses[i] || "").trim();
      if (!address) {
        continue;
      }
      var key = address.toLowerCase();
      if (Object.prototype.hasOwnProperty.call(seen, key)) {
        continue;
      }
      seen[key] = true;
      deduped.push(address);
    }
    return deduped;
  }

  function dedupeStrings(values) {
    var seen = Object.create(null);
    var deduped = [];
    for (var i = 0; i < values.length; i++) {
      var value = String(values[i] || "").trim().toLowerCase();
      if (!value || Object.prototype.hasOwnProperty.call(seen, value)) {
        continue;
      }
      seen[value] = true;
      deduped.push(value);
    }
    return deduped;
  }

  function splitSourceIds(value) {
    return String(value || "")
      .replaceAll("\r", "\n")
      .split(/[\n,\s]+/)
      .map(function(entry) {
        return entry.trim().toLowerCase();
      })
      .filter(Boolean);
  }

  function extractInitialAddresses(params) {
    var values = [];
    var direct = params.getAll("address");
    for (var i = 0; i < direct.length; i++) {
      values = values.concat(splitAddresses(direct[i]));
    }

    if (!values.length) {
      var multi = params.getAll("addresses");
      for (var j = 0; j < multi.length; j++) {
        values = values.concat(splitAddresses(multi[j]));
      }
    }

    return dedupeAddresses(values);
  }

  function extractInitialSources(params) {
    var values = [];
    var direct = params.getAll("source");
    for (var i = 0; i < direct.length; i++) {
      values = values.concat(splitSourceIds(direct[i]));
    }
    var grouped = params.getAll("sources");
    for (var j = 0; j < grouped.length; j++) {
      values = values.concat(splitSourceIds(grouped[j]));
    }
    return dedupeStrings(values);
  }

  function readSelectedSources() {
    if (!controls.sourceInputs || !controls.sourceInputs.length) {
      return [];
    }

    var selected = [];
    for (var i = 0; i < controls.sourceInputs.length; i++) {
      var input = controls.sourceInputs[i];
      if (!input || !input.checked) {
        continue;
      }
      selected.push(input.value);
    }
    return dedupeStrings(selected);
  }

  function readState() {
    var addresses = dedupeAddresses(splitAddresses(controls.addresses.value));
    var edition = String(controls.edition.value || "auto").toLowerCase();
    if (edition !== "java" && edition !== "bedrock" && edition !== "auto") {
      edition = "auto";
    }

    var timeoutMs = clampInt(controls.timeoutMs.value, defaults.timeoutMs, 100, 10000);
    var concurrency = clampInt(controls.concurrency.value, defaults.concurrency, 1, maxConcurrency);
    var limit = clampInt(controls.limit.value, defaults.limit, 1, maxAddresses);
    var sources = readSelectedSources();

    controls.timeoutMs.value = String(timeoutMs);
    controls.concurrency.value = String(concurrency);
    controls.limit.value = String(limit);

    return {
      addresses: addresses,
      edition: edition,
      timeoutMs: timeoutMs,
      concurrency: concurrency,
      limit: limit,
      sources: sources
    };
  }

  function buildQuery(state, includeLimit) {
    var params = new URLSearchParams();
    for (var i = 0; i < state.addresses.length; i++) {
      params.append("address", state.addresses[i]);
    }
    params.set("edition", state.edition);
    params.set("timeoutMs", String(state.timeoutMs));
    params.set("concurrency", String(state.concurrency));
    for (var j = 0; j < state.sources.length; j++) {
      params.append("source", state.sources[j]);
    }
    if (includeLimit) {
      params.set("limit", String(state.limit));
    }
    return params;
  }

  function updateShareUrl(state) {
    if (!controls.shareUrl) {
      return;
    }

    var params = buildQuery(state, true);
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
    var edition = String(payload && payload.edition ? payload.edition : "auto");
    var timeoutMs = Number(payload && payload.timeoutMs);
    var sourceSucceeded = Number(payload && payload.sources && payload.sources.succeeded);
    var sourceFailed = Number(payload && payload.sources && payload.sources.failed);

    if (!Number.isFinite(processed) || !Number.isFinite(succeeded) || !Number.isFinite(failed)) {
      controls.summary.textContent = "Run a probe to view summary stats.";
      return;
    }

    var timeoutLabel = Number.isFinite(timeoutMs) ? (Math.trunc(timeoutMs) + "ms") : "n/a";
    var sourceLabel = "";
    if (Number.isFinite(sourceSucceeded) && Number.isFinite(sourceFailed)) {
      sourceLabel = " Sources: " + Math.trunc(sourceSucceeded) + " ok, " + Math.trunc(sourceFailed) + " failed.";
    }

    controls.summary.textContent =
      "Processed " + Math.trunc(processed) +
      " targets (" + Math.trunc(succeeded) + " ok, " + Math.trunc(failed) + " failed) using edition=" + edition +
      " timeout=" + timeoutLabel + "." + sourceLabel;
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

  function probeServers() {
    if (inFlight) {
      return;
    }

    var state = readState();
    if (!state.addresses.length) {
      setNote("Enter at least one server address first.", true);
      controls.addresses.focus();
      return;
    }
    if (state.addresses.length > maxAddresses) {
      setNote("Too many targets. Maximum is " + maxAddresses + ".", true);
      controls.addresses.focus();
      return;
    }

    if (state.limit > state.addresses.length) {
      state.limit = state.addresses.length;
      controls.limit.value = String(state.limit);
    }

    updateShareUrl(state);

    inFlight = true;
    controls.probeBtn.disabled = true;
    controls.probeBtn.textContent = "Probing...";
    setNote("Probing " + state.addresses.length + " target(s)...", false);

    var params = buildQuery(state, true);
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
        inFlight = false;
        controls.probeBtn.disabled = false;
        controls.probeBtn.textContent = "Probe Servers";
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
    controls.addresses.value = defaults.addresses;
    controls.edition.value = defaults.edition;
    controls.timeoutMs.value = String(defaults.timeoutMs);
    controls.concurrency.value = String(defaults.concurrency);
    controls.limit.value = String(defaults.limit);
    if (controls.sourceInputs && controls.sourceInputs.length) {
      for (var i = 0; i < controls.sourceInputs.length; i++) {
        controls.sourceInputs[i].checked = false;
      }
    }
    setNote("", false);
    if (controls.summary) {
      controls.summary.textContent = "Run a probe to view summary stats.";
    }
    clearResults();
    updateShareUrl(readState());
  }

  function applyInitialState() {
    var params = new URLSearchParams(window.location.search);
    var initialAddresses = extractInitialAddresses(params);
    var initialSources = extractInitialSources(params);
    var selectAllSources = initialSources.indexOf("all") > -1;
    if (initialAddresses.length) {
      controls.addresses.value = initialAddresses.join("\n");
    } else {
      controls.addresses.value = defaults.addresses;
    }

    var edition = String(params.get("edition") || "").trim().toLowerCase();
    controls.edition.value = (edition === "java" || edition === "bedrock" || edition === "auto")
      ? edition
      : defaults.edition;

    controls.timeoutMs.value = String(clampInt(params.get("timeoutMs"), defaults.timeoutMs, 100, 10000));
    controls.concurrency.value = String(clampInt(params.get("concurrency"), defaults.concurrency, 1, maxConcurrency));
    controls.limit.value = String(clampInt(params.get("limit"), defaults.limit, 1, maxAddresses));
    if (controls.sourceInputs && controls.sourceInputs.length) {
      for (var i = 0; i < controls.sourceInputs.length; i++) {
        var input = controls.sourceInputs[i];
        if (!input) {
          continue;
        }
        var inputValue = String(input.value || "").trim().toLowerCase();
        var isSelected = selectAllSources || initialSources.indexOf(inputValue) > -1;
        input.checked = isSelected;
      }
    }

    updateShareUrl(readState());
  }

  controls.probeBtn.addEventListener("click", probeServers);
  if (controls.resetBtn) {
    controls.resetBtn.addEventListener("click", resetForm);
  }
  if (controls.copyShareBtn) {
    controls.copyShareBtn.addEventListener("click", copyShareUrl);
  }

  var reactiveControls = [
    controls.addresses,
    controls.edition,
    controls.timeoutMs,
    controls.concurrency,
    controls.limit
  ];
  for (var i = 0; i < reactiveControls.length; i++) {
    if (!reactiveControls[i]) {
      continue;
    }
    reactiveControls[i].addEventListener("input", function() {
      updateShareUrl(readState());
    });
  }
  if (controls.sourceInputs && controls.sourceInputs.length) {
    for (var j = 0; j < controls.sourceInputs.length; j++) {
      if (!controls.sourceInputs[j]) {
        continue;
      }
      controls.sourceInputs[j].addEventListener("change", function() {
        updateShareUrl(readState());
      });
    }
  }

  applyInitialState();
})();
