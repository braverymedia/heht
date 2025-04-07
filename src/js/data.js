export const getEpisodeData = () => {
  // Get episodes from 11ty's global data
  return window.__eleventyGlobal.episodes || [];
};

export const getLatestEpisode = () => {
  const episodes = getEpisodeData();
  return episodes[0] || null;
};

export const getEpisodeById = (id) => {
  const episodes = getEpisodeData();
  return episodes.find(episode => episode.id === id);
};

export const formatEpisodeDuration = (duration) => {
  const minutes = Math.floor(duration / 60);
  const seconds = duration % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};
