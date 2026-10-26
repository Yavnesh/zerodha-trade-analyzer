/**
 * Main Application Entry Point
 */

import './styles/tokens.css';
import './styles/layout.css';
import './styles/components.css';
import './styles/responsive.css';

import { subscribe } from './app/state.js';
import { renderApp } from './app/render.js';
import { setupEventHandlers } from './app/events.js';

const appRoot = document.getElementById('app');

// Subscribe render loop
subscribe(() => {
  renderApp(appRoot);
});

// Setup events
setupEventHandlers();

// Initial render
renderApp(appRoot);
