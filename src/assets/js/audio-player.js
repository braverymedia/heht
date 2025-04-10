// State variables
let audio = null;
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

// Initialize the component
function init(el, episodeData) {
  element = el;
  audio = new Audio();
  audio.preload = "metadata"; // Preload metadata but not the full audio file
  
  if (episodeData) {
    audio.src = episodeData.audio.filename;
    audio.title = episodeData.title;
    audio.number = episodeData.number;
    
    // Set data attributes
    element.setAttribute("data-src", episodeData.audio.filename);
    element.setAttribute("data-title", episodeData.title);
    element.setAttribute("data-episode-id", episodeData.number);
    element.setAttribute("data-duration", episodeData.duration);
  }

  // Setup event listeners
  setupEventListeners();
  
  // Load saved state
  loadSavedState();
}

// Setup event listeners
function setupEventListeners() {
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
function cleanupEventListeners() {
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
}

// Error handling
function handleAudioError(event) {
  error = event.target.error;
  status = "Error";
  updateUI();
  console.error(`Audio error: ${error.code}`);
}

// Save state before page unload
function saveState() {
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
function loadSavedState() {
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
function destroy() {
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
function updateUI() {
  if (!element) return;
  
  element.setAttribute('aria-label', `Audio player - ${status}`);
  element.setAttribute('aria-valuenow', progress);
  element.setAttribute('aria-valuetext', `${currentTime} of ${duration}`);
  
  if (error) {
    element.setAttribute('aria-invalid', 'true');
    element.setAttribute('aria-describedby', 'audio-error');
  } else {
    element.removeAttribute('aria-invalid');
    element.removeAttribute('aria-describedby');
  }
}

// Set up click handlers
function setupClickHandlers() {
  const playPauseButton = element.querySelector(
    ".audio-player__button--play-pause"
  );
  const skipBackButton = element.querySelector(
    ".audio-player__button--skip-back"
  );
  const speedButton = element.querySelector(".audio-player__button--speed");
  const progressBar = element.querySelector(".audio-player__progress");

  playPauseButton.addEventListener("click", togglePlay);
  skipBackButton.addEventListener("click", skipBack);
  speedButton.addEventListener("click", cyclePlaybackSpeed);
  progressBar.addEventListener("click", handleProgressClick);
}

// Toggle play/pause
function togglePlay() {
  if (isPlaying) {
    audio.pause();
    isPlaying = false;
    status = "Paused";
  } else {
    audio.play();
    isPlaying = true;
    status = "Playing";
  }
  updateUI();
}

// Skip back 10 seconds
function skipBack() {
  audio.currentTime = Math.max(0, audio.currentTime - 10);
  status = "Skipped back";
  updateUI();
}

// Update the playback speed group for the icon
function updatePlaybackSpeedGroup() {
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
  audio.playbackRate = playbackSpeed;
  status = `Speed: ${playbackSpeed}x`;
  updatePlaybackSpeedGroup();
  updateUI();
  saveState();
}

// Update progress bar and current time
function updateProgress() {
  if (audio.duration) {
    progress = (audio.currentTime / audio.duration) * 100;
    currentTime = formatTime(audio.currentTime);
  }
  updateUI();
  saveState();
}

// Update duration when metadata is loaded
function updateDuration() {
  duration = formatTime(audio.duration);
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
  updateDuration();
}

// Export public methods
export { init, destroy };
