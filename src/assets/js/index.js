import './newsletter-form.js';
import { initPanelController } from './panel-controller.js';
import { initMediaController } from './media-controller.js';
import { initEpisodeNav } from './episode-nav.js';

// Initialize panel collapse/expand and episode list
initPanelController();

// Initialize media playback
initMediaController();

// Initialize episode navigation + transitions
initEpisodeNav();
