// Shared empty and error message (Figma "State Message"). Pages pass the copy and the button action.
// headingLevel 1 is for when the message replaces a whole page, so the page still has a main heading.
export function createStateMessage({ type, title, text, actionLabel, onAction, headingLevel = 2 }) {
  const message = document.createElement('div');
  message.className = `state-message state-message--${type}`;
  message.setAttribute('role', type === 'error' ? 'alert' : 'status');

  const heading = document.createElement(`h${headingLevel}`);
  heading.className = 'state-message__title';
  heading.textContent = title;

  const body = document.createElement('p');
  body.className = 'state-message__text';
  body.textContent = text;

  message.append(heading, body);

  if (actionLabel) {
    const button = document.createElement('button');
    button.className = 'button button--primary';
    button.type = 'button';
    button.textContent = actionLabel;
    button.addEventListener('click', onAction);
    message.append(button);
  }

  return message;
}
