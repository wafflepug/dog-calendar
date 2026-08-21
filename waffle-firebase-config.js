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
 * V11.1 release loader + focused follow-ups through V11.1.5.
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

  function loadV1115Script() {
    if (document.querySelector('script[data-waffle-v1115]')) return;

    var patch = document.createElement("script");
    patch.src = "waffle-v11.1.5.js?v=11.1.5";
    patch.async = false;
    patch.setAttribute("data-waffle-v1115", "js");
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
    ensureStylesheet(
      'link[data-waffle-v111]',
      "waffle-v11.1.css?v=11.1.0",
      "data-waffle-v111"
    );

    ensureStylesheet(
      'link[data-waffle-v1111]',
      "waffle-v11.1.1.css?v=11.1.1",
      "data-waffle-v1111"
    );

    ensureStylesheet(
      'link[data-waffle-v1112]',
      "waffle-v11.1.2.css?v=11.1.2",
      "data-waffle-v1112"
    );

    ensureStylesheet(
      'link[data-waffle-v1114]',
      "waffle-v11.1.4.css?v=11.1.4",
      "data-waffle-v1114"
    );

    ensureStylesheet(
      'link[data-waffle-v1115]',
      "waffle-v11.1.5.css?v=11.1.5",
      "data-waffle-v1115"
    );

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

    if (window.v111Initialised) {
      loadV1111Script();
    } else {
      existingBase.addEventListener("load", loadV1111Script, { once: true });
      setTimeout(loadV1111Script, 800);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", loadV111Assets, { once: true });
  } else {
    loadV111Assets();
  }
})();
