// The billboard's background preview, like Netflix and Apple TV: each featured release plays its own
// trailer by itself, muted, behind the art, with no controls showing. No hover (testers found it
// confusing). The full player with controls is the "Watch trailer" dialog (trailer-dialog.js).

const YOUTUBE_ORIGIN = "https://www.youtube-nocookie.com";
const YOUTUBE_ENDED = 0;
const YOUTUBE_PLAYING = 1;
const YOUTUBE_PAUSED = 2;
const YOUTUBE_BUFFERING = 3;
// The preview ends this close to the finish, so YouTube's end screen never shows.
const END_MARGIN = 1.5;
// The art shows first; the preview starts after this beat.
const START_DELAY = 1500;
// A full trailer runs two or three minutes; the billboard moves on after this much.
const PREVIEW_LENGTH = 40000;
// A few seconds into a preview, the text steps back so the video can be seen (tester 6).
const WATCH_DELAY = 3500;
// Sound rises over this long instead of starting at full volume (testers found the start loud).
const SOUND_FADE_IN = 1200;
const SOUND_FADE_STEPS = 12;
// The player ignores messages until its own script has started, so it's asked again until it answers.
const HANDSHAKE_INTERVAL = 250;
// If no frames show by then, this preview isn't coming (blocked, removed or a dead connection).
const LOAD_TIMEOUT = 10000;

const SOUND_ICONS = {
  off: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="m16 9 5 6m0-6-5 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  on: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
};

/* Two players with the same small interface, so the hero doesn't care where the trailer comes from. */

// YouTube is controlled through postMessage (the IFrame API protocol), so no extra script is loaded.
function createYouTubePlayer(
  { youtubeId },
  { title, muted: startMuted, onPlaying, onStall, onNearEnd, onError },
) {
  const frame = document.createElement("iframe");
  const params = new URLSearchParams({
    autoplay: 1,
    mute: startMuted ? 1 : 0,
    controls: 0,
    playsinline: 1,
    rel: 0,
    iv_load_policy: 3,
    disablekb: 1,
    enablejsapi: 1,
    origin: location.origin,
  });
  frame.className = "hero__video hero__video--embed";
  frame.src = `${YOUTUBE_ORIGIN}/embed/${youtubeId}?${params}`;
  frame.title = `${title} trailer`;
  frame.allow = "autoplay; encrypted-media";
  frame.tabIndex = -1;
  frame.setAttribute("aria-hidden", "true");

  let muted = startMuted;
  let lastState = null;
  let nearEnd = false;
  const send = (func, args = []) => {
    frame.contentWindow?.postMessage(
      JSON.stringify({ event: "command", func, args }),
      YOUTUBE_ORIGIN,
    );
  };

  // Asking to "listen" makes the player report its state, which is how the hero knows frames are showing.
  let handshake;
  const listen = () => {
    frame.contentWindow?.postMessage(
      JSON.stringify({ event: "listening", id: 1, channel: "widget" }),
      YOUTUBE_ORIGIN,
    );
  };
  frame.addEventListener("load", () => {
    clearInterval(handshake);
    const started = Date.now();
    listen();
    handshake = setInterval(() => {
      if (!frame.isConnected || Date.now() - started > LOAD_TIMEOUT) clearInterval(handshake);
      else listen();
    }, HANDSHAKE_INTERVAL);
  });
  window.addEventListener("message", (event) => {
    if (event.source !== frame.contentWindow) return;
    clearInterval(handshake);
    let data;
    try {
      data = JSON.parse(event.data);
    } catch {
      return;
    }
    if (data.event === "onError") onError();

    // The player reports its position a few times a second; just before the end, the hero decides
    // whether to loop or finish, so YouTube's end screen and suggestions never appear.
    const { currentTime, duration } = data.info ?? {};
    if (duration > END_MARGIN * 2 && currentTime !== undefined) {
      const ending = duration - currentTime < END_MARGIN;
      if (ending && !nearEnd) onNearEnd();
      nearEnd = ending;
    }

    const state =
      data.event === "onStateChange" ? data.info : data.info?.playerState;
    if (state === undefined || state === lastState) return;
    lastState = state;
    if (state === YOUTUBE_PLAYING) onPlaying();
    // Paused or buffering, YouTube draws its own icons over the video, so the still art covers it.
    if (state === YOUTUBE_PAUSED || state === YOUTUBE_BUFFERING) onStall();
    // A fallback in case the position report just before the end was missed.
    if (state === YOUTUBE_ENDED) onNearEnd();
  });

  return {
    element: frame,
    play: () => {
      send("playVideo");
      return Promise.resolve();
    },
    get muted() {
      return muted;
    },
    set muted(value) {
      muted = value;
      send(value ? "mute" : "unMute");
    },
    setVolume: (value) => send("setVolume", [Math.round(value * 100)]),
  };
}

function createVideoPlayer({ src }, { muted, onPlaying, onStall, onNearEnd, onError }) {
  const video = document.createElement("video");
  video.className = "hero__video";
  video.src = src;
  video.muted = muted;
  video.playsInline = true;
  video.preload = "none";
  video.setAttribute("aria-hidden", "true");
  video.addEventListener("playing", onPlaying);
  video.addEventListener("waiting", onStall);
  video.addEventListener("error", onError, { once: true });
  let nearEnd = false;
  video.addEventListener("timeupdate", () => {
    const ending = video.duration - video.currentTime < END_MARGIN;
    if (ending && !nearEnd) onNearEnd();
    nearEnd = ending;
  });

  return {
    element: video,
    play: () => video.play(),
    get muted() {
      return video.muted;
    },
    set muted(value) {
      video.muted = value;
    },
    setVolume: (value) => {
      video.volume = value;
    },
  };
}

// Reduced motion and data saver get no preview; the art stays and "Watch trailer" is still there.
export function canPreview() {
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  return !reducedMotion && navigator.connection?.saveData !== true;
}

export function createBillboardPreview({ hero, media, soundButton, onFinish }) {
  let player = null;
  let playing = false;
  let loading = false;
  let soundWanted = false;
  let timers = [];
  let fadeTimer;

  // Browsers only allow sound after a click or key press on the page.
  const canPlaySound = () => navigator.userActivation?.hasBeenActive ?? true;

  function later(callback, delay) {
    timers.push(setTimeout(callback, delay));
  }

  function clearTimers() {
    timers.forEach(clearTimeout);
    timers = [];
    clearInterval(fadeTimer);
  }

  function renderSound() {
    const soundOn = Boolean(player && playing && !player.muted);
    soundButton.hidden = !playing || loading;
    soundButton.setAttribute("aria-pressed", String(soundOn));
    soundButton.setAttribute("aria-label", soundOn ? "Mute the preview" : "Turn on the preview's sound");
    soundButton.innerHTML = soundOn ? SOUND_ICONS.on : SOUND_ICONS.off;
  }

  function fadeInSound() {
    clearInterval(fadeTimer);
    let step = 0;
    player.setVolume(0);
    player.muted = false;
    fadeTimer = setInterval(() => {
      step += 1;
      player?.setVolume(step / SOUND_FADE_STEPS);
      if (step >= SOUND_FADE_STEPS) clearInterval(fadeTimer);
    }, SOUND_FADE_IN / SOUND_FADE_STEPS);
  }

  // The art only gives way once real frames are showing, so a slow connection never flashes black.
  function reveal() {
    loading = false;
    hero.classList.remove("hero--loading");
    hero.classList.add("hero--playing");
    if (soundWanted && canPlaySound()) fadeInSound();
    later(() => hero.classList.add("hero--watching"), WATCH_DELAY);
    later(finish, PREVIEW_LENGTH);
    renderSound();
  }

  function onPlaying() {
    if (!playing) return;
    if (loading) reveal();
    else hero.classList.add("hero--playing");
  }

  // Paused or buffering, YouTube draws its own icons over the video, so the still art covers it.
  function onStall() {
    if (playing && !loading) hero.classList.remove("hero--playing");
  }

  function finish() {
    if (!playing) return;
    stop();
    onFinish();
  }

  function stop() {
    clearTimers();
    playing = false;
    loading = false;
    hero.classList.remove("hero--playing", "hero--loading", "hero--watching");
    const old = player;
    player = null;
    if (old) {
      // Silenced straight away, then removed once the fade back to the art is done.
      old.muted = true;
      setTimeout(() => old.element.remove(), 600);
    }
    renderSound();
  }

  // Starts a release's preview after a short beat. Anything already playing stops first.
  function play(trailer, title) {
    stop();
    if (!trailer || !canPreview()) return;
    playing = true;
    loading = true;
    later(() => {
      if (!playing) return;
      hero.classList.add("hero--loading");
      const create = trailer.youtubeId ? createYouTubePlayer : createVideoPlayer;
      player = create(trailer, {
        title,
        muted: true,
        onPlaying,
        onStall,
        onNearEnd: finish,
        onError: () => {
          stop();
          onFinish();
        },
      });
      media.append(player.element);
      if (!trailer.youtubeId) player.play().catch(() => stop());
      // No frames by now: give up quietly and let the billboard move on.
      later(() => {
        if (loading) finish();
      }, LOAD_TIMEOUT);
    }, START_DELAY);
  }

  soundButton.addEventListener("click", () => {
    if (!player) return;
    soundWanted = player.muted;
    if (soundWanted) fadeInSound();
    else player.muted = true;
    renderSound();
  });

  renderSound();

  return {
    play,
    stop,
    // Playing or about to, so the billboard holds still.
    isActive: () => playing,
  };
}
