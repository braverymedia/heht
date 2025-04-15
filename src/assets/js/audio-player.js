// soundtouchjs is expected to be bundled globally or imported in index.js
// State variables
let audio = null;
(() => {
let isPlaying = false;
let currentTime = "0:00";
let duration = "0:00";
let progress = 0;
let playbackSpeed = 1;
let status = "Ready";
let loading = false;
let element = null;
let error = null;
let eventListeners = [];
let uiEventListeners = []; // Track UI event listeners separately
let currentEpisodeData = null;

// Audio player progress bar fill for Chrome/Safari
const updateRangeFill = (range) => {
  const min = range.min ? Number(range.min) : 0;
  const max = range.max ? Number(range.max) : 100;
  const val = Number(range.value);
  const percent = ((val - min) * 100) / (max - min);
  range.style.setProperty('--value', percent);
}
document.querySelectorAll('input.audio-player__progress-bar[type="range"]').forEach(input => {
  updateRangeFill(input);
  input.addEventListener('input', function() {
    updateRangeFill(this);
  });
});
// For dynamically added elements (e.g., AJAX navigation)
const observer = new MutationObserver(() => {
  document.querySelectorAll('input.audio-player__progress-bar[type="range"]').forEach(input => {
    updateRangeFill(input);
  });
});
observer.observe(document.body, { childList: true, subtree: true });

// Playback speed button logic
const setupPlaybackSpeedButton = (audioEl, container) => {
  const speedButton = container.querySelector('.audio-player__button--speed');
  if (!speedButton) return;
  const rateSpan = speedButton.querySelector('.rate');
  if (!rateSpan) return;
  const speeds = [1, 1.5, 2];
  let current = speeds.indexOf(audioEl.playbackRate);
  if (current === -1) current = 0;
  function updateRateDisplay() {
    rateSpan.textContent = audioEl.playbackRate.toString().replace(/\.0$/, '');
  }
  speedButton.addEventListener('click', () => {
    current = (current + 1) % speeds.length;
    audioEl.playbackRate = speeds[current];
    updateRateDisplay();
  });
  // If playbackRate changes externally
  audioEl.addEventListener('ratechange', updateRateDisplay);
  // Initialize display
  updateRateDisplay();
}


// Initialize the component
const init = (el, episodeData) => {
  element = el;
  currentEpisodeData = episodeData;

  // Check if audio element already exists (for persistence)
  if (!audio) {
    audio = new Audio();
    audio.preload = "metadata"; // Preload metadata but not the full audio file
    // Preserve pitch when changing playback rate (best effort across browsers)
    audio.preservesPitch = true;
    audio.mozPreservesPitch = true;
    audio.webkitPreservesPitch = true;
  }

  if (episodeData) {
    audio.src = episodeData.audio.filename;
    audio.title = episodeData.title;
    audio.number = episodeData.number;

    // Set data attributes
    element.setAttribute("data-src", episodeData.audio.filename);
    element.setAttribute("data-title", episodeData.title);
    element.setAttribute("data-episode-id", episodeData.number);
    element.setAttribute("data-duration", episodeData.duration);

    // Set duration immediately from episode data
    if (episodeData.duration) {
      duration = formatTime(episodeData.duration);
      const durationEl = element.querySelector('.audio-player__duration');
      if (durationEl) durationEl.textContent = duration;
    }
  }

  // Setup event listeners
  setupEventListeners();

  // Setup click handlers
  setupClickHandlers();

  // Load saved state
  loadSavedState();

  // Ensure playback speed button is set up for this player
  setupPlaybackSpeedButton(audio, element);
  return {
    audio,
    togglePlay,
    updateEpisode
  };
}

// Setup event listeners
const setupEventListeners = () => {
  // Remove existing listeners first
  cleanupEventListeners();

  // Add new listeners
  eventListeners = [
    audio.addEventListener('error', handleAudioError),
    audio.addEventListener('loadedmetadata', handleMetadataLoaded),
    audio.addEventListener('timeupdate', updateProgress),
    audio.addEventListener('ended', handleEnded),
    window.addEventListener('beforeunload', saveState)
  ];
}

// Cleanup event listeners
const cleanupEventListeners = () => {
  // Clean up audio element event listeners
  eventListeners.forEach(listener => {
    if (listener.type === 'error') {
      audio.removeEventListener('error', listener);
    } else if (listener.type === 'loadedmetadata') {
      audio.removeEventListener('loadedmetadata', listener);
    } else if (listener.type === 'timeupdate') {
      audio.removeEventListener('timeupdate', listener);
    } else if (listener.type === 'ended') {
      audio.removeEventListener('ended', listener);
    } else if (listener.type === 'beforeunload') {
      window.removeEventListener('beforeunload', listener);
    }
  });
  
  // Clean up UI event listeners
  uiEventListeners.forEach(listenerObj => {
    if (listenerObj && listenerObj.element && listenerObj.type && listenerObj.handler) {
      listenerObj.element.removeEventListener(listenerObj.type, listenerObj.handler);
    }
  });
  
  // Reset event listener arrays
  eventListeners = [];
  uiEventListeners = [];
}

// Error handling
const handleAudioError = (event) => {
  error = event.target.error;
  status = "Error";
  updateUI();
  console.error(`Audio error: ${error.code}`);
}

// Save state before page unload
const saveState = () => {
  if (audio && audio.src) {
    const state = {
      src: audio.src,
      currentTime: audio.currentTime,
      volume: audio.volume,
      playbackSpeed: audio.playbackRate
    };
    localStorage.setItem('audioPlayerState', JSON.stringify(state));
  }
}

// Load saved state
const loadSavedState = () => {
  const savedState = localStorage.getItem('audioPlayerState');
  if (savedState) {
    const state = JSON.parse(savedState);
    if (audio && audio.src === state.src) {
      audio.currentTime = state.currentTime;
      audio.volume = state.volume;
      audio.playbackRate = state.playbackSpeed;
    }
  }
}

// Destroy the player
const destroy = () => {
  // Make sure we clean up all event listeners
  cleanupEventListeners();
  
  if (audio) {
    audio.pause();
    audio.src = '';
    audio.remove();
    audio = null;
  }
  element = null;
  error = null;

  // Clear saved state
  localStorage.removeItem('audioPlayerState');
}

// Update UI based on current state
const updateUI = () => {
  if (!element) return;

  element.setAttribute('aria-label', `Audio player - ${status}`);
  element.setAttribute('aria-valuenow', progress);
  element.setAttribute('aria-valuetext', `${currentTime} of ${duration}`);

  // Update play/pause button icon based on playing state
  const playPauseButton = element.querySelector('.audio-player__button--play-pause');
  if (playPauseButton) {
    if (isPlaying) {
      // Set aria-label to Pause when playing
      playPauseButton.setAttribute('aria-label', 'Pause');
      element.setAttribute('data-is-playing', 'true');
      element.setAttribute('data-status', 'Playing');
    } else {
      // Set aria-label to Play when paused
      playPauseButton.setAttribute('aria-label', 'Play');
      element.setAttribute('data-is-playing', 'false');
      element.setAttribute('data-status', 'Paused');
    }
  }

  if (error) {
    element.setAttribute('aria-invalid', 'true');
    element.setAttribute('aria-describedby', 'audio-error');
  } else {
    element.removeAttribute('aria-invalid');
    element.removeAttribute('aria-describedby');
  }
}

// Handle progress bar click for seeking
const handleProgressClick = (event) => {
  // Find the progress bar element
  const progressBar = event.currentTarget;
  // Get the bounding rectangle of the progress bar
  const rect = progressBar.getBoundingClientRect();
  // Calculate click position as a percentage
  const clickX = event.clientX - rect.left;
  const percent = Math.max(0, Math.min(1, clickX / rect.width));
  // Set the audio currentTime
  if (audio && audio.duration) {
    audio.currentTime = percent * audio.duration;
  }
}

// Set up click handlers
const setupClickHandlers = () => {
  // Clean up any existing event listeners first
  uiEventListeners.forEach(listenerObj => {
    if (listenerObj && listenerObj.element && listenerObj.type && listenerObj.handler) {
      listenerObj.element.removeEventListener(listenerObj.type, listenerObj.handler);
    }
  });
  uiEventListeners = [];
  
  // Make player controls focusable for keyboard navigation
  element.setAttribute('tabindex', '0');
  const playPauseButton = element.querySelector('.audio-player__button--play-pause');
  const skipBackButton = element.querySelector('.audio-player__button--skip-back');
  const speedButton = element.querySelector('.audio-player__button--speed');
  const progressBar = element.querySelector('.audio-player__progress-bar');
  
  // Set tabindex for all interactive elements
  if (playPauseButton) playPauseButton.setAttribute('tabindex', '0');
  if (skipBackButton) skipBackButton.setAttribute('tabindex', '0');
  if (speedButton) speedButton.setAttribute('tabindex', '0');
  
  // Global keyboard handler for the player
  const handlePlayerKeydown = (e) => {
    const isSpace = e.code === 'Space' || e.key === ' ';
    const isEnter = e.code === 'Enter' || e.key === 'Enter';
    const active = document.activeElement;
    
    // Only handle keyboard events when focused on the player or its controls
    if (active === element || 
        (active && active.closest && active.closest('.audio-player'))) {
      
      // Don't trigger if on input/slider
      if (active.tagName === 'INPUT' || active.classList.contains('audio-player__progress-bar')) return;
      
      // Play/Pause with Space or Enter when focused on player or play/pause button
      if ((isSpace || isEnter) && 
          (active === element || active.classList.contains('audio-player__button--play-pause'))) {
        e.preventDefault();
        togglePlay();
      }
      
      // Skip back with B key or when Enter/Space pressed on skip back button
      if ((e.key === 'b' || e.key === 'B') || 
          ((isSpace || isEnter) && active.classList.contains('audio-player__button--skip-back'))) {
        e.preventDefault();
        skipBack();
      }
      
      // Change speed with S key or when Enter/Space pressed on speed button
      if ((e.key === 's' || e.key === 'S') || 
          ((isSpace || isEnter) && active.classList.contains('audio-player__button--speed'))) {
        e.preventDefault();
        cyclePlaybackSpeed();
      }
      
      // Arrow keys for seeking
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (audio && audio.currentTime) {
          audio.currentTime = Math.max(0, audio.currentTime - 5); // Seek back 5 seconds
        }
      }
      
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (audio && audio.duration) {
          audio.currentTime = Math.min(audio.duration, audio.currentTime + 5); // Seek forward 5 seconds
        }
      }
    }
  };
  
  // Global document keyboard handler for spacebar to toggle play/pause anywhere on the page
  const handleDocumentKeydown = (e) => {
    const isSpace = e.code === 'Space' || e.key === ' ';
    const active = document.activeElement;
    
    // Don't trigger if on any form controls or contenteditable elements
    if (active.tagName === 'INPUT' || 
        active.tagName === 'TEXTAREA' || 
        active.tagName === 'SELECT' || 
        active.tagName === 'BUTTON' ||
        active.isContentEditable ||
        active.classList.contains('audio-player__progress-bar')) {
      return;
    }
    
    // Toggle play/pause with spacebar anywhere on the page
    if (isSpace && audio) {
      e.preventDefault();
      togglePlay();
    }
  };
  
  // Add event listener to the player and track it
  element.addEventListener('keydown', handlePlayerKeydown);
  uiEventListeners.push({
    element: element,
    type: 'keydown',
    handler: handlePlayerKeydown
  });
  
  // Add global document event listener for spacebar
  document.addEventListener('keydown', handleDocumentKeydown);
  uiEventListeners.push({
    element: document,
    type: 'keydown',
    handler: handleDocumentKeydown
  });
  
  // Add click handlers and track them
  if (playPauseButton) {
    playPauseButton.addEventListener('click', togglePlay);
    uiEventListeners.push({
      element: playPauseButton,
      type: 'click',
      handler: togglePlay
    });
  }
  
  if (skipBackButton) {
    skipBackButton.addEventListener('click', skipBack);
    uiEventListeners.push({
      element: skipBackButton,
      type: 'click',
      handler: skipBack
    });
  }
  
  if (speedButton) {
    speedButton.addEventListener('click', cyclePlaybackSpeed);
    uiEventListeners.push({
      element: speedButton,
      type: 'click',
      handler: cyclePlaybackSpeed
    });
  }
  
  // Progress bar input handler
  if (progressBar) {
    const progressHandler = e => {
      if (audio && audio.duration) {
        const percent = parseFloat(e.target.value) / 100;
        audio.currentTime = percent * audio.duration;
      }
    };
    
    progressBar.addEventListener('input', progressHandler);
    uiEventListeners.push({
      element: progressBar,
      type: 'input',
      handler: progressHandler
    });
  }
};

// Toggle play/pause
const togglePlay = () => {
  if (isPlaying) {
    audio.pause();
    isPlaying = false;
    status = "Paused";
  } else {
    audio.play()
      .then(() => {
        isPlaying = true;
        status = "Playing";
        // Update the global state in audio-manager
        if (window.audioManager) {
          window.audioManager.updatePlayingState(true);
        }
      })
      .catch(error => {
        console.error('Error playing audio:', error);
      });
  }

  // Update the global state in audio-manager
  if (window.audioManager) {
    window.audioManager.updatePlayingState(isPlaying);
  }
  
  // Immediately update the play/pause button icon
  if (element) {
    const playPauseButton = element.querySelector('.audio-player__button--play-pause');
    if (playPauseButton) {
      if (isPlaying) {
        // Set aria-label to Pause when playing
        playPauseButton.setAttribute('aria-label', 'Pause');
        element.setAttribute('data-is-playing', 'true');
        element.setAttribute('data-status', 'Playing');
      } else {
        // Set aria-label to Play when paused
        playPauseButton.setAttribute('aria-label', 'Play');
        element.setAttribute('data-is-playing', 'false');
        element.setAttribute('data-status', 'Paused');
      }
    }
  }

  updateUI();
}

// Skip back 10 seconds
const skipBack = () => {
  audio.currentTime = Math.max(0, audio.currentTime - 10);
  status = "Skipped back";
  updateUI();
}

// Update the playback speed group for the icon
const updatePlaybackSpeedGroup = () => {
  const speedGroups = element.querySelectorAll('.audio-player__button--speed g');
  speedGroups.forEach(group => {
    if (group.classList.contains('one') && playbackSpeed === 1) {
      group.classList.add('active');
      group.classList.remove('hidden');
    } else if (group.classList.contains('two') && playbackSpeed === 2) {
      group.classList.add('active');
      group.classList.remove('hidden');
    } else if (group.classList.contains('three') && playbackSpeed === 3) {
      group.classList.add('active');
      group.classList.remove('hidden');
    } else {
      group.classList.remove('active');
      group.classList.add('hidden');
    }
  });
}

// Cycle through playback speeds
function cyclePlaybackSpeed() {
  const speeds = [1, 2, 3];
  const currentIndex = speeds.indexOf(playbackSpeed);
  const nextIndex = (currentIndex + 1) % speeds.length;
  playbackSpeed = speeds[nextIndex];
  setPlaybackSpeed(playbackSpeed);
  status = `Speed: ${playbackSpeed}x`;
  updatePlaybackSpeedGroup();
  updateUI();
  saveState();
}

// --- SoundTouch Integration ---
let soundTouchNode = null;
let audioCtx = null;
let mediaSource = null;

function setPlaybackSpeed(rate) {
  if (!audio) return;
  // Use globals if present (for browser bundle)
  const SoundTouch = window.SoundTouch || (typeof SoundTouch !== 'undefined' ? SoundTouch : undefined);
  const getWebAudioNode = window.getWebAudioNode || (typeof getWebAudioNode !== 'undefined' ? getWebAudioNode : undefined);
  if (rate === 1 || !SoundTouch || !getWebAudioNode) {
    // Clean up SoundTouch if reverting to normal speed or if SoundTouch is unavailable
    if (soundTouchNode) {
      soundTouchNode.disconnect();
      soundTouchNode = null;
    }
    if (mediaSource) {
      mediaSource.disconnect();
      mediaSource = null;
    }
    if (audioCtx) {
      audioCtx.close();
      audioCtx = null;
    }
    audio.playbackRate = 1;
    audio.preservesPitch = true;
    audio.mozPreservesPitch = true;
    audio.webkitPreservesPitch = true;
    return;
  }

  // Use Web Audio API with SoundTouch
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (!mediaSource) {
    mediaSource = audioCtx.createMediaElementSource(audio);
  }
  if (soundTouchNode) {
    soundTouchNode.disconnect();
    soundTouchNode = null;
  }
  const soundTouch = new SoundTouch(audioCtx.sampleRate);
  soundTouch.tempo = rate;
  soundTouch.pitch = 1; // Explicitly lock pitch
  soundTouch.rate = 1;  // Ensure no pitch shift
  soundTouchNode = getWebAudioNode(audioCtx, mediaSource, soundTouch);
  soundTouchNode.connect(audioCtx.destination);
  audio.playbackRate = 1; // Let SoundTouch handle speed
}
// --- End SoundTouch Integration ---

// Update progress bar and current time
function updateProgress() {
  if (audio.duration) {
    progress = (audio.currentTime / audio.duration) * 100;
    currentTime = formatTime(audio.currentTime);
    // Update progress bar
    const progressBar = element.querySelector('.audio-player__progress-bar');
    if (progressBar) {
      progressBar.value = progress;
      progressBar.setAttribute('aria-valuenow', progress.toFixed(1));
    }
    // Update current time display
    const currentTimeEl = element.querySelector('.audio-player__current-time');
    if (currentTimeEl) currentTimeEl.textContent = currentTime;
  }
  updateUI();
  saveState();
}

// Set duration from episode data (front matter)
function updateDuration() {
  if (currentEpisodeData && currentEpisodeData.duration) {
    duration = formatTime(currentEpisodeData.duration);
  } else if (audio.duration) {
    duration = formatTime(audio.duration);
  } else {
    duration = '0:00';
  }
  updateUI();
}

// Handle playback ending
function handleEnded() {
  isPlaying = false;
  status = "Finished";
  updateUI();
}

// Format time in MM:SS format
function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

// Handle metadata loaded
function handleMetadataLoaded() {
  // Use duration from episode data (front matter) if available
  if (currentEpisodeData && currentEpisodeData.duration) {
    duration = formatTime(currentEpisodeData.duration);
  } else {
    duration = formatTime(audio.duration);
  }
  const durationEl = element.querySelector('.audio-player__duration');
  if (durationEl) durationEl.textContent = duration;
  // Hide loading spinner
  setLoading(false);
}

const setLoading = (isLoading) => {
  loading = isLoading;
  const playPauseButton = element.querySelector('.audio-player__button--play-pause');
  if (!playPauseButton) return;
  
  if (isLoading) {
    // Set loading state using aria-label
    playPauseButton.setAttribute('aria-label', 'Loading');
  } else {
    // Restore the correct aria-label based on playing state
    if (isPlaying) {
      playPauseButton.setAttribute('aria-label', 'Pause');
    } else {
      playPauseButton.setAttribute('aria-label', 'Play');
    }
  }
}


// Update episode data
const updateEpisode = (episodeData, shouldPlay = false) => {
  if (!audio || !element) return;

  currentEpisodeData = episodeData;

  // Update audio source
  audio.src = episodeData.audio.filename;
  audio.title = episodeData.title;
  audio.number = episodeData.number;

  // Set data attributes
  element.setAttribute("data-src", episodeData.audio.filename);
  element.setAttribute("data-title", episodeData.title);
  element.setAttribute("data-episode-id", episodeData.number);
  element.setAttribute("data-duration", episodeData.duration);

  // Reset state
  currentTime = "0:00";
  progress = 0;

  // Play if requested
  if (shouldPlay) {
    audio.play()
      .then(() => {
        isPlaying = true;
        status = "Playing";
        updateUI();

        // Update the global state in audio-manager
        if (window.audioManager) {
          window.audioManager.updatePlayingState(true);
        }
      })
      .catch(error => {
        console.error('Error playing audio:', error);
      });
  } else {
    updateUI();
  }
}

// Get current episode data
const getCurrentEpisode = () => {
  return currentEpisodeData;
}

// Export public methods
if (!window.audioPlayer) {
  window.audioPlayer = {
    init,
    destroy,
    togglePlay,
    updateEpisode,
    getCurrentEpisode
  };
}
})();
