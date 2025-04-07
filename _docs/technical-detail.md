Here's a technical specification for building a podcast site with 11ty + Nunjucks, optimized for AI implementation:

---

## **Podcast Site Technical Specification v1.0**

### **Core Stack**

- **Static Generator**: Eleventy (11ty) v3.0+
- **Template Engine**: Nunjucks (`njk`)
- **Audio Handling**: Native HTML5 `<audio>` + JavaScript
- **Hosting**: Static deployment (Netlify/Vercel/GitHub Pages)
- **CDN**: Bunny.net Storage
- **Newsletter**: Loops.so

---

### **Directory Structure**

```md
src/
├── _components/          # Nunjucks components
│   ├── audio-player.njk
│   ├── episode-card.njk
│   ├── global-player.njk
│   ├── meta.njk
│   ├── newsletter-form.njk
│   ├── site-nav.njk
│   └── subscribe-bar.njk
├── _data/
│   ├── podcast.json      # Podcast metadata
│   └── episodes.json     # Episode collection config
├── _includes/
│   ├── layouts/
│   │   ├── base.njk      # Main Layout
│   │   └── episode.njk   # Podcast Episode Layout
│   └── podcast-feed.njk  # RSS Feed template
├── assets/
│   ├── js/
│   │   ├── site-nav.js
│   │   └── newsletter-form.js
│   └── svg/              # SVG icons
├── episodes/             # Individual episode markdown
│   └── *.md              # Episode pages
└── *.njk                # Static pages
```

---

### **Key Components**

1. **Layout System**
   - Base layout with template blocks for inheritance
   - Separate layouts for episodes and pages
   - Template inheritance for consistent styling

2. **Components**
   - Reusable Nunjucks components for common elements
   - Data passing through component includes
   - Conditional rendering with Nunjucks syntax

3. **Audio Player**
   - Native HTML5 audio player with custom controls
   - JavaScript for state management
   - Responsive design with CSS

4. **Navigation**
   - Mobile-responsive navigation
   - Episode list integration
   - Newsletter subscription

5. **RSS Feed**
   - Valid podcast RSS feed
   - iTunes and RSS 2.0 compliance
   - Episode metadata and enclosures

---

### **Data Management**

- **Podcast Metadata**: JSON configuration
- **Episodes**: Markdown files with frontmatter
- **Collections**: 11ty collections for episode management
- **Environment Variables**: For configuration and secrets

---

### **Performance Considerations**

- **Image Optimization**: Using 11ty-img plugin
- **JavaScript**: Separate files for better caching
- **CSS**: Single main stylesheet with modular structure
- **CDN**: Bunny.net for image delivery

---

### **Development Workflow**

- **Local Development**: 11ty watch mode
- **Build Process**: 11ty build with optimization
- **Deployment**: Static site deployment
- **Testing**: Browser compatibility and accessibility

---

### **Accessibility Features**

- **Skip Links**: For keyboard navigation
- **ARIA Labels**: For screen readers
- **Responsive Design**: For all devices
- **Color Contrast**: For visual accessibility

---

### **Security Features**

- **Content Security**: Proper escaping
- **JavaScript**: Secure form handling
- **API Integration**: Secure authentication

---

### **Example Episode Frontmatter**

```markdown
---
title: "Episode Title"
date: 2025-04-02
duration: "01:23:45"
audio: /audio/episode-1.mp3
shownotes: |
  ## Episode Highlights
  - Topic 1
  - Topic 2
---
```

This spec combines Nunjucks implementation with podcast-specific requirements, optimized for maintainability and performance. The AI agent should implement progressive enhancement patterns and validate all podcast RSS requirements through Apple Podcasts specifications.

<div>⁂</div>

[^1]: https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/2254427/d599cb91-a803-40f9-9140-b47397c19051/Evangelist-and-the-Critic.md

[^2]: https://www.11ty.dev/docs/languages/nunjucks/

[^3]: https://www.packtpub.com/en-ic/product/eleventy-by-example-9781804610497/chapter/chapter-7-building-a-podcast-website-with-11ty-plugins-and-custom-outputs-7/section/technical-requirements?chapterId=7

[^4]: https://11ty.rocks/posts/understanding-nunjucks-features-and-concepts/

[^5]: https://mozilla.github.io/nunjucks/

[^6]: https://www.packtpub.com/en-ic/product/eleventy-by-example-9781804610497/chapter/chapter-7-building-a-podcast-website-with-11ty-plugins-and-custom-outputs-7/section/finding-11ty-plugins?chapterId=7

[^7]: https://www.smashingmagazine.com/2021/03/eleventy-static-site-generator/

[^8]: https://katiekodes.com/11ty-podcast-rss/

[^9]: https://github.com/kkgthb/web-site-11ty-06-podcast

[^10]: https://11tybundle.dev/categories/nunjucks/

[^11]: https://podwise.ai/dashboard/episodes/1288323

[^12]: https://www.11ty.dev/docs/data-frontmatter/

[^13]: https://11ty.rocks/posts/introduction-nunjucks/

[^14]: https://11tybundle.dev/blog/11ty-bundle-1/

[^15]: https://stevenwoodson.com/blog/eleventy-style-guide-generator-with-nunjucks-component-support/

[^16]: https://www.11ty.dev/docs/plugins/rss/

[^17]: https://www.11ty.dev

[^18]: https://11tymeetup.dev/events/ep-11-nunjucks-with-zach/

[^19]: https://www.11ty.dev/docs/plugins/community/
