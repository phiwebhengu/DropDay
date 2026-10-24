const HOVER_DELAY = 500;
const FADE_OUT = 500;

const SOUND_ICONS = {
  off: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="m16 9 5 6m0-6-5 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  on: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
};

// Hovering the billboard plays the trailer muted, like Netflix; leaving fades back to the still art.
// Phones, reduced motion and data saver get the Play trailer button only, so nothing starts on its own.
export function setupHeroTrailer({ hero, media, playButton, soundButton, trailer, title }) {
  const canHover = matchMedia('(hover: hover) and (pointer: fine)');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const saveData = navigator.connection?.saveData === true;

  let video = null;
  let playing = false;
  let startedBy = null;
  let stoppedByUser = false;
  let hoverTimer;
  let resetTimer;

  const canAutoplay = () => canHover.matches && !reducedMotion.matches && !saveData;

  function renderSound() {
    const soundOn = Boolean(video && !video.muted);
    soundButton.setAttribute('aria-pressed', String(soundOn));
    soundButton.setAttribute('aria-label', soundOn ? 'Mute trailer' : 'Unmute trailer');
    soundButton.innerHTML = soundOn ? SOUND_ICONS.on : SOUND_ICONS.off;
  }

  function renderPlayButton() {
    playButton.textContent = playing ? 'Stop trailer' : 'Play trailer';
    playButton.setAttribute('aria-label', `${playing ? 'Stop' : 'Play'} the ${title} trailer`);
  }

  function getVideo() {
    if (video) return video;
    video = document.createElement('video');
    video.className = 'hero__video';
    video.src = trailer.src;
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.preload = 'none';
    video.setAttribute('aria-hidden', 'true');
    // The art only gives way once real frames are showing, so a slow connection never flashes black.
    video.addEventListener('playing', () => {
      if (playing) hero.classList.add('hero--playing');
    });
    video.addEventListener('error', remove, { once: true });
    media.append(video);
    return video;
  }

  function play(source) {
    clearTimeout(hoverTimer);
    clearTimeout(resetTimer);
    playing = true;
    startedBy = source;
    soundButton.hidden = false;
    renderPlayButton();
    renderSound();
    getVideo()
      .play()
      .catch(() => stop());
  }

  function stop() {
    clearTimeout(hoverTimer);
    if (!playing) return;
    playing = false;
    startedBy = null;
    hero.classList.remove('hero--playing');
    soundButton.hidden = true;
    renderPlayButton();
    if (!video) return;
    // Sound never carries over to the next hover; it's always the user's choice to turn it on.
    video.muted = true;
    renderSound();
    resetTimer = setTimeout(() => {
      video.pause();
      video.currentTime = 0;
    }, FADE_OUT);
  }

  // A broken clip just leaves the still art, as if there were no trailer.
  function remove() {
    stop();
    video?.remove();
    video = null;
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
    if (!video) return;
    video.muted = !video.muted;
    renderSound();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
  });

  playButton.hidden = false;
  renderPlayButton();
  renderSound();
}
