// A logged review as a pull-quote. Used in the diary (clamped to a few lines) and in "Your log" on Game detail.
export function createReview(text, { spoilers = false, clamped = false } = {}) {
  const review = document.createElement('figure');
  review.className = 'review';
  review.classList.toggle('review--clamped', clamped);

  const quote = document.createElement('blockquote');
  quote.className = 'review__text';
  quote.textContent = text;
  review.append(quote);

  // Spoilers stay hidden from everyone, screen readers included, until asked for.
  if (spoilers) {
    review.classList.add('review--spoiler');
    quote.setAttribute('aria-hidden', 'true');
    const reveal = document.createElement('button');
    reveal.className = 'review__reveal';
    reveal.type = 'button';
    reveal.textContent = 'Show spoiler';
    reveal.addEventListener('click', () => {
      review.classList.remove('review--spoiler');
      quote.removeAttribute('aria-hidden');
      reveal.remove();
      quote.tabIndex = -1;
      quote.focus();
    });
    review.append(reveal);
  }
  return review;
}
