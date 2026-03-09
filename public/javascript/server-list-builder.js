(function() {
  var defaults = {
    serverName: "NitroCraft Network",
    motdLine1: "\u00a7bNitroCraft \u00a77| \u00a7aFast API || \u00a73NitroCraft \u00a77| \u00a7eFast API || \u00a7dNitroCraft \u00a77| \u00a7bFast API",
    motdLine2: "\u00a77Avatars, skins, renders, status",
    animationMs: 700,
    online: 24,
    max: 250,
    version: "1.21.x",
    ping: 5,
    icon: "/avatars/069a79f444e94726a5befca90e38aaf5?size=64&overlay"
  };

  var controls = {
    serverName: document.querySelector("#slb-server-name"),
    motdLine1: document.querySelector("#slb-motd-line1"),
    motdLine2: document.querySelector("#slb-motd-line2"),
    animationMs: document.querySelector("#slb-animation-ms"),
    online: document.querySelector("#slb-online"),
    max: document.querySelector("#slb-max"),
    version: document.querySelector("#slb-version"),
    ping: document.querySelector("#slb-ping"),
    iconFile: document.querySelector("#slb-icon-file"),
    iconUrl: document.querySelector("#slb-icon-url"),
    importAddress: document.querySelector("#slb-import-address"),
    importEdition: document.querySelector("#slb-import-edition"),
    importPort: document.querySelector("#slb-import-port"),
    importBtn: document.querySelector("#slb-import-btn"),
    importStatus: document.querySelector("#slb-import-status"),
    iconStatus: document.querySelector("#slb-icon-status"),
    activeTarget: document.querySelector("#slb-active-target"),
    formatStatus: document.querySelector("#slb-format-status"),
    formatInsertButtons: document.querySelectorAll("[data-slb-insert-code], [data-slb-insert-text]"),
    formatTemplateButtons: document.querySelectorAll("[data-slb-template]"),
    shareUrl: document.querySelector("#slb-share-url"),
    copyShare: document.querySelector("#slb-copy-share"),
    reset: document.querySelector("#slb-reset")
  };

  var preview = {
    icon: document.querySelector("#slb-preview-java-icon"),
    name: document.querySelector("#slb-preview-java-name"),
    version: document.querySelector("#slb-preview-java-version"),
    motdLine1: document.querySelector("#slb-preview-java-motd-line1"),
    motdLine2: document.querySelector("#slb-preview-java-motd-line2"),
    players: document.querySelector("#slb-preview-java-players"),
    ping: document.querySelector("#slb-preview-java-ping")
  };

  if (!controls.serverName || !preview.icon) {
    return;
  }

  var state = Object.assign({}, defaults);
  var motdRenderTimer = null;
  var motdCycleTimer = null;
  var motdRenderToken = 0;
  var activeMotdInput = null;

  var motdTemplates = {
    rainbow: "\u00a7cN\u00a76i\u00aet\u00a7ar\u00a7bo\u00a7dC\u00a75r\u00a79a\u00a7af\u00a7bt || \u00a7fNitroCraft",
    pulse: "\u00a7c[SALE] || \u00a7e[SALE] || \u00a7a[SALE]",
    status: "\u00a7aOnline || \u00a7eRestarting Soon || \u00a7cMaintenance"
  };
  var safeIconDataUrlPattern = /^data:image\/(?:png|jpeg|jpg|gif|webp|bmp|x-icon);base64,[a-z0-9+/=]+$/i;
  var minecraftColorMap = {
    "0": "#000000",
    "1": "#0000aa",
    "2": "#00aa00",
    "3": "#00aaaa",
    "4": "#aa0000",
    "5": "#aa00aa",
    "6": "#ffaa00",
    "7": "#aaaaaa",
    "8": "#555555",
    "9": "#5555ff",
    a: "#55ff55",
    b: "#55ffff",
    c: "#ff5555",
    d: "#ff55ff",
    e: "#ffff55",
    f: "#ffffff"
  };

  function clampNumber(value, fallback, min, max) {
    var parsed = Number.parseInt(String(value || ""), 10);
    if (!Number.isFinite(parsed)) {
      parsed = fallback;
    }
    if (min !== undefined && parsed < min) {
      parsed = min;
    }
    if (max !== undefined && parsed > max) {
      parsed = max;
    }
    return parsed;
  }

  function sanitizeIconSource(value) {
    var raw = String(value || "").trim();
    if (!raw) {
      return defaults.icon;
    }
    if (raw.startsWith("data:")) {
      return safeIconDataUrlPattern.test(raw) ? raw : defaults.icon;
    }
    try {
      var parsed = new URL(raw, window.location.origin);
      var isHttp = parsed.protocol === "http:" || parsed.protocol === "https:";
      if (!isHttp || parsed.origin !== window.location.origin) {
        return defaults.icon;
      }
      return parsed.pathname + parsed.search + parsed.hash;
    } catch {
      return defaults.icon;
    }
  }

  function encodeSafeIconSource(value) {
    return encodeURI(sanitizeIconSource(value));
  }

  function setNote(element, message, isError) {
    if (!element) {
      return;
    }
    element.textContent = message || "";
    element.classList.toggle("is-error", Boolean(isError && message));
    element.classList.toggle("is-ok", Boolean(!isError && message));
  }

  function motdInputLabel(input) {
    if (input === controls.motdLine2) {
      return "MOTD Line 2";
    }
    return "MOTD Line 1";
  }

  function setActiveTargetNote(input) {
    if (!controls.activeTarget) {
      return;
    }
    controls.activeTarget.textContent = "Active input: " + motdInputLabel(input);
  }

  function rememberSelection(input) {
    if (!input) {
      return;
    }
    var start = Number.isFinite(input.selectionStart) ? input.selectionStart : input.value.length;
    var end = Number.isFinite(input.selectionEnd) ? input.selectionEnd : start;
    input.setAttribute("data-slb-selection-start", String(start));
    input.setAttribute("data-slb-selection-end", String(end));
  }

  function readStoredSelection(input) {
    var start = Number.parseInt(input.getAttribute("data-slb-selection-start") || "", 10);
    var end = Number.parseInt(input.getAttribute("data-slb-selection-end") || "", 10);
    var valueLength = input.value.length;
    if (!Number.isFinite(start) || start < 0) {
      start = valueLength;
    }
    if (!Number.isFinite(end) || end < start) {
      end = start;
    }
    if (start > valueLength) {
      start = valueLength;
    }
    if (end > valueLength) {
      end = valueLength;
    }
    return { start: start, end: end };
  }

  function setActiveMotdInput(input) {
    if (input !== controls.motdLine1 && input !== controls.motdLine2) {
      return;
    }
    activeMotdInput = input;
    rememberSelection(input);
    setActiveTargetNote(input);
  }

  function applySharedBuilderLinkParams(sharedUrl, params) {
    var parsed;
    try {
      parsed = new URL(sharedUrl, window.location.origin);
    } catch {
      return false;
    }

    if (parsed.pathname !== window.location.pathname) {
      return false;
    }

    var imported = false;
    var keys = ["n", "m1", "m2", "am", "o", "x", "v", "p", "i"];
    var sourceParams = parsed.searchParams;
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      if (params.has(key) || !sourceParams.has(key)) {
        continue;
      }
      params.set(key, sourceParams.get(key) || "");
      imported = true;
    }

    return imported;
  }

  function parseInitialParams() {
    var params = new URLSearchParams(window.location.search);
    var sharedTitle = String(params.get("shareTitle") || "").trim();
    var sharedText = String(params.get("shareText") || "").trim();
    var sharedUrl = String(params.get("shareUrl") || "").trim();
    var importedSharedBuilderLink = false;

    if (sharedUrl) {
      importedSharedBuilderLink = applySharedBuilderLinkParams(sharedUrl, params);
      if (!importedSharedBuilderLink && controls.importAddress && !controls.importAddress.value) {
        try {
          var parsedShared = new URL(sharedUrl, window.location.origin);
          controls.importAddress.value = parsedShared.host || parsedShared.hostname || "";
        } catch {
          controls.importAddress.value = "";
        }
      }
    }

    if (!params.has("n") && sharedTitle) {
      state.serverName = sharedTitle;
    }
    if (!params.has("m1") && sharedText) {
      state.motdLine1 = sharedText;
    }

    if (params.has("n")) {
      state.serverName = params.get("n") || defaults.serverName;
    }
    if (params.has("m1")) {
      state.motdLine1 = params.get("m1") || "";
    }
    if (params.has("m2")) {
      state.motdLine2 = params.get("m2") || "";
    }
    if (params.has("am")) {
      state.animationMs = clampNumber(params.get("am"), defaults.animationMs, 120, 5000);
    }
    if (params.has("o")) {
      state.online = clampNumber(params.get("o"), defaults.online, 0, 999999);
    }
    if (params.has("x")) {
      state.max = clampNumber(params.get("x"), defaults.max, 1, 999999);
    }
    if (params.has("v")) {
      state.version = params.get("v") || defaults.version;
    }
    if (params.has("p")) {
      state.ping = clampNumber(params.get("p"), defaults.ping, 0, 5);
    }
    if (params.has("i")) {
      state.icon = sanitizeIconSource(params.get("i") || defaults.icon);
    }

    if (importedSharedBuilderLink) {
      setNote(controls.importStatus, "Imported settings from shared builder link.", false);
    } else if (sharedUrl && controls.importAddress && controls.importAddress.value) {
      setNote(controls.importStatus, "Shared URL detected. Click Import Status to fetch live data.", false);
    }
  }

  function writeStateToControls() {
    controls.serverName.value = state.serverName;
    controls.motdLine1.value = state.motdLine1;
    controls.motdLine2.value = state.motdLine2;
    if (controls.animationMs) {
      controls.animationMs.value = String(state.animationMs);
    }
    controls.online.value = String(state.online);
    controls.max.value = String(state.max);
    controls.version.value = state.version;
    controls.ping.value = String(state.ping);
    controls.iconUrl.value = state.icon;
  }

  function readStateFromControls() {
    state.serverName = String(controls.serverName.value || "").slice(0, 64);
    state.motdLine1 = String(controls.motdLine1.value || "").slice(0, 120);
    state.motdLine2 = String(controls.motdLine2.value || "").slice(0, 120);
    state.animationMs = clampNumber(controls.animationMs ? controls.animationMs.value : defaults.animationMs, defaults.animationMs, 120, 5000);
    state.online = clampNumber(controls.online.value, defaults.online, 0, 999999);
    state.max = clampNumber(controls.max.value, defaults.max, 1, 999999);
    state.version = String(controls.version.value || "").slice(0, 32);
    state.ping = clampNumber(controls.ping.value, defaults.ping, 0, 5);
    state.icon = sanitizeIconSource(controls.iconUrl.value);
  }

  function updatePingBars(target, level) {
    if (!target) {
      return;
    }
    var bars = target.querySelectorAll("span");
    for (var i = 0; i < bars.length; i++) {
      bars[i].classList.toggle("is-on", i < level);
    }
    target.setAttribute("aria-label", level + " ping bars");
    target.setAttribute("data-bars", String(level));
  }

  function clearMotdCycleTimer() {
    if (!motdCycleTimer) {
      return;
    }
    window.clearInterval(motdCycleTimer);
    motdCycleTimer = null;
  }

  function splitMotdFrames(value) {
    var raw = String(value || "");
    if (!raw.includes("||")) {
      return [raw];
    }

    var frames = raw.split("||").map(function(part) {
      return part.trim();
    }).filter(function(part) {
      return part.length > 0;
    });

    return frames.length ? frames : [raw];
  }

  function expandFrameList(values, frameCount) {
    var expanded = [];
    if (!values.length) {
      values = [""];
    }

    for (var i = 0; i < frameCount; i++) {
      var index = i < values.length ? i : values.length - 1;
      expanded.push(values[index]);
    }
    return expanded;
  }

  function createMotdStyle() {
    return {
      color: "",
      bold: false,
      italic: false,
      underline: false,
      strike: false
    };
  }

  function applyStyleCode(style, code) {
    if (Object.prototype.hasOwnProperty.call(minecraftColorMap, code)) {
      style.color = minecraftColorMap[code];
      style.bold = false;
      style.italic = false;
      style.underline = false;
      style.strike = false;
      return true;
    }

    if (code === "l") {
      style.bold = true;
      return true;
    }
    if (code === "m") {
      style.strike = true;
      return true;
    }
    if (code === "n") {
      style.underline = true;
      return true;
    }
    if (code === "o") {
      style.italic = true;
      return true;
    }
    if (code === "r") {
      style.color = "";
      style.bold = false;
      style.italic = false;
      style.underline = false;
      style.strike = false;
      return true;
    }
    return false;
  }

  function isStyleCode(code) {
    return (
      Object.prototype.hasOwnProperty.call(minecraftColorMap, code) ||
      code === "l" ||
      code === "m" ||
      code === "n" ||
      code === "o" ||
      code === "r"
    );
  }

  function styleTokenElement(element, style) {
    if (!element) {
      return;
    }
    if (style.color) {
      element.style.color = style.color;
    }
    if (style.bold) {
      element.style.fontWeight = "700";
    }
    if (style.italic) {
      element.style.fontStyle = "italic";
    }

    var decorations = [];
    if (style.underline) {
      decorations.push("underline");
    }
    if (style.strike) {
      decorations.push("line-through");
    }
    if (decorations.length) {
      element.style.textDecoration = decorations.join(" ");
    }
  }

  function renderMotdLine(target, text) {
    if (!target) {
      return;
    }

    var source = String(text || "");
    var fragment = document.createDocumentFragment();
    var style = createMotdStyle();
    var buffer = "";

    function flushBuffer() {
      if (!buffer) {
        return;
      }
      var token = document.createElement("span");
      token.textContent = buffer;
      styleTokenElement(token, style);
      fragment.appendChild(token);
      buffer = "";
    }

    for (var i = 0; i < source.length; i++) {
      var char = source.charAt(i);
      if (char === "\u00a7" && i + 1 < source.length) {
        var code = source.charAt(i + 1).toLowerCase();
        if (isStyleCode(code)) {
          flushBuffer();
          applyStyleCode(style, code);
          i++;
          continue;
        }
      }
      buffer += char;
    }

    flushBuffer();

    if (!fragment.childNodes.length) {
      fragment.appendChild(document.createTextNode("\u00a0"));
    }

    target.replaceChildren(fragment);
  }

  function renderMotd() {
    var token = ++motdRenderToken;
    clearMotdCycleTimer();

    var line1Frames = splitMotdFrames(state.motdLine1);
    var line2Frames = splitMotdFrames(state.motdLine2);
    var frameCount = Math.max(line1Frames.length, line2Frames.length);
    var expandedLine1 = expandFrameList(line1Frames, frameCount);
    var expandedLine2 = expandFrameList(line2Frames, frameCount);
    var currentFrame = 0;

    var applyFrame = function(index) {
      if (token !== motdRenderToken) {
        return;
      }
      renderMotdLine(preview.motdLine1, expandedLine1[index] || "");
      renderMotdLine(preview.motdLine2, expandedLine2[index] || "");
    };

    applyFrame(0);

    if (frameCount > 1) {
      motdCycleTimer = window.setInterval(function() {
        if (token !== motdRenderToken) {
          clearMotdCycleTimer();
          return;
        }
        currentFrame = (currentFrame + 1) % frameCount;
        applyFrame(currentFrame);
      }, state.animationMs);
    }
  }

  function scheduleMotdRender() {
    if (motdRenderTimer) {
      window.clearTimeout(motdRenderTimer);
    }
    motdRenderTimer = window.setTimeout(renderMotd, 100);
  }

  function updateShareUrl() {
    var params = new URLSearchParams();
    params.set("n", state.serverName);
    params.set("m1", state.motdLine1);
    params.set("m2", state.motdLine2);
    params.set("am", String(state.animationMs));
    params.set("o", String(state.online));
    params.set("x", String(state.max));
    params.set("v", state.version);
    params.set("p", String(state.ping));

    var includeIcon = state.icon && state.icon !== defaults.icon && state.icon.length <= 3500;
    if (includeIcon) {
      params.set("i", state.icon);
      setNote(controls.iconStatus, "", false);
    } else if (state.icon && state.icon.length > 3500) {
      setNote(controls.iconStatus, "Share URL skipped icon because it is too large.", true);
    }

    var relative = window.location.pathname + "?" + params.toString();
    var absolute = window.location.origin + relative;
    controls.shareUrl.value = absolute;
    history.replaceState(null, "", relative);
  }

  function updatePreview() {
    var fallbackName = state.serverName || "Minecraft Server";
    var players = state.online + "/" + state.max;

    preview.name.textContent = fallbackName;
    preview.version.textContent = state.version ? ("v" + state.version) : "";
    preview.players.textContent = players;
    preview.icon.src = encodeSafeIconSource(state.icon);
    updatePingBars(preview.ping, state.ping);

    scheduleMotdRender();
    updateShareUrl();
  }

  function fileToDataUrl(file) {
    return new Promise(function(resolve, reject) {
      var reader = new FileReader();
      reader.onload = function() {
        resolve(String(reader.result || ""));
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function loadImage(src) {
    return new Promise(function(resolve, reject) {
      var img = new Image();
      img.onload = function() {
        resolve(img);
      };
      img.onerror = reject;
      img.src = src;
    });
  }

  function normalizeIconToDataUrl(source) {
    return loadImage(source).then(function(img) {
      var canvas = document.createElement("canvas");
      canvas.width = 64;
      canvas.height = 64;
      var context = canvas.getContext("2d");
      if (!context) {
        throw new Error("No canvas context");
      }
      context.imageSmoothingEnabled = false;
      context.clearRect(0, 0, 64, 64);
      context.drawImage(img, 0, 0, 64, 64);
      return canvas.toDataURL("image/png");
    });
  }

  function resolveFormatTargetInput() {
    var focused = document.activeElement;
    if (focused === controls.motdLine1 || focused === controls.motdLine2) {
      setActiveMotdInput(focused);
      return focused;
    }
    if (activeMotdInput === controls.motdLine1 || activeMotdInput === controls.motdLine2) {
      return activeMotdInput;
    }
    return controls.motdLine1;
  }

  function insertIntoActiveMotd(insertText, successMessage) {
    var input = resolveFormatTargetInput();
    if (!input) {
      return;
    }

    var isFocused = document.activeElement === input;
    var start = input.value.length;
    var end = input.value.length;
    if (isFocused && Number.isFinite(input.selectionStart) && Number.isFinite(input.selectionEnd)) {
      start = input.selectionStart;
      end = input.selectionEnd;
    } else {
      var storedSelection = readStoredSelection(input);
      start = storedSelection.start;
      end = storedSelection.end;
    }

    var before = input.value.slice(0, start);
    var after = input.value.slice(end);

    input.value = before + insertText + after;
    var nextPos = start + insertText.length;
    input.focus();
    if (input.setSelectionRange) {
      input.setSelectionRange(nextPos, nextPos);
    }
    setActiveMotdInput(input);

    readStateFromControls();
    updatePreview();
    setNote(
      controls.formatStatus,
      successMessage || ("Inserted into " + motdInputLabel(input) + "."),
      false
    );
  }

  function applyMotdTemplate(name) {
    var template = motdTemplates[name];
    if (!template) {
      return;
    }
    insertIntoActiveMotd(
      template,
      "Inserted " + name + " template into " + motdInputLabel(resolveFormatTargetInput()) + "."
    );
  }

  function readImportPayload(statusPayload, address) {
    var motd = "";
    var versionName = "";
    var online = state.online;
    var max = state.max;
    var favicon = "";

    if (statusPayload && typeof statusPayload.motd === "string") {
      motd = statusPayload.motd;
    }
    if (statusPayload && statusPayload.version && typeof statusPayload.version.name === "string") {
      versionName = statusPayload.version.name;
    }
    if (statusPayload && statusPayload.players) {
      if (Number.isFinite(statusPayload.players.online)) {
        online = clampNumber(statusPayload.players.online, online, 0, 999999);
      }
      if (Number.isFinite(statusPayload.players.max)) {
        max = clampNumber(statusPayload.players.max, max, 1, 999999);
      }
    }
    if (statusPayload && typeof statusPayload.favicon === "string" && statusPayload.favicon.startsWith("data:image/")) {
      favicon = statusPayload.favicon;
    }

    var motdLines = String(motd || "").replaceAll("\r", "").split("\n");
    var line1 = motdLines[0] || "";
    var line2 = motdLines.slice(1).join(" ").trim();

    if (!line2 && line1.includes(" | ")) {
      var split = line1.split(" | ");
      line1 = split[0] || line1;
      line2 = split.slice(1).join(" | ");
    }

    return {
      serverName: String(address || state.serverName).trim() || state.serverName,
      motdLine1: line1 || state.motdLine1,
      motdLine2: line2 || state.motdLine2,
      online: online,
      max: max,
      version: versionName || state.version,
      icon: favicon
    };
  }

  function parseErrorMessage(response, payload, fallback) {
    if (payload && typeof payload.error === "string" && payload.error.trim()) {
      return payload.error;
    }
    if (response && response.status) {
      return fallback + " (HTTP " + response.status + ")";
    }
    return fallback;
  }

  function importFromServer() {
    var address = String(controls.importAddress.value || "").trim();
    if (!address) {
      setNote(controls.importStatus, "Enter a server address first.", true);
      controls.importAddress.focus();
      return;
    }

    var edition = String(controls.importEdition.value || "auto");
    var port = String(controls.importPort.value || "").trim();
    var query = new URLSearchParams();
    query.set("address", address);
    query.set("edition", edition);
    if (port) {
      query.set("port", port);
    }

    controls.importBtn.disabled = true;
    controls.importBtn.textContent = "Importing...";
    setNote(controls.importStatus, "", false);

    fetch("/status/server?" + query.toString(), { cache: "no-store" })
      .then(function(response) {
        return response.json().then(function(payload) {
          if (!response.ok) {
            throw new Error(parseErrorMessage(response, payload, "Failed to import server status."));
          }
          return payload;
        });
      })
      .then(function(payload) {
        var imported = readImportPayload(payload, address);
        controls.serverName.value = imported.serverName;
        controls.motdLine1.value = imported.motdLine1;
        controls.motdLine2.value = imported.motdLine2;
        controls.online.value = String(imported.online);
        controls.max.value = String(imported.max);
        controls.version.value = imported.version;

        if (imported.icon) {
          controls.iconUrl.value = imported.icon;
        }

        var edition = String((payload && payload.edition) || controls.importEdition.value || "auto").toLowerCase();
        var shouldFetchIcon = !imported.icon && edition !== "bedrock";

        if (!shouldFetchIcon) {
          readStateFromControls();
          updatePreview();
          setNote(controls.importStatus, "Imported " + address + " successfully.", false);
          return;
        }

        var iconQuery = new URLSearchParams();
        iconQuery.set("address", address);
        if (port) {
          iconQuery.set("port", port);
        }

        return fetch("/status/icon?" + iconQuery.toString(), { cache: "no-store" })
          .then(function(iconResponse) {
            if (!iconResponse.ok) {
              return null;
            }
            return iconResponse.json();
          })
          .then(function(iconPayload) {
            if (iconPayload && typeof iconPayload.dataUri === "string") {
              controls.iconUrl.value = iconPayload.dataUri;
            }
          })
          .catch(function() {
            return null;
          })
          .then(function() {
            readStateFromControls();
            updatePreview();
            setNote(controls.importStatus, "Imported " + address + " successfully.", false);
          });
      })
      .catch(function(err) {
        setNote(controls.importStatus, err && err.message ? err.message : "Failed to import server status.", true);
      })
      .then(function() {
        controls.importBtn.disabled = false;
        controls.importBtn.textContent = "Import Status";
      });
  }

  function copyShareUrl() {
    var value = controls.shareUrl.value;
    if (!value) {
      return;
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(value).then(function() {
        setNote(controls.importStatus, "Share URL copied.", false);
      }).catch(function() {
        setNote(controls.importStatus, "Could not copy share URL.", true);
      });
      return;
    }

    controls.shareUrl.select();
    try {
      var copied = document.execCommand("copy");
      setNote(controls.importStatus, copied ? "Share URL copied." : "Could not copy share URL.", !copied);
    } catch {
      setNote(controls.importStatus, "Could not copy share URL.", true);
    }
  }

  function resetBuilder() {
    state = Object.assign({}, defaults);
    writeStateToControls();
    setActiveMotdInput(controls.motdLine1);
    readStateFromControls();
    setNote(controls.importStatus, "", false);
    setNote(controls.iconStatus, "", false);
    history.replaceState(null, "", window.location.pathname);
    updatePreview();
  }

  function bindActiveMotdTracking(input) {
    if (!input) {
      return;
    }

    var events = ["focus", "click", "keyup", "select", "input"];
    for (var i = 0; i < events.length; i++) {
      input.addEventListener(events[i], function() {
        setActiveMotdInput(input);
      });
    }
  }

  controls.serverName.addEventListener("input", function() {
    readStateFromControls();
    updatePreview();
  });
  controls.motdLine1.addEventListener("input", function() {
    setActiveMotdInput(controls.motdLine1);
    readStateFromControls();
    updatePreview();
  });
  controls.motdLine2.addEventListener("input", function() {
    setActiveMotdInput(controls.motdLine2);
    readStateFromControls();
    updatePreview();
  });
  if (controls.animationMs) {
    controls.animationMs.addEventListener("input", function() {
      readStateFromControls();
      updatePreview();
    });
  }
  controls.online.addEventListener("input", function() {
    readStateFromControls();
    updatePreview();
  });
  controls.max.addEventListener("input", function() {
    readStateFromControls();
    updatePreview();
  });
  controls.version.addEventListener("input", function() {
    readStateFromControls();
    updatePreview();
  });
  controls.ping.addEventListener("change", function() {
    readStateFromControls();
    updatePreview();
  });
  controls.iconUrl.addEventListener("input", function() {
    readStateFromControls();
    updatePreview();
  });

  controls.iconFile.addEventListener("change", function() {
    var file = controls.iconFile.files && controls.iconFile.files[0];
    if (!file) {
      return;
    }

    fileToDataUrl(file)
      .then(normalizeIconToDataUrl)
      .then(function(dataUrl) {
        controls.iconUrl.value = dataUrl;
        readStateFromControls();
        updatePreview();
        setNote(controls.iconStatus, "Icon loaded and resized to 64x64 PNG.", false);
      })
      .catch(function() {
        setNote(controls.iconStatus, "Could not load this icon file.", true);
      });
  });

  if (controls.formatInsertButtons && controls.formatInsertButtons.length) {
    for (var i = 0; i < controls.formatInsertButtons.length; i++) {
      controls.formatInsertButtons[i].addEventListener("click", function() {
        var code = this.getAttribute("data-slb-insert-code");
        var text = this.getAttribute("data-slb-insert-text");
        if (code) {
          insertIntoActiveMotd("\u00a7" + code);
          return;
        }
        if (text) {
          insertIntoActiveMotd(text);
        }
      });
    }
  }

  if (controls.formatTemplateButtons && controls.formatTemplateButtons.length) {
    for (var j = 0; j < controls.formatTemplateButtons.length; j++) {
      controls.formatTemplateButtons[j].addEventListener("click", function() {
        var templateName = this.getAttribute("data-slb-template");
        if (!templateName) {
          return;
        }
        applyMotdTemplate(templateName);
      });
    }
  }

  controls.importBtn.addEventListener("click", importFromServer);
  controls.copyShare.addEventListener("click", copyShareUrl);
  controls.reset.addEventListener("click", resetBuilder);
  bindActiveMotdTracking(controls.motdLine1);
  bindActiveMotdTracking(controls.motdLine2);

  parseInitialParams();
  writeStateToControls();
  setActiveMotdInput(controls.motdLine1);
  readStateFromControls();
  updatePreview();
})();
