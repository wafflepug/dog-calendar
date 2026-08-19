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
