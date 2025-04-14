// Get the episodes from the data file
const episodes = data.episodes.items || [];

// Sort episodes by number in descending order (newest first)
const sortedEpisodes = episodes.sort((a, b) => b.number - a.number);

// Format the episodes data for the audio player
const episodesData = {
  episodes: sortedEpisodes.map(episode => ({
    number: episode.number,
    title: episode.title,
    description: episode.description,
    date: episode.date,
    url: episode.url,
    audio: {
      filename: episode.audio?.filename,
      duration: episode.audio?.duration,
      type: episode.audio?.type
    },
    tags: episode.tags,
    cover: episode.cover?.image
  })),
  latestEpisode: sortedEpisodes[0] ? {
    number: sortedEpisodes[0].number,
    title: sortedEpisodes[0].title,
    audio: {
      filename: sortedEpisodes[0].audio?.filename,
      duration: sortedEpisodes[0].audio?.duration,
      type: sortedEpisodes[0].audio?.type
    }
  } : null
};

// Return the data as JSON
module.exports = JSON.stringify(episodesData);