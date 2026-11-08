// A film or show's own logo (its title treatment from TMDB), checked before it's shown. Some logos are
// black lettering made for light posters, which disappears on dark art (Wildwood did), so the page
// looks at the logo's colour first and turns a dark one white, the way Netflix and Apple TV show them.

const SAMPLE_WIDTH = 64;
// Average brightness of the logo's visible pixels, from 0 (black) to 1 (white).
const DARK_BELOW = 0.4;

function getBrightness(image) {
  const canvas = document.createElement('canvas');
  canvas.width = SAMPLE_WIDTH;
  canvas.height = Math.max(1, Math.round((SAMPLE_WIDTH * image.naturalHeight) / image.naturalWidth));
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const { data } = context.getImageData(0, 0, canvas.width, canvas.height);

  let total = 0;
  let visible = 0;
  for (let index = 0; index < data.length; index += 4) {
    if (data[index + 3] < 128) continue;
    total += 0.2126 * data[index] + 0.7152 * data[index + 1] + 0.0722 * data[index + 2];
    visible += 1;
  }
  return visible ? total / visible / 255 : null;
}

// Resolves to { src, dark } once the logo is downloaded and checked, or null when it can't be shown
// safely (it failed to load, it's empty, or its colours can't be read). The title is typed instead then.
export async function prepareLogo(src) {
  if (!src) return null;
  try {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.src = src;
    await image.decode();
    if (!image.naturalWidth) return null;
    const brightness = getBrightness(image);
    return brightness === null ? null : { src, dark: brightness < DARK_BELOW };
  } catch {
    return null;
  }
}

export function createLogo({ src, dark }, { className, alt }) {
  const image = document.createElement('img');
  // The same request mode as the check above, so the browser reuses the downloaded copy.
  image.crossOrigin = 'anonymous';
  image.className = className;
  image.classList.toggle(`${className}--dark`, dark);
  image.src = src;
  image.alt = alt;
  return image;
}
