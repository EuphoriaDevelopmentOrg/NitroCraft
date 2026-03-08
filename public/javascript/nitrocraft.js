var valid_user_id = /^[0-9a-f-A-F-]{32,36}$/; // uuid

if ("serviceWorker" in navigator) {
  window.addEventListener("load", function() {
    navigator.serviceWorker.register("/sw.js").catch(function() {});
  });
}

fetch("/status/mc", { cache: "no-store" }).then(function(r) {
  return r.json();
}).then(function(data) {
  var report = data && data.report;
  if (!report || !report.skins || !report.session) {
    return;
  }

  var textures_err = report.skins.status !== "up";
  var session_err = report.session.status !== "up";

  if (textures_err || session_err) {
    var warn = document.createElement("div");
    warn.setAttribute("class", "alert alert-warning");
    warn.setAttribute("role", "alert");
    warn.innerHTML = "<h5>Mojang issues</h5> Mojang's servers are having trouble <i>right now</i>, this may affect requests at NitroCraft.";
    var alerts = document.querySelector("#alerts");
    if (alerts) {
      alerts.appendChild(warn);
    }
  }
}).catch(function() {});

document.addEventListener("DOMContentLoaded", function() {
  var avatars = document.querySelector("#avatar-wrapper");
  var avatarPickers = [];
  var pinnedAvatarPickers = [];
  var visibleAvatarPickers = [];
  var avatarPickerStep = 70;
  var backToTop = document.querySelector("#back-to-top");
  var backToTopThreshold = 420;
  var pickerTooltip = null;
  var activeTooltipTarget = null;
  var quickLinks = document.querySelectorAll(".quick-link[data-template]");
  var codeBlocks = document.querySelectorAll("#documentation .code");
  var sdkEndpoint = document.querySelector("#sdk-endpoint");
  var sdkLanguage = document.querySelector("#sdk-language");
  var sdkSnippetCode = document.querySelector("#sdk-snippet-code");
  var apiCallCountValue = document.querySelector("#api-call-count-value");
  var apiCallPollTimer = null;
  var apiCallFetchInFlight = false;
  var apiCallPollIntervalMs = 5000;
  var numberFormatter = null;
  var sampleUuid = "069a79f444e94726a5befca90e38aaf5";
  var samplePlayer = "Notch";

  if (typeof Intl !== "undefined" && Intl.NumberFormat) {
    numberFormatter = new Intl.NumberFormat("en-US");
  }

  function formatCount(value) {
    if (!Number.isFinite(value)) {
      return null;
    }
    if (numberFormatter) {
      return numberFormatter.format(value);
    }
    return String(Math.trunc(value));
  }

  function setApiCallCountValue(value) {
    if (!apiCallCountValue) {
      return;
    }
    var formatted = formatCount(value);
    if (!formatted) {
      return;
    }
    apiCallCountValue.textContent = formatted;
  }

  function fetchApiCallCount() {
    if (!apiCallCountValue || apiCallFetchInFlight) {
      return;
    }

    apiCallFetchInFlight = true;
    fetch("/metrics/api-calls", {
      cache: "no-store",
      headers: {
        Accept: "application/json"
      }
    }).then(function(response) {
      if (!response.ok) {
        throw new Error("api call count request failed");
      }
      return response.json();
    }).then(function(payload) {
      var value = Number(payload && payload.apiCalls);
      if (Number.isFinite(value)) {
        setApiCallCountValue(value);
      }
    }).catch(function() {}).then(function() {
      apiCallFetchInFlight = false;
    });
  }

  function startApiCallPolling() {
    if (!apiCallCountValue || apiCallPollTimer) {
      return;
    }
    fetchApiCallCount();
    apiCallPollTimer = window.setInterval(fetchApiCallCount, apiCallPollIntervalMs);
  }

  function stopApiCallPolling() {
    if (!apiCallPollTimer) {
      return;
    }
    window.clearInterval(apiCallPollTimer);
    apiCallPollTimer = null;
  }

  function isPinnedPicker(picker) {
    return !!(picker && picker.dataset && picker.dataset.pinned === "true");
  }

  function refreshPinnedAvatarPickers() {
    pinnedAvatarPickers = [];
    for (var i = 0; i < avatarPickers.length; i++) {
      if (isPinnedPicker(avatarPickers[i])) {
        pinnedAvatarPickers.push(avatarPickers[i]);
      }
    }
  }

  function refreshVisibleAvatarPickers() {
    visibleAvatarPickers = [];
    for (var i = 0; i < avatarPickers.length; i++) {
      if (!avatarPickers[i].hidden) {
        visibleAvatarPickers.push(avatarPickers[i]);
      }
    }
  }

  function calculateVisibleAvatarCount() {
    if (!avatars || !avatarPickers.length) {
      return 0;
    }

    var containerWidth = avatars.clientWidth;
    if (!Number.isFinite(containerWidth) || containerWidth <= 0) {
      return avatarPickers.length;
    }

    var step = avatarPickerStep;
    if (!Number.isFinite(step) || step <= 0) {
      step = 70;
    }

    var count = Math.floor(containerWidth / step);
    if (count < 1) {
      count = 1;
    }
    if (count > avatarPickers.length) {
      count = avatarPickers.length;
    }
    return count;
  }

  function applyAvatarVisibilityLimit() {
    if (!avatars || !avatarPickers.length) {
      return;
    }

    var visibleCount = calculateVisibleAvatarCount();
    refreshPinnedAvatarPickers();
    if (visibleCount < pinnedAvatarPickers.length) {
      visibleCount = pinnedAvatarPickers.length;
    }
    var remainingSlots = Math.max(0, visibleCount - pinnedAvatarPickers.length);
    var hasActiveVisible = false;

    for (var i = 0; i < avatarPickers.length; i++) {
      var picker = avatarPickers[i];
      var isVisible = false;
      if (isPinnedPicker(picker)) {
        isVisible = true;
      } else if (remainingSlots > 0) {
        isVisible = true;
        remainingSlots -= 1;
      }
      picker.hidden = !isVisible;

      if (isVisible) {
        picker.removeAttribute("aria-hidden");
        picker.removeAttribute("tabindex");
        if (picker.classList.contains("is-active")) {
          hasActiveVisible = true;
        }
      } else {
        picker.setAttribute("aria-hidden", "true");
        picker.tabIndex = -1;
      }
    }

    refreshVisibleAvatarPickers();

    if (!hasActiveVisible && visibleAvatarPickers.length) {
      setActivePicker(visibleAvatarPickers[0].dataset.uuid);
      if (tryname && !tryname.value) {
        tryname.value = visibleAvatarPickers[0].dataset.uuid;
      }
    }

    if (activeTooltipTarget && activeTooltipTarget.hidden) {
      hidePickerTooltip();
    }
  }

  function shuffleArray(items) {
    for (var i = items.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = items[i];
      items[i] = items[j];
      items[j] = tmp;
    }
  }

  function randomizeAvatarPickerOrder() {
    if (!avatars) {
      return;
    }

    var currentPickers = avatars.querySelectorAll(".avatar-picker");
    var pinned = [];
    var other = [];

    for (var i = 0; i < currentPickers.length; i++) {
      if (isPinnedPicker(currentPickers[i])) {
        pinned.push(currentPickers[i]);
      } else {
        other.push(currentPickers[i]);
      }
    }

    shuffleArray(other);
    var ordered = pinned.concat(other);
    for (var k = 0; k < ordered.length; k++) {
      avatars.appendChild(ordered[k]);
    }
  }

  function assignPickerTooltip(target) {
    if (!target) {
      return;
    }
    if (target.dataset.tooltip) {
      return;
    }
    var label = target.getAttribute("aria-label") || target.getAttribute("title") || "Use this sample UUID";
    target.dataset.tooltip = label;
  }

  function ensurePickerTooltip() {
    if (pickerTooltip) {
      return;
    }
    pickerTooltip = document.createElement("div");
    pickerTooltip.className = "avatar-tooltip";
    pickerTooltip.setAttribute("role", "tooltip");
    pickerTooltip.setAttribute("aria-hidden", "true");
    document.body.appendChild(pickerTooltip);
  }

  function positionPickerTooltip(target) {
    if (!pickerTooltip || !target) {
      return;
    }

    var rect = target.getBoundingClientRect();
    var gap = 10;

    pickerTooltip.style.left = "0px";
    pickerTooltip.style.top = "0px";

    var tipRect = pickerTooltip.getBoundingClientRect();
    var top = rect.top - tipRect.height - gap;
    var placement = "top";

    if (top < 8) {
      top = rect.bottom + gap;
      placement = "bottom";
    }

    var left = rect.left + ((rect.width - tipRect.width) / 2);
    var minLeft = 8;
    var maxLeft = window.innerWidth - tipRect.width - 8;
    left = Math.min(Math.max(left, minLeft), Math.max(minLeft, maxLeft));

    pickerTooltip.style.left = Math.round(left) + "px";
    pickerTooltip.style.top = Math.round(top) + "px";
    pickerTooltip.setAttribute("data-placement", placement);
  }

  function showPickerTooltip(target) {
    if (!target) {
      return;
    }
    assignPickerTooltip(target);
    if (!target.dataset.tooltip) {
      return;
    }
    ensurePickerTooltip();
    activeTooltipTarget = target;
    pickerTooltip.textContent = target.dataset.tooltip;
    pickerTooltip.setAttribute("aria-hidden", "false");
    pickerTooltip.classList.add("is-visible");
    positionPickerTooltip(target);
  }

  function hidePickerTooltip() {
    activeTooltipTarget = null;
    if (!pickerTooltip) {
      return;
    }
    pickerTooltip.classList.remove("is-visible");
    pickerTooltip.setAttribute("aria-hidden", "true");
  }

  if (avatars) {
    randomizeAvatarPickerOrder();

    avatarPickers = avatars.querySelectorAll(".avatar-picker");
    refreshPinnedAvatarPickers();
    if (avatarPickers.length) {
      var estimatedStep = avatars.scrollWidth / avatarPickers.length;
      if (Number.isFinite(estimatedStep) && estimatedStep > 0) {
        avatarPickerStep = estimatedStep;
      }
    }
    applyAvatarVisibilityLimit();

    var movePickerFocus = function(current, offset) {
      var pickerList = visibleAvatarPickers.length ? visibleAvatarPickers : avatarPickers;
      var currentIndex = -1;
      for (var m = 0; m < pickerList.length; m++) {
        if (pickerList[m] === current) {
          currentIndex = m;
          break;
        }
      }
      if (currentIndex === -1 || !pickerList.length) {
        return;
      }
      var nextIndex = (currentIndex + offset + pickerList.length) % pickerList.length;
      var nextPicker = pickerList[nextIndex];
      if (!nextPicker) {
        return;
      }
      nextPicker.focus();
      clearTryAlert();
      applyUuid(nextPicker.dataset.uuid);
      showPickerTooltip(nextPicker);
    };

    for (var t = 0; t < avatarPickers.length; t++) {
      avatarPickers[t].removeAttribute("title");
      avatarPickers[t].addEventListener("mouseenter", function() {
        showPickerTooltip(this);
      });
      avatarPickers[t].addEventListener("mouseleave", hidePickerTooltip);
      avatarPickers[t].addEventListener("focus", function() {
        showPickerTooltip(this);
      });
      avatarPickers[t].addEventListener("blur", hidePickerTooltip);
      avatarPickers[t].addEventListener("keydown", function(e) {
        if (e.key === "ArrowRight" || e.key === "ArrowDown") {
          e.preventDefault();
          movePickerFocus(this, 1);
        } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
          e.preventDefault();
          movePickerFocus(this, -1);
        } else if (e.key === "Home") {
          e.preventDefault();
          var pickerList = visibleAvatarPickers.length ? visibleAvatarPickers : avatarPickers;
          if (pickerList.length) {
            pickerList[0].focus();
            clearTryAlert();
            applyUuid(pickerList[0].dataset.uuid);
            showPickerTooltip(pickerList[0]);
          }
        } else if (e.key === "End") {
          e.preventDefault();
          var pickerList = visibleAvatarPickers.length ? visibleAvatarPickers : avatarPickers;
          if (pickerList.length) {
            var lastPicker = pickerList[pickerList.length - 1];
            lastPicker.focus();
            clearTryAlert();
            applyUuid(lastPicker.dataset.uuid);
            showPickerTooltip(lastPicker);
          }
        }
      });
    }
  }

  window.addEventListener("scroll", function() {
    if (activeTooltipTarget) {
      positionPickerTooltip(activeTooltipTarget);
    }
  }, { passive: true });

  window.addEventListener("resize", function() {
    applyAvatarVisibilityLimit();
    if (activeTooltipTarget) {
      positionPickerTooltip(activeTooltipTarget);
    }
  });

  if (backToTop) {
    var updateBackToTop = function() {
      if (window.scrollY > backToTopThreshold) {
        backToTop.classList.add("is-visible");
      } else {
        backToTop.classList.remove("is-visible");
      }
    };

    backToTop.addEventListener("click", function() {
      if (window.location.hash) {
        history.replaceState(null, "", window.location.pathname + window.location.search);
      }
      window.scrollTo({
        top: 0,
        behavior: "smooth"
      });
    });

    window.addEventListener("scroll", updateBackToTop, { passive: true });
    updateBackToTop();
  }

  var tryit = document.querySelector("#tryit");
  var tryname = document.querySelector("#tryname");
  var images = document.querySelectorAll(".tryit");
  var trySubmit = tryit ? tryit.querySelector("input[type='submit']") : null;

  function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function(resolve, reject) {
      var textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.setAttribute("readonly", "");
      textArea.style.position = "fixed";
      textArea.style.left = "-9999px";
      document.body.appendChild(textArea);
      textArea.select();
      try {
        var copied = document.execCommand("copy");
        document.body.removeChild(textArea);
        if (!copied) {
          reject(new Error("Copy failed"));
          return;
        }
        resolve();
      } catch (error) {
        document.body.removeChild(textArea);
        reject(error);
      }
    });
  }

  function updateQuickLinks(uuid) {
    var normalized = normalizeUuid(uuid);
    if (!valid_user_id.test(normalized)) {
      return;
    }
    for (var q = 0; q < quickLinks.length; q++) {
      var link = quickLinks[q];
      if (!link || !link.dataset || !link.dataset.template) {
        continue;
      }
      link.href = link.dataset.template.replaceAll("$", normalized);
    }
  }

  function buildSnippetUrl(template) {
    var resolved = String(template || "")
      .replaceAll("{uuid}", sampleUuid)
      .replaceAll("{uuid-or-username}", samplePlayer);
    if (!resolved.startsWith("/")) {
      resolved = "/" + resolved;
    }
    return window.location.origin + resolved;
  }

  function buildSdkSnippet() {
    if (!sdkEndpoint || !sdkLanguage || !sdkSnippetCode) {
      return;
    }

    var template = sdkEndpoint.value;
    var language = sdkLanguage.value;
    var url = buildSnippetUrl(template);
    var snippet = "";

    if (language === "javascript") {
      snippet = [
        "const response = await fetch(\"" + url + "\", {",
        "  headers: { Accept: \"application/json\" },",
        "});",
        "",
        "const isJson = (response.headers.get(\"content-type\") || \"\").includes(\"application/json\");",
        "const payload = isJson ? await response.json() : await response.blob();",
        "console.log(payload);"
      ].join("\n");
    } else if (language === "python") {
      snippet = [
        "import requests",
        "",
        "response = requests.get(\"" + url + "\", timeout=10)",
        "content_type = response.headers.get(\"content-type\", \"\")",
        "payload = response.json() if \"application/json\" in content_type else response.content",
        "print(payload)"
      ].join("\n");
    } else {
      snippet = [
        "curl -L \\",
        "  -H \"Accept: application/json\" \\",
        "  \"" + url + "\""
      ].join("\n");
    }

    sdkSnippetCode.textContent = snippet;
  }

  function setupCodeCopyButtons() {
    for (var c = 0; c < codeBlocks.length; c++) {
      var block = codeBlocks[c];
      if (!block || block.querySelector(".code-copy")) {
        continue;
      }
      block.classList.add("with-copy");

      var button = document.createElement("button");
      button.type = "button";
      button.className = "code-copy";
      button.setAttribute("aria-label", "Copy endpoint");
      button.textContent = "Copy";
      block.appendChild(button);

      button.addEventListener("click", function(e) {
        e.preventDefault();
        var currentButton = this;
        var source = currentButton.parentNode;
        if (!source) {
          return;
        }
        var clone = source.cloneNode(true);
        var cloneButton = clone.querySelector(".code-copy");
        if (cloneButton && cloneButton.parentNode) {
          cloneButton.parentNode.removeChild(cloneButton);
        }
        var text = clone.textContent ? clone.textContent.trim() : "";
        if (!text) {
          return;
        }
        copyToClipboard(text).then(function() {
          currentButton.textContent = "Copied";
          window.setTimeout(function() {
            currentButton.textContent = "Copy";
          }, 1200);
        }).catch(function() {
          currentButton.textContent = "Error";
          window.setTimeout(function() {
            currentButton.textContent = "Copy";
          }, 1200);
        });
      });
    }
  }

  function clearTryAlert() {
    var existing = document.querySelector("#tryit-alert");
    if (existing && existing.parentNode) {
      existing.parentNode.removeChild(existing);
    }
  }

  function showTryAlert(message) {
    var alerts = document.querySelector("#alerts");
    if (!alerts) {
      return;
    }
    clearTryAlert();
    var warn = document.createElement("div");
    warn.id = "tryit-alert";
    warn.setAttribute("class", "alert alert-warning");
    warn.setAttribute("role", "alert");
    warn.textContent = message;
    alerts.appendChild(warn);
  }

  function normalizeUuid(value) {
    return String(value || "").replace(/-/g, "").toLowerCase();
  }

  function setActivePicker(value) {
    var normalized = normalizeUuid(value);
    for (var i = 0; i < avatarPickers.length; i++) {
      var picker = avatarPickers[i];
      var isActive = normalizeUuid(picker.dataset.uuid) === normalized;
      picker.classList.toggle("is-active", isActive);
      picker.setAttribute("aria-pressed", isActive ? "true" : "false");
    }
  }

  function applyUuid(value) {
    var normalized = normalizeUuid(value);
    if (!valid_user_id.test(normalized)) {
      return false;
    }
    tryname.value = normalized;
    for (var j = 0; j < images.length; j++) {
      images[j].src = images[j].dataset.src.replaceAll("$", normalized);
    }
    setActivePicker(normalized);
    updateQuickLinks(normalized);
    return true;
  }

  function resolveUuid(value) {
    var normalized = normalizeUuid(value);
    if (valid_user_id.test(normalized)) {
      return Promise.resolve(normalized);
    }

    return fetch("/players/" + encodeURIComponent(value), { cache: "no-store" })
      .then(function(response) {
        return response.json().then(function(payload) {
          if (!response.ok) {
            var message = payload && payload.error ? payload.error : "Could not resolve that username.";
            throw new Error(message);
          }
          return payload;
        });
      })
      .then(function(payload) {
        var resolved = normalizeUuid(payload && payload.id ? payload.id : "");
        if (!valid_user_id.test(resolved)) {
          throw new Error("Could not resolve that username.");
        }
        return resolved;
      });
  }

  if (!tryit || !tryname) {
    if (apiCallCountValue) {
      startApiCallPolling();
      document.addEventListener("visibilitychange", function() {
        if (document.hidden) {
          stopApiCallPolling();
        } else {
          startApiCallPolling();
        }
      });
    }
    return;
  }

  setupCodeCopyButtons();
  buildSdkSnippet();

  if (sdkEndpoint) {
    sdkEndpoint.addEventListener("change", buildSdkSnippet);
  }
  if (sdkLanguage) {
    sdkLanguage.addEventListener("change", buildSdkSnippet);
  }

  tryit.onsubmit = function(e) {
    e.preventDefault();
    clearTryAlert();
    var fallbackPickers = visibleAvatarPickers.length ? visibleAvatarPickers : avatarPickers;
    var fallback = fallbackPickers.length ? fallbackPickers[0].dataset.uuid : "853c80ef3c3749fdaa49938b674adae6";
    var value = tryname.value.trim() || fallback;

    if (trySubmit) {
      trySubmit.disabled = true;
      trySubmit.value = "Loading...";
    }

    resolveUuid(value)
      .then(function(uuid) {
        applyUuid(uuid);
      })
      .catch(function(err) {
        showTryAlert((err && err.message) || "Please enter a valid UUID or username.");
        tryname.focus();
        tryname.select();
      })
      .then(function() {
        if (trySubmit) {
          trySubmit.disabled = false;
          trySubmit.value = "Go!";
        }
      });
  };

  for (var k = 0; k < avatarPickers.length; k++) {
    avatarPickers[k].addEventListener("click", function(e) {
      e.preventDefault();
      hidePickerTooltip();
      clearTryAlert();
      applyUuid(this.dataset.uuid);
    });
  }

  tryname.addEventListener("input", clearTryAlert);
  document.addEventListener("keydown", function(e) {
    var target = e.target;
    var isEditable = target && (
      target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.isContentEditable
    );
    if (isEditable) {
      return;
    }
    if (e.key === "/") {
      e.preventDefault();
      tryname.focus();
      tryname.select();
    }
  });

  if (avatarPickers.length) {
    var initialPickers = visibleAvatarPickers.length ? visibleAvatarPickers : avatarPickers;
    if (initialPickers.length) {
      applyUuid(initialPickers[0].dataset.uuid);
    }
  }

  if (apiCallCountValue) {
    startApiCallPolling();
    document.addEventListener("visibilitychange", function() {
      if (document.hidden) {
        stopApiCallPolling();
      } else {
        startApiCallPolling();
      }
    });
  }
});
