module.exports = function(data) {
  // Get the episodes from the data file
  const episodes = data.episodes.items || [];

  // Return the episodes as JSON
  return {
    episodes: episodes.map(episode => ({
      number: episode.number,
      title: episode.title,
      description: episode.description,
      date: episode.date,
      url: episode.url,
      audio: episode.audio,
      tags: episode.tags
    }))
  };
};