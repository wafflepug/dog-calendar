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
 * V11.1 release loader.
 * This file is also imported by the service worker, so browser DOM access is
 * deliberately guarded. Loading the release layer here lets all existing app
 * pages receive the same feature module without duplicating markup changes.
 */
(function () {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  function loadV111Assets() {
    if (!document.querySelector('link[data-waffle-v111]')) {
      var stylesheet = document.createElement("link");
      stylesheet.rel = "stylesheet";
      stylesheet.href = "waffle-v11.1.css?v=11.1.0";
      stylesheet.setAttribute("data-waffle-v111", "css");
      document.head.appendChild(stylesheet);
    }

    if (!document.querySelector('script[data-waffle-v111]')) {
      var script = document.createElement("script");
      script.src = "waffle-v11.1.js?v=11.1.0";
      script.async = false;
      script.setAttribute("data-waffle-v111", "js");
      document.body.appendChild(script);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", loadV111Assets, { once: true });
  } else {
    loadV111Assets();
  }
})();
