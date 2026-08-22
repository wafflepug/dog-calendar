/*
 * Waffle Boarding House — Firebase Cloud Messaging public configuration
 *
 * These are PUBLIC web-app configuration values, not service-account secrets.
 * Fill them from Firebase Console -> Project settings -> Your apps -> Web app,
 * plus Cloud Messaging -> Web Push certificates -> public VAPID key.
 *
 * Never place FIREBASE_PRIVATE_KEY or service-account JSON in this file.
 */
(function (root) {
  root.WAFFLE_FIREBASE_CONFIG = Object.freeze({
    apiKey: "AIzaSyCd0ZoUgE4yX68tXyiMrdQnMezohMtJeRU",
    authDomain: "wafflehouse-86739.firebaseapp.com",
    projectId: "wafflehouse-86739",
    messagingSenderId: "1326197754",
    appId: "1:1326197754:web:496af9ddba30ad41741243",
    vapidKey: "BM8uEzEkdsv4Wa9NCKq0uH_JOvP2tt8vf5ldXt_I_msaXsJAWXMhvP67JTKpY8Fq4s_l0F0quHAhQysae4oTfoU"
  });
})(typeof self !== "undefined" ? self : window);

/*
 * V11.1 release loader + focused follow-ups through V11.1.13.
 * This file is also imported by the service worker, so browser DOM access is
 * deliberately guarded. Each patch loads after the previous layer.
 */
(function () {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  function ensureStylesheet(selector, href, marker) {
    if (document.querySelector(selector)) return;
    var stylesheet = document.createElement("link");
    stylesheet.rel = "stylesheet";
    stylesheet.href = href;
    stylesheet.setAttribute(marker, "css");
    document.head.appendChild(stylesheet);
  }

  function loadV11113Script() {
    if (document.querySelector('script[data-waffle-v11113]')) return;
    var patch = document.createElement("script");
    patch.src = "waffle-v11.1.13.js?v=11.1.13";
    patch.async = false;
    patch.setAttribute("data-waffle-v11113", "js");
    document.body.appendChild(patch);
  }

  function loadV11112Script() {
    var existing = document.querySelector('script[data-waffle-v11112]');
    if (existing) {
      existing.addEventListener("load", loadV11113Script, { once: true });
      setTimeout(loadV11113Script, 500);
      return;
    }
    var patch = document.createElement("script");
    patch.src = "waffle-v11.1.12.js?v=11.1.12";
    patch.async = false;
    patch.setAttribute("data-waffle-v11112", "js");
    patch.addEventListener("load", loadV11113Script, { once: true });
    document.body.appendChild(patch);
  }

  function loadV11111Script() {
    var existing = document.querySelector('script[data-waffle-v11111]');
    if (existing) {
      existing.addEventListener("load", loadV11112Script, { once: true });
      setTimeout(loadV11112Script, 500);
      return;
    }
    var patch = document.createElement("script");
    patch.src = "waffle-v11.1.11.js?v=11.1.11";
    patch.async = false;
    patch.setAttribute("data-waffle-v11111", "js");
    patch.addEventListener("load", loadV11112Script, { once: true });
    document.body.appendChild(patch);
  }

  function loadV11110Script() {
    var existing = document.querySelector('script[data-waffle-v11110]');
    if (existing) {
      existing.addEventListener("load", loadV11111Script, { once: true });
      setTimeout(loadV11111Script, 500);
      return;
    }
    var patch = document.createElement("script");
    patch.src = "waffle-v11.1.10.js?v=11.1.10";
    patch.async = false;
    patch.setAttribute("data-waffle-v11110", "js");
    patch.addEventListener("load", loadV11111Script, { once: true });
    document.body.appendChild(patch);
  }

  function loadV1119Script() {
    var existing = document.querySelector('script[data-waffle-v1119]');
    if (existing) {
      existing.addEventListener("load", loadV11110Script, { once: true });
      setTimeout(loadV11110Script, 500);
      return;
    }
    var patch = document.createElement("script");
    patch.src = "waffle-v11.1.9.js?v=11.1.9";
    patch.async = false;
    patch.setAttribute("data-waffle-v1119", "js");
    patch.addEventListener("load", loadV11110Script, { once: true });
    document.body.appendChild(patch);
  }

  function loadV1118Script() {
    var existing = document.querySelector('script[data-waffle-v1118]');
    if (existing) {
      existing.addEventListener("load", loadV1119Script, { once: true });
      setTimeout(loadV1119Script, 500);
      return;
    }
    var patch = document.createElement("script");
    patch.src = "waffle-v11.1.8.js?v=11.1.8";
    patch.async = false;
    patch.setAttribute("data-waffle-v1118", "js");
    patch.addEventListener("load", loadV1119Script, { once: true });
    document.body.appendChild(patch);
  }

  function loadV1117Script() {
    var existing = document.querySelector('script[data-waffle-v1117]');
    if (existing) {
      existing.addEventListener("load", loadV1118Script, { once: true });
      setTimeout(loadV1118Script, 500);
      return;
    }
    var patch = document.createElement("script");
    patch.src = "waffle-v11.1.7.js?v=11.1.7";
    patch.async = false;
    patch.setAttribute("data-waffle-v1117", "js");
    patch.addEventListener("load", loadV1118Script, { once: true });
    document.body.appendChild(patch);
  }

  function loadV1116Script() {
    var existing = document.querySelector('script[data-waffle-v1116]');
    if (existing) {
      existing.addEventListener("load", loadV1117Script, { once: true });
      setTimeout(loadV1117Script, 500);
      return;
    }
    var patch = document.createElement("script");
    patch.src = "waffle-v11.1.6.js?v=11.1.6";
    patch.async = false;
    patch.setAttribute("data-waffle-v1116", "js");
    patch.addEventListener("load", loadV1117Script, { once: true });
    document.body.appendChild(patch);
  }

  function loadV1115Script() {
    var existing = document.querySelector('script[data-waffle-v1115]');
    if (existing) {
      existing.addEventListener("load", loadV1116Script, { once: true });
      setTimeout(loadV1116Script, 500);
      return;
    }
    var patch = document.createElement("script");
    patch.src = "waffle-v11.1.5.js?v=11.1.5";
    patch.async = false;
    patch.setAttribute("data-waffle-v1115", "js");
    patch.addEventListener("load", loadV1116Script, { once: true });
    document.body.appendChild(patch);
  }

  function loadV1114Script() {
    var existing = document.querySelector('script[data-waffle-v1114]');
    if (existing) {
      existing.addEventListener("load", loadV1115Script, { once: true });
      setTimeout(loadV1115Script, 500);
      return;
    }
    var patch = document.createElement("script");
    patch.src = "waffle-v11.1.4.js?v=11.1.4";
    patch.async = false;
    patch.setAttribute("data-waffle-v1114", "js");
    patch.addEventListener("load", loadV1115Script, { once: true });
    document.body.appendChild(patch);
  }

  function loadV1112Script() {
    var existing = document.querySelector('script[data-waffle-v1112]');
    if (existing) {
      existing.addEventListener("load", loadV1114Script, { once: true });
      setTimeout(loadV1114Script, 500);
      return;
    }
    var patch = document.createElement("script");
    patch.src = "waffle-v11.1.2.js?v=11.1.2";
    patch.async = false;
    patch.setAttribute("data-waffle-v1112", "js");
    patch.addEventListener("load", loadV1114Script, { once: true });
    document.body.appendChild(patch);
  }

  function loadV1111Script() {
    var existing = document.querySelector('script[data-waffle-v1111]');
    if (existing) {
      existing.addEventListener("load", loadV1112Script, { once: true });
      setTimeout(loadV1112Script, 600);
      return;
    }
    var patch = document.createElement("script");
    patch.src = "waffle-v11.1.1.js?v=11.1.1";
    patch.async = false;
    patch.setAttribute("data-waffle-v1111", "js");
    patch.addEventListener("load", loadV1112Script, { once: true });
    document.body.appendChild(patch);
  }

  function loadV111Assets() {
    ensureStylesheet('link[data-waffle-v111]', "waffle-v11.1.css?v=11.1.0", "data-waffle-v111");
    ensureStylesheet('link[data-waffle-v1111]', "waffle-v11.1.1.css?v=11.1.1", "data-waffle-v1111");
    ensureStylesheet('link[data-waffle-v1112]', "waffle-v11.1.2.css?v=11.1.2", "data-waffle-v1112");
    ensureStylesheet('link[data-waffle-v1114]', "waffle-v11.1.4.css?v=11.1.4", "data-waffle-v1114");
    ensureStylesheet('link[data-waffle-v1115]', "waffle-v11.1.5.css?v=11.1.5", "data-waffle-v1115");
    ensureStylesheet('link[data-waffle-v1116]', "waffle-v11.1.6.css?v=11.1.6", "data-waffle-v1116");
    ensureStylesheet('link[data-waffle-v1117]', "waffle-v11.1.7.css?v=11.1.7", "data-waffle-v1117");
    ensureStylesheet('link[data-waffle-v1118]', "waffle-v11.1.8.css?v=11.1.8", "data-waffle-v1118");
    ensureStylesheet('link[data-waffle-v11110]', "waffle-v11.1.10.css?v=11.1.10", "data-waffle-v11110");
    ensureStylesheet('link[data-waffle-v11111]', "waffle-v11.1.11.css?v=11.1.11", "data-waffle-v11111");
    ensureStylesheet('link[data-waffle-v11112]', "waffle-v11.1.12.css?v=11.1.12", "data-waffle-v11112");
    ensureStylesheet('link[data-waffle-v11113]', "waffle-v11.1.13.css?v=11.1.13", "data-waffle-v11113");

    var existingBase = document.querySelector('script[data-waffle-v111]');
    if (!existingBase) {
      var script = document.createElement("script");
      script.src = "waffle-v11.1.js?v=11.1.0";
      script.async = false;
      script.setAttribute("data-waffle-v111", "js");
      script.addEventListener("load", loadV1111Script, { once: true });
      document.body.appendChild(script);
      return;
    }

    if (window.v111Initialised) loadV1111Script();
    else {
      existingBase.addEventListener("load", loadV1111Script, { once: true });
      setTimeout(loadV1111Script, 800);
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", loadV111Assets, { once: true });
  else loadV111Assets();
})();
