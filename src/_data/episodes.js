export default {
  items: function(collections) {
    return collections.episodes ? collections.episodes.sort((a, b) => {
      return new Date(b.data.date) - new Date(a.data.date);
    }) : [];
  },

  latest: function(collections) {
    const sortedEpisodes = collections.episodes ? collections.episodes.sort((a, b) => {
      return new Date(b.data.date) - new Date(a.data.date);
    }) : [];
    return sortedEpisodes.length > 0 ? sortedEpisodes[0] : null;
  }
};