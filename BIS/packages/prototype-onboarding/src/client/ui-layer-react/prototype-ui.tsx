import { createElement } from 'react';

export function PrototypeTitle({ number, title, children }) {
  return createElement('div', { className: 'prototype-title-bar' },
    number ? createElement('span', { className: 'prototype-number', 'aria-hidden': 'true' }, number) : null,
    createElement('h2', null, title),
    children ? createElement('div', { className: 'prototype-title-actions' }, children) : null,
  );
}

export function PrototypeSection({ number, title, children, className = '', ...props }) {
  return createElement('section', { ...props, className: `prototype-section ${className}`.trim() },
    createElement(PrototypeTitle, { number, title }),
    children,
  );
}

export function prototypeTitleMarkup(number, title) {
  return `<div class="prototype-title-bar">${number ? `<span class="prototype-number" aria-hidden="true">${number}</span>` : ''}<h2>${title}</h2></div>`;
}
