var valid_user_id = /^[0-9a-f-A-F-]{32,36}$/; // uuid

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
  var hoverTooltipIndex = 0;

  function getPickerTooltip(index) {
    if (index === 0) {
      return "pick me!";
    }
    return ("no ".repeat(index) + "pick me!").trim();
  }

  function assignPickerTooltip(target) {
    if (!target) {
      return;
    }
    if (target.dataset.tooltip) {
      return;
    }
    target.dataset.tooltip = getPickerTooltip(hoverTooltipIndex);
    hoverTooltipIndex += 1;
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
        tryname.value = "";
        showTryAlert((err && err.message) || "Please enter a valid UUID or username.");
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

  if (avatarPickers.length) {
    applyUuid(avatarPickers[0].dataset.uuid);
  }
});
