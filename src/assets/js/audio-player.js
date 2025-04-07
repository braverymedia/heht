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

// Initialize the component
function init(el) {
  element = el;
  audio = new Audio();
  audio.src = element.getAttribute("data-src");
  audio.title = element.getAttribute("data-title");
  audio.number = element.getAttribute("data-episode-id");

  // Load saved state
  loadState();

  // Set up event listeners
  audio.addEventListener("timeupdate", updateProgress);
  audio.addEventListener("loadedmetadata", updateDuration);
  audio.addEventListener("ended", handleEnded);
  audio.addEventListener("error", handleError);

  // Set up click handlers
  setupClickHandlers();

  // Update UI with initial state
  updateUI();
}

// Cleanup when component is removed
function cleanup() {
  if (audio) {
    audio.pause();
    audio = null;
  }
}

// Load saved state from localStorage
function loadState() {
  const savedState = localStorage.getItem(`audio-player-${audio.number}`);
  if (savedState) {
    const state = JSON.parse(savedState);
    audio.currentTime = state.currentTime;
    playbackSpeed = state.playbackSpeed;
    audio.playbackRate = playbackSpeed;
    updatePlaybackSpeedGroup();
  }
}

// Save current state to localStorage
function saveState() {
  const state = {
    currentTime: audio.currentTime,
    playbackSpeed: playbackSpeed,
  };
  localStorage.setItem(`audio-player-${audio.number}`, JSON.stringify(state));
}

// Set up event handlers for buttons
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

// Handle errors
function handleError() {
  loading = false;
  status = "Error loading audio";
  updateUI();
}

// Format time in MM:SS format
function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

// Update UI elements
function updateUI() {
  if (element) {
    element.setAttribute("data-playing", isPlaying);
    element.setAttribute("data-loading", loading);
    element.setAttribute("data-status", status);
    element.setAttribute("data-speed", playbackSpeed);
    element.setAttribute("data-progress", progress);
    element.setAttribute("data-current-time", currentTime);
    element.setAttribute("data-duration", duration);
  }
}

// Export public methods
export { init, cleanup };
