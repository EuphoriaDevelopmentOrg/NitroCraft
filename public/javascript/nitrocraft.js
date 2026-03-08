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

document.addEventListener("DOMContentLoaded", function(event) {
  var avatars = document.querySelector("#avatar-wrapper");
  var avatarPickers = [];
  var backToTop = document.querySelector("#back-to-top");
  var backToTopThreshold = 420;
  var pickerTooltip = null;
  var activeTooltipTarget = null;
  var quickLinks = document.querySelectorAll(".quick-link[data-template]");
  var codeBlocks = document.querySelectorAll("#documentation .code");

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
    for (var i = 0; i < avatars.children.length; i++) {
      avatars.appendChild(avatars.children[Math.random() * i | 0]);
    }

    avatarPickers = avatars.querySelectorAll(".avatar-picker");

    var movePickerFocus = function(current, offset) {
      var currentIndex = -1;
      for (var m = 0; m < avatarPickers.length; m++) {
        if (avatarPickers[m] === current) {
          currentIndex = m;
          break;
        }
      }
      if (currentIndex === -1 || !avatarPickers.length) {
        return;
      }
      var nextIndex = (currentIndex + offset + avatarPickers.length) % avatarPickers.length;
      var nextPicker = avatarPickers[nextIndex];
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
          if (avatarPickers.length) {
            avatarPickers[0].focus();
            clearTryAlert();
            applyUuid(avatarPickers[0].dataset.uuid);
            showPickerTooltip(avatarPickers[0]);
          }
        } else if (e.key === "End") {
          e.preventDefault();
          if (avatarPickers.length) {
            var lastPicker = avatarPickers[avatarPickers.length - 1];
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
      link.href = link.dataset.template.replace("$", normalized);
    }
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
      images[j].src = images[j].dataset.src.replace("$", normalized);
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
    return;
  }

  setupCodeCopyButtons();

  tryit.onsubmit = function(e) {
    e.preventDefault();
    clearTryAlert();
    var fallback = avatarPickers.length ? avatarPickers[0].dataset.uuid : "853c80ef3c3749fdaa49938b674adae6";
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
    applyUuid(avatarPickers[0].dataset.uuid);
  }
});
