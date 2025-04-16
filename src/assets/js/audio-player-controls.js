import audioManager from './audio-manager.js';

let unsubscribe = null;

export function mountAudioPlayerControls(container, episodeData) {
  // Clean up previous controls
  if (unsubscribe) unsubscribe();
  container.innerHTML = '';

  // Build controls UI (simplified for brevity)
  const controls = document.createElement('div');
  controls.className = 'audio-player-controls';
  controls.setAttribute('role', 'region');
  controls.setAttribute('aria-label', 'Audio Player Controls');

  // Play/Pause button
  const playPause = document.createElement('button');
  playPause.className = 'audio-player__button audio-player__button--play-pause';
  playPause.setAttribute('aria-label', 'Play/Pause');
  controls.appendChild(playPause);

  // Progress bar
  const progress = document.createElement('input');
  progress.type = 'range';
  progress.className = 'audio-player__progress-bar';
  progress.min = 0;
  progress.max = 100;
  progress.step = 0.1;
  controls.appendChild(progress);

  // State sync
  function update(state) {
    playPause.textContent = state.paused ? 'Play' : 'Pause';
    playPause.setAttribute('aria-pressed', !state.paused);
    if (state.duration) {
      progress.value = (state.currentTime / state.duration) * 100;
    }
  }
  audioManager.subscribe(update);

  // Event handlers
  playPause.onclick = () => {
    if (audioManager.getState().paused) audioManager.play();
    else audioManager.pause();
  };
  progress.oninput = (e) => {
    if (audioManager.getState().duration) {
      audioManager.seek((e.target.value / 100) * audioManager.getState().duration);
    }
  };

  // Set source if needed
  if (episodeData?.audio?.filename) {
    audioManager.setSrc(episodeData.audio.filename);
  }
  update(audioManager.getState());
  container.appendChild(controls);

  // Cleanup
  unsubscribe = () => audioManager.unsubscribe(update);
}