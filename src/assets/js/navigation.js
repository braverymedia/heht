// Handles AJAX navigation to prevent audio interruption during page transitions
class Navigation {
  constructor() {
    this.mainContent = document.querySelector('main');
    this.audioPlayer = document.querySelector('.audio-player');
    this.currentUrl = window.location.href;
    this.isNavigating = false;
    
    this.init();
  }
  
  init() {
    // Intercept all internal link clicks
    document.addEventListener('click', this.handleLinkClick.bind(this));
    
    // Handle browser back/forward navigation
    window.addEventListener('popstate', this.handlePopState.bind(this));
    
    // Set initial state
    const initialState = {
      url: window.location.href,
      title: document.title,
      content: this.mainContent.innerHTML
    };
    window.history.replaceState(initialState, initialState.title, initialState.url);
  }
  
  handleLinkClick(event) {
    // Find closest anchor tag if the click was on a child element
    const link = event.target.closest('a');
    
    // Only handle internal links
    if (!link || 
        link.target === '_blank' || 
        link.getAttribute('download') !== null || 
        link.getAttribute('href').startsWith('#') ||
        link.getAttribute('href').startsWith('mailto:') ||
        link.getAttribute('href').startsWith('tel:') ||
        (link.getAttribute('href').includes('://') && !link.href.includes(window.location.hostname))) {
      return;
    }
    
    // Prevent default navigation
    event.preventDefault();
    
    // Navigate to the new page
    this.navigateTo(link.href);
  }
  
  handlePopState(event) {
    if (event.state) {
      this.updateContent(event.state.content, event.state.title, event.state.url, false);
    }
  }
  
  async navigateTo(url) {
    if (this.isNavigating || url === this.currentUrl) return;
    
    this.isNavigating = true;
    
    try {
      // Show loading state
      document.body.classList.add('is-navigating');
      
      // Fetch the new page content
      const response = await fetch(url);
      const html = await response.text();
      
      // Create a temporary DOM to extract content
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      
      // Extract main content and title
      const newContent = doc.querySelector('main').innerHTML;
      const newTitle = doc.title;
      
      // Check if this is an episode page
      const isEpisodePage = url.includes('/episodes/');
      const episodeNumber = isEpisodePage ? url.match(/episodes\/([0-9]+)/)?.[1] : null;
      
      // Update history state
      const state = {
        url: url,
        title: newTitle,
        content: newContent,
        episodeNumber: episodeNumber
      };
      window.history.pushState(state, newTitle, url);
      
      // Update the page content
      this.updateContent(newContent, newTitle, url, episodeNumber);
    } catch (error) {
      console.error('Navigation error:', error);
      // Fallback to traditional navigation on error
      window.location.href = url;
    } finally {
      this.isNavigating = false;
    }
  }
  
  updateContent(content, title, url, episodeNumber = null, shouldInitialize = true) {
    // Update the page content and title
    this.mainContent.innerHTML = content;
    document.title = title;
    this.currentUrl = url;
    
    // Remove loading state
    document.body.classList.remove('is-navigating');
    
    // Scroll to top
    window.scrollTo(0, 0);
    
    // Initialize any new page components, but don't reinitialize the audio player
    if (shouldInitialize) {
      // Dispatch a custom event that other components can listen for
      const event = new CustomEvent('pageContentUpdated', {
        detail: { 
          url,
          episodeNumber
        }
      });
      document.dispatchEvent(event);
    }
  }
}

// Initialize navigation when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.siteNavigation = new Navigation();
});

export default Navigation;
