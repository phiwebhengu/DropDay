const HOVER_DELAY = 500;
const FADE_OUT = 500;
// If sound was blocked and nothing is showing by now, it starts again muted instead of sitting there.
const BLOCKED_FALLBACK = 1500;
const YOUTUBE_ORIGIN = 'https://www.youtube-nocookie.com';
const YOUTUBE_PLAYING = 1;

const SOUND_ICONS = {
  off: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="m16 9 5 6m0-6-5 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  on: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
};

/* Two players with the same small interface, so the hero doesn't care where the trailer comes from. */

// YouTube is controlled through postMessage (the IFrame API protocol), so no extra script is loaded.
function createYouTubePlayer({ youtubeId }, { title, muted: startMuted, onPlaying, onError }) {
  const frame = document.createElement('iframe');
  const params = new URLSearchParams({
    autoplay: 1,
    mute: startMuted ? 1 : 0,
    controls: 0,
    loop: 1,
    playlist: youtubeId,
    playsinline: 1,
    rel: 0,
    iv_load_policy: 3,
    disablekb: 1,
    enablejsapi: 1,
    origin: location.origin,
  });
  frame.className = 'hero__video hero__video--embed';
  frame.src = `${YOUTUBE_ORIGIN}/embed/${youtubeId}?${params}`;
  frame.title = `${title} trailer`;
  frame.allow = 'autoplay; encrypted-media';
  frame.tabIndex = -1;
  frame.setAttribute('aria-hidden', 'true');

  let muted = startMuted;
  const send = (func, args = []) => {
    frame.contentWindow?.postMessage(JSON.stringify({ event: 'command', func, args }), YOUTUBE_ORIGIN);
  };

  // Asking to "listen" makes the player report its state, which is how the hero knows frames are showing.
  frame.addEventListener('load', () => {
    frame.contentWindow?.postMessage(JSON.stringify({ event: 'listening', id: 1, channel: 'widget' }), YOUTUBE_ORIGIN);
  });
  window.addEventListener('message', (event) => {
    if (event.source !== frame.contentWindow) return;
    let data;
    try {
      data = JSON.parse(event.data);
    } catch {
      return;
    }
    if (data.event === 'onError') onError();
    const state = data.event === 'onStateChange' ? data.info : data.info?.playerState;
    if (state === YOUTUBE_PLAYING) onPlaying();
  });

  return {
    element: frame,
    play: () => {
      send('playVideo');
      return Promise.resolve();
    },
    rewind: () => {
      send('pauseVideo');
      send('seekTo', [0, true]);
    },
    get muted() {
      return muted;
    },
    set muted(value) {
      muted = value;
      send(value ? 'mute' : 'unMute');
    },
  };
}

function createVideoPlayer({ src }, { muted, onPlaying, onError }) {
  const video = document.createElement('video');
  video.className = 'hero__video';
  video.src = src;
  video.muted = muted;
  video.loop = true;
  video.playsInline = true;
  video.preload = 'none';
  video.setAttribute('aria-hidden', 'true');
  video.addEventListener('playing', onPlaying);
  video.addEventListener('error', onError, { once: true });

  return {
    element: video,
    play: () => video.play(),
    rewind: () => {
      video.pause();
      video.currentTime = 0;
    },
    get muted() {
      return video.muted;
    },
    set muted(value) {
      video.muted = value;
    },
  };
}

// Hovering the billboard plays the trailer with sound, like Netflix; leaving fades back to the still art.
// Phones, reduced motion and data saver get the Play trailer button only, so nothing starts on its own.
export function setupHeroTrailer({ hero, media, playButton, soundButton, trailer, title }) {
  const canHover = matchMedia('(hover: hover) and (pointer: fine)');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const saveData = navigator.connection?.saveData === true;

  let player = null;
  let playing = false;
  let startedBy = null;
  let stoppedByUser = false;
  let soundWanted = true;
  let blockedTimer;
  let hoverTimer;
  let resetTimer;

  const canAutoplay = () => canHover.matches && !reducedMotion.matches && !saveData;
  // Browsers only allow sound after a click or key press on the page; a hover alone doesn't count.
  const canPlaySound = () => navigator.userActivation?.hasBeenActive ?? true;

  function renderSound() {
    const soundOn = Boolean(player && !player.muted);
    soundButton.setAttribute('aria-pressed', String(soundOn));
    soundButton.setAttribute('aria-label', soundOn ? 'Mute trailer' : 'Unmute trailer');
    soundButton.innerHTML = soundOn ? SOUND_ICONS.on : SOUND_ICONS.off;
  }

  function renderPlayButton() {
    playButton.textContent = playing ? 'Stop trailer' : 'Play trailer';
    playButton.setAttribute('aria-label', `${playing ? 'Stop' : 'Play'} the ${title} trailer`);
  }

  // The art only gives way once real frames are showing, so a slow connection never flashes black.
  function reveal() {
    if (!playing) return;
    clearTimeout(blockedTimer);
    hero.classList.add('hero--playing');
  }

  function playMuted() {
    if (!playing || !player) return;
    player.muted = true;
    renderSound();
    player.play().catch(() => stop());
  }

  function play(source) {
    clearTimeout(hoverTimer);
    clearTimeout(resetTimer);
    playing = true;
    startedBy = source;
    soundButton.hidden = false;
    renderPlayButton();
    const muted = !(soundWanted && canPlaySound());
    if (player) {
      player.muted = muted;
      player.play().catch(playMuted);
    } else {
      // A new YouTube embed starts by itself once it loads; a video file needs telling.
      const create = trailer.youtubeId ? createYouTubePlayer : createVideoPlayer;
      player = create(trailer, { title, muted, onPlaying: reveal, onError: remove });
      media.append(player.element);
      if (!trailer.youtubeId) player.play().catch(playMuted);
    }
    clearTimeout(blockedTimer);
    if (!muted) blockedTimer = setTimeout(playMuted, BLOCKED_FALLBACK);
    renderSound();
  }

  function stop() {
    clearTimeout(hoverTimer);
    clearTimeout(blockedTimer);
    if (!playing) return;
    playing = false;
    startedBy = null;
    hero.classList.remove('hero--playing');
    soundButton.hidden = true;
    renderPlayButton();
    if (!player) return;
    // Silenced straight away so audio doesn't trail behind the fade. The next play goes back to the user's choice.
    player.muted = true;
    renderSound();
    resetTimer = setTimeout(() => player?.rewind(), FADE_OUT);
  }

  // A broken trailer just leaves the still art, as if there were none.
  function remove() {
    stop();
    player?.element.remove();
    player = null;
    playButton.hidden = true;
  }

  function startOnHover() {
    if (playing || stoppedByUser || !canAutoplay()) return;
    clearTimeout(hoverTimer);
    hoverTimer = setTimeout(() => play('hover'), HOVER_DELAY);
  }

  // Pressing Stop holds until the pointer or focus leaves, so the preview doesn't restart under the user.
  function stopOnLeave() {
    clearTimeout(hoverTimer);
    stoppedByUser = false;
    if (startedBy === 'hover') stop();
  }

  hero.addEventListener('pointerenter', (event) => {
    if (event.pointerType === 'mouse') startOnHover();
  });
  hero.addEventListener('pointerleave', stopOnLeave);

  // Keyboard users get the same preview when they tab into the billboard.
  hero.addEventListener('focusin', (event) => {
    if (event.target.matches(':focus-visible')) startOnHover();
  });
  hero.addEventListener('focusout', (event) => {
    if (!hero.contains(event.relatedTarget)) stopOnLeave();
  });

  playButton.addEventListener('click', () => {
    if (!playing) {
      play('button');
      return;
    }
    stoppedByUser = true;
    stop();
  });

  soundButton.addEventListener('click', () => {
    if (!player) return;
    soundWanted = player.muted;
    player.muted = !soundWanted;
    renderSound();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
  });

  playButton.hidden = false;
  renderPlayButton();
  renderSound();
}
