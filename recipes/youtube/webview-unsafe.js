// YouTube In-Page Ad Blocker & Instant Fast-Forward (Runs in Main Page World)
(() => {
  'use strict';

  // --- 1. Strip Ad Placements from Player Responses ---
  // When adPlacements, playerAds, and adSlots are pruned from the player data,
  // the YouTube player never creates ad breaks on the timeline.
  const pruneAds = obj => {
    if (!obj || typeof obj !== 'object') return obj;
    try {
      if (Array.isArray(obj.adPlacements)) delete obj.adPlacements;
      if (Array.isArray(obj.playerAds)) delete obj.playerAds;
      if (Array.isArray(obj.adSlots)) delete obj.adSlots;
      if (obj.playerResponse) {
        if (Array.isArray(obj.playerResponse.adPlacements))
          delete obj.playerResponse.adPlacements;
        if (Array.isArray(obj.playerResponse.playerAds))
          delete obj.playerResponse.playerAds;
        if (Array.isArray(obj.playerResponse.adSlots))
          delete obj.playerResponse.adSlots;
      }
    } catch {
      // Ignore pruning errors
    }
    return obj;
  };

  // Intercept window.ytInitialPlayerResponse
  try {
    let initialResponse = pruneAds(window.ytInitialPlayerResponse);
    Object.defineProperty(window, 'ytInitialPlayerResponse', {
      get: () => initialResponse,
      set: val => {
        initialResponse = pruneAds(val);
      },
      configurable: true,
      enumerable: true,
    });
  } catch {
    // Property already defined or non-configurable
  }

  // Intercept JSON.parse to sanitize incoming player API responses
  try {
    const origJSONParse = JSON.parse;
    JSON.parse = function (...args) {
      const res = origJSONParse.apply(this, args);
      if (
        res &&
        typeof res === 'object' &&
        (res.adPlacements ||
          res.playerAds ||
          res.adSlots ||
          (res.playerResponse &&
            (res.playerResponse.adPlacements ||
              res.playerResponse.playerAds ||
              res.playerResponse.adSlots)))
      ) {
        pruneAds(res);
      }
      return res;
    };
  } catch {
    // Ignore JSON.parse hook error
  }

  // Intercept window.fetch for /youtubei/v1/player
  try {
    const origFetch = window.fetch;
    window.fetch = async function (...args) {
      const response = await origFetch.apply(this, args);
      try {
        const url =
          typeof args[0] === 'string'
            ? args[0]
            : (args[0] && args[0].url) || '';
        if (url.includes('/youtubei/v1/player')) {
          const clone = response.clone();
          const text = await clone.text();
          let data = JSON.parse(text);
          data = pruneAds(data);
          return new Response(JSON.stringify(data), {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
          });
        }
      } catch {
        // Fall back to original response on any interception failure
      }
      return response;
    };
  } catch {
    // Ignore fetch hook error
  }

  // --- 2. In-Player Ad Handler & Skip Controller ---
  const skipSelectors = [
    '.ytp-skip-ad-button',
    '.ytp-ad-skip-button',
    '.ytp-ad-skip-button-modern',
    '.ytp-ad-skip-button-slot button',
    'button.ytp-ad-skip-button-modern',
    '.ytp-ad-overlay-close-button',
  ];

  let adActive = false;
  let userPlaybackRate = 1;
  let userVolume = 1;
  let wasMutedBeforeAd = false;

  const handleAds = () => {
    const player = document.querySelector('#movie_player, .html5-video-player');
    const video =
      document.querySelector('video.html5-main-video') ||
      document.querySelector('video');

    const isAdShowing =
      player &&
      (player.classList.contains('ad-showing') ||
        player.classList.contains('ad-interrupting'));

    if (isAdShowing) {
      if (!adActive) {
        adActive = true;
        if (video) {
          userPlaybackRate =
            video.playbackRate && video.playbackRate <= 2
              ? video.playbackRate
              : 1;
          wasMutedBeforeAd = video.muted;
          userVolume = video.volume;
        }
      }

      // 1. Try YouTube's internal skipAd player method
      if (player && typeof player.skipAd === 'function') {
        try {
          player.skipAd();
        } catch {
          // Ignore skipAd error
        }
      }

      // 2. Click any visible skip button
      for (const selector of skipSelectors) {
        const btn = document.querySelector(selector);
        if (btn) {
          try {
            btn.click();
          } catch {
            // Ignore click error
          }
        }
      }

      // 3. Fast-forward through non-skippable portions at 16x speed with muted audio.
      // Crucial: DO NOT modify video.currentTime directly! Rapid currentTime seeks trigger
      // YouTube's anti-adblock watchdog / buffer underflow which causes 10s rewinds and resets.
      if (video) {
        try {
          video.muted = true;
          video.playbackRate = 16;
          if (video.paused) {
            video.play();
          }
        } catch {
          // Ignore playback modification error
        }
      }
    } else {
      // Ad has ended or no ad is playing: restore original playback speed and volume
      if (adActive) {
        adActive = false;
        if (video) {
          try {
            video.playbackRate = userPlaybackRate || 1;
            video.muted = wasMutedBeforeAd;
            video.volume = userVolume;
          } catch {
            // Ignore playback restoration error
          }
        }
      }
    }

    // Dismiss any anti-adblock warning modal
    const dialog = document.querySelector(
      'ytd-enforcement-message-view-model, tp-yt-paper-dialog:has(ytd-enforcement-message-view-model)',
    );
    if (dialog) {
      const dismiss = dialog.querySelector(
        '#dismiss-button, button[aria-label="Dismiss"], button[aria-label="Close"]',
      );
      if (dismiss) {
        try {
          dismiss.click();
        } catch {
          // Ignore dismissal error
        }
      } else {
        try {
          dialog.remove();
          for (const b of document.querySelectorAll(
            'tp-yt-iron-overlay-backdrop',
          )) {
            b.remove();
          }
        } catch {
          // Ignore element removal error
        }
      }
      if (video && video.paused) {
        try {
          video.play();
        } catch {
          // Ignore play error
        }
      }
    }
  };

  // Run at 150ms intervals
  setInterval(handleAds, 150);

  // Also monitor player class mutations for instant detection
  const observePlayer = () => {
    const player = document.querySelector('#movie_player, .html5-video-player');
    if (player) {
      const observer = new MutationObserver(() => {
        handleAds();
      });
      observer.observe(player, {
        attributes: true,
        attributeFilter: ['class'],
      });
    } else {
      setTimeout(observePlayer, 500);
    }
  };
  observePlayer();
})();
