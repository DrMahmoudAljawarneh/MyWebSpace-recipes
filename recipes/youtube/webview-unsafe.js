// YouTube In-Page Ad Blocker & Instant Fast-Forward (Runs in Main Page World)
(() => {
  'use strict';

  // --- 1. Strip Ad Placements from Player Responses ---
  // When adPlacements, playerAds, and adSlots are pruned from the player data,
  // the YouTube player never creates ad breaks on the timeline.
  // Returns true when at least one ad field was removed.
  const pruneAds = obj => {
    if (!obj || typeof obj !== 'object') return false;
    let changed = false;
    try {
      if (Array.isArray(obj.adPlacements)) {
        delete obj.adPlacements;
        changed = true;
      }
      if (Array.isArray(obj.playerAds)) {
        delete obj.playerAds;
        changed = true;
      }
      if (Array.isArray(obj.adSlots)) {
        delete obj.adSlots;
        changed = true;
      }
      if (obj.playerResponse) {
        if (Array.isArray(obj.playerResponse.adPlacements)) {
          delete obj.playerResponse.adPlacements;
          changed = true;
        }
        if (Array.isArray(obj.playerResponse.playerAds)) {
          delete obj.playerResponse.playerAds;
          changed = true;
        }
        if (Array.isArray(obj.playerResponse.adSlots)) {
          delete obj.playerResponse.adSlots;
          changed = true;
        }
      }
    } catch {
      // Ignore pruning errors
    }
    return changed;
  };

  // Intercept window.ytInitialPlayerResponse
  try {
    let initialResponse = window.ytInitialPlayerResponse;
    pruneAds(initialResponse);
    Object.defineProperty(window, 'ytInitialPlayerResponse', {
      get: () => initialResponse,
      set: val => {
        pruneAds(val);
        initialResponse = val;
      },
      configurable: true,
      enumerable: true,
    });
  } catch {
    // Property already defined or non-configurable
  }

  // Keep the untouched parser for our own fetch interception below. The page
  // may replace/wrap JSON.parse, so using the global here would double-prune
  // and make the wrapper believe no ads were removed.
  const nativeJSONParse = JSON.parse;

  // Intercept JSON.parse to sanitize incoming player API responses
  try {
    JSON.parse = function (...args) {
      const res = nativeJSONParse.apply(this, args);
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
          let data;
          try {
            data = nativeJSONParse(text);
          } catch {
            return response;
          }
          // Only replace the body when something was actually removed.
          // Re-wrapping every player response can corrupt compressed payloads.
          if (!pruneAds(data)) return response;

          const headers = new Headers(response.headers);
          headers.delete('content-length');
          headers.delete('content-encoding');
          headers.delete('transfer-encoding');
          return new Response(JSON.stringify(data), {
            status: response.status,
            statusText: response.statusText,
            headers,
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
  let resumedForEnforcementDialog = null;

  const isVisible = element => {
    if (!element || !element.isConnected) return false;
    const style = getComputedStyle(element);
    if (
      style.display === 'none' ||
      style.visibility === 'hidden' ||
      Number.parseFloat(style.opacity) === 0
    ) {
      return false;
    }
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  };

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
          if (video.paused && !video.ended) {
            const playPromise = video.play();
            if (playPromise && typeof playPromise.catch === 'function') {
              playPromise.catch(() => {});
            }
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

    // Dismiss any anti-adblock warning modal. YouTube's dialog uses the
    // Polymer `opened` property, not the `opened` attribute, and our CSS hides
    // it before the JavaScript runs. Checking computed visibility alone would
    // therefore never recognize an active dialog.
    const dialog = document.querySelector(
      'ytd-enforcement-message-view-model, tp-yt-paper-dialog:has(ytd-enforcement-message-view-model)',
    );
    if (dialog) {
      const container = dialog.closest('tp-yt-paper-dialog') || dialog;
      const isOpen =
        container.opened === true ||
        container.hasAttribute('opened') ||
        isVisible(container);

      if (isOpen) {
        // Remove the hidden dialog and its backdrop. Clicking the close button
        // does not work while the dialog is hidden by our CSS.
        try {
          container.remove();
          for (const backdrop of document.querySelectorAll(
            'tp-yt-iron-overlay-backdrop[opened]',
          )) {
            backdrop.remove();
          }
        } catch {
          // Ignore element removal error
        }

        // Resume playback only once per enforcement dialog, and never after
        // the media element has reached the end of the video.
        if (
          resumedForEnforcementDialog !== dialog &&
          video &&
          video.paused &&
          !video.ended &&
          !(player && player.classList.contains('ended'))
        ) {
          resumedForEnforcementDialog = dialog;
          try {
            const playPromise = video.play();
            if (playPromise && typeof playPromise.catch === 'function') {
              playPromise.catch(() => {});
            }
          } catch {
            // Ignore play error
          }
        }
      } else if (resumedForEnforcementDialog === dialog) {
        resumedForEnforcementDialog = null;
      }
    } else {
      resumedForEnforcementDialog = null;
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
