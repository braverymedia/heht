export default {
  items: function(collections) {
    return collections.episodes ? collections.episodes : [];
  },

  latest: function(collections) {
    return collections.episodes && collections.episodes.length > 0
      ? collections.episodes[0]
      : null;
  }
};