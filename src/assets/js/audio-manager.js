// Global audio player instance and state
let audioPlayerInstance = null;
let currentEpisode = null;
let audioElement = null;
(function(){
let isPlaying = false;

// Initialize audio player with episode data
document.addEventListener('DOMContentLoaded', () => {
  initializeAudioPlayer();
  
  // Listen for page content updates (AJAX navigation)
  document.addEventListener('pageContentUpdated', handlePageContentUpdated);
});

// Initialize the audio player
function initializeAudioPlayer() {
  // Get the current episode number from the URL if it exists
  const match = window.location.pathname.match(/episodes\/([0-9]+)/);
  const episodeNumber = match ? match[1] : undefined;
  if (episodeNumber && isNaN(Number(episodeNumber))) {
    console.error('Invalid episode number:', episodeNumber);
  } else {
    console.log('Episode number detected:', episodeNumber);
  }
  
  // Initialize the audio player
  const audioPlayer = document.querySelector('.audio-player');
  if (audioPlayer) {
    // Check if we already have an active audio player
    if (audioPlayerInstance && isPlaying) {
      // Update the UI with current state but don't reinitialize
      updatePlayerUI();
    } else {
      // Get episode data from the API
      fetchEpisodeData(episodeNumber)
        .then(episodeData => {
          if (!episodeData || !episodeData.audio || typeof episodeData.audio.filename !== 'string' || episodeData.audio.filename.length === 0) {
            console.error('Invalid episode data:', episodeData);
            throw new Error('Invalid episode data');
          }
          currentEpisode = episodeData;
          audioPlayerInstance = window.audioPlayer.init(audioPlayer, episodeData);
          if (
            episodeData &&
            episodeData.audio &&
            typeof episodeData.audio.filename === 'string' &&
            episodeData.audio.filename.length > 0 &&
            /\.mp3$|\.m4a$|\.ogg$|\.wav$/i.test(episodeData.audio.filename)
          ) {
            console.log('[audio-manager] Initialized audio player with', episodeData.audio.filename);
            // Update the player UI to show the current episode
            updatePlayerUI();
          } else {
            console.error('Invalid audio filename for episode:', episodeData);
          }
        })
        .catch(error => {
          console.error('Error initializing audio player:', error);
        });
    }
  }
}

// Handle page content updates from AJAX navigation
function handlePageContentUpdated(event) {
  // Get the episode number from the event detail if available
  let episodeNumber = event.detail.episodeNumber;
  if (!episodeNumber) {
    const match = window.location.pathname.match(/episodes\/([0-9]+)/);
    episodeNumber = match ? match[1] : undefined;
  }
  if (episodeNumber && isNaN(Number(episodeNumber))) {
    console.error('Invalid episode number (pageContentUpdated):', episodeNumber);
  } else {
    console.log('Episode number detected (pageContentUpdated):', episodeNumber);
  }
  
  // If we have an audio player instance
  if (audioPlayerInstance) {
    // If nothing is currently playing, update the player with the current page's episode
    if (!isPlaying) {
      fetchEpisodeData(episodeNumber)
        .then(episodeData => {
          currentEpisode = episodeData;
          updatePlayerWithEpisode(episodeData, false); // Don't autoplay, just update the UI
        })
        .catch(error => {
          console.error('Error updating audio player:', error);
        });
    } else {
      // If something is playing, just update the UI to reflect the current state
      updatePlayerUI();
    }
  } else {
    // Initialize the player if it doesn't exist
    initializeAudioPlayer();
  }
}



// Play a specific episode by ID
async function playEpisode(episodeId) {
  try {
    const episodeData = await fetchEpisodeData(episodeId);
    
    // Update the current episode
    currentEpisode = episodeData;
    
    // Update the player with the new episode
    updatePlayerWithEpisode(episodeData, true);
  } catch (error) {
    console.error('Error playing episode:', error);
  }
}

// Update the player with a new episode
function updatePlayerWithEpisode(episodeData, autoPlay = false) {
  if (!audioPlayerInstance) {
    // Initialize the player if it doesn't exist
    const audioPlayer = document.querySelector('.audio-player');
    if (audioPlayer) {
      audioPlayerInstance = window.audioPlayer.init(audioPlayer, episodeData);
      audioElement = document.querySelector('audio');
    }
  } else {
    // Update the existing player
    const audioPlayer = document.querySelector('.audio-player');
    
    // Update data attributes
    audioPlayer.setAttribute('data-src', episodeData.audio.filename);
    audioPlayer.setAttribute('data-episode-id', episodeData.number);
    audioPlayer.setAttribute('data-duration', episodeData.duration);
    
    // Update audio source
    if (audioElement) {
      audioElement.src = episodeData.audio.filename;
      audioElement.title = episodeData.title;
      
      // Auto-play if requested
      if (autoPlay) {
        audioElement.play()
          .then(() => {
            isPlaying = true;
            updatePlayerUI();
          })
          .catch(error => {
            console.error('Error playing audio:', error);
          });
      }
    }
  }
  
  updatePlayerUI();
}

// Update the player UI based on current state
function updatePlayerUI() {
  const audioPlayer = document.querySelector('.audio-player');
  if (!audioPlayer || !currentEpisode) return;
  
  // Update play/pause button
  const playPauseButton = audioPlayer.querySelector('.audio-player__button--play-pause');
  const playIcon = playPauseButton.querySelector('.audio-player__icon--play');
  const pauseIcon = playPauseButton.querySelector('.audio-player__icon--pause');
  
  if (isPlaying) {
    playIcon.classList.add('hidden');
    pauseIcon.classList.remove('hidden');
    playPauseButton.setAttribute('aria-label', 'Pause');
    audioPlayer.setAttribute('data-is-playing', 'true');
    audioPlayer.setAttribute('data-status', 'Playing');
  } else {
    playIcon.classList.remove('hidden');
    pauseIcon.classList.add('hidden');
    playPauseButton.setAttribute('aria-label', 'Play');
    audioPlayer.setAttribute('data-is-playing', 'false');
    audioPlayer.setAttribute('data-status', 'Paused');
  }
  
  // Update episode info
  const statusText = audioPlayer.querySelector('.audio-player__status-text');
  if (statusText) {
    statusText.textContent = isPlaying ? 'Playing' : 'Ready';
  }
}

async function fetchEpisodeData(episodeNumber) {
  try {
    const response = await fetch('/api/episodes.json');
    const episodesData = await response.json();
    console.log('[audio-manager] API response:', episodesData);

    // Defensive: ensure episodesData exists and has expected structure
    if (!episodesData) {
      console.error('episodesData is undefined or null');
      throw new Error('episodesData is undefined or null');
    }

    // If we have a specific episode number, find that episode
    if (episodeNumber) {
      const episode = Array.isArray(episodesData.episodes) ? episodesData.episodes.find(ep => ep.number === parseInt(episodeNumber)) : undefined;
      if (episode) {
        if (!episode.audio || typeof episode.audio.filename !== 'string' || episode.audio.filename.length === 0) {
          console.error('Episode audio filename missing:', episode);
          throw new Error('Episode audio filename missing');
        }
        if (!/\.mp3$|\.m4a$|\.ogg$|\.wav$/i.test(episode.audio.filename)) {
          console.error('Episode audio filename does not look like a valid audio file:', episode.audio.filename);
          throw new Error('Episode audio filename invalid pattern');
        }
        return {
          audio: episode.audio,
          title: episode.title,
          number: episode.number,
          cover: episode.cover,
          duration: episode.duration
        };
      }
    }

    // If no specific episode or episode not found, use latest
    const latest = episodesData.latestEpisode;
    if (!latest || !latest.audio || typeof latest.audio.filename !== 'string' || latest.audio.filename.length === 0) {
      console.error('Latest episode audio filename missing:', latest);
      throw new Error('Latest episode audio filename missing');
    }
    if (!/\.mp3$|\.m4a$|\.ogg$|\.wav$/i.test(latest.audio.filename)) {
      console.error('Latest episode audio filename does not look like a valid audio file:', latest.audio.filename);
      throw new Error('Latest episode audio filename invalid pattern');
    }
    return {
      audio: latest.audio,
      title: latest.title,
      number: latest.number,
      cover: latest.cover,
      duration: latest.duration
    };
  } catch (error) {
    console.error('Error fetching episode data:', error);
    throw error;
  }
}

// Update the playing state
function updatePlayingState(playing) {
  isPlaying = playing;
  updatePlayerUI();
}

// Export public methods
window.audioManager = {
  playEpisode,
  getCurrentEpisode: () => currentEpisode,
  updatePlayingState
};
})();
