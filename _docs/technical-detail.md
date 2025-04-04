Here's a technical specification for building a podcast site with 11ty + WebC, optimized for AI implementation:

---

## **Podcast Site Technical Specification v1.0**

### **Core Stack**

- **Static Generator**: Eleventy (11ty) v3.0+
- **Component Engine**: WebC v0.10+ (`@11ty/eleventy-plugin-webc`)
- **Audio Handling**: `&lt;audio&gt;` + WebC state management
- **Hosting**: Static deployment (Netlify/Vercel/GitHub Pages)
- **CDN**: Bunny.net Storage
- **Newsletter**: Loops.so

---

### **Directory Structure**

```md
src/
├── _components/          # WebC components
│   ├── audio-player.webc
│   ├── episode-card.webc
│   └── nav.webc
├── _data/
│   ├── podcast.json      # Podcast metadata
│   └── episodes/         # Individual episode markdown
├── _includes/
│   ├── svg/              # SVG icons for inclusion
│   └── layouts/
│       ├── base.njk      # Main Layout
│       ├── episode.njk   # Podcast Episode Layout
│       └── page.njk      # Page layout
├── assets/
│   └── styles/
├── pages/                # Static pages
    └── *.md              # Episode pages
└── episodes/
    └── *.md              # Episode pages
```

---

### **WebC Component Requirements**

1. **Persistent Audio Player** ([^4][^8])

```html

&lt;template webc:root&gt;
  <div>
    &lt;audio :src="currentEpisode.url" webc:is="is-land" on:visible&gt;
      &lt;script webc:setup&gt;
        const storedTime = localStorage.getItem('playbackTime');
        this.currentEpisode = JSON.parse(localStorage.getItem('currentEpisode'));
      &lt;/script&gt;
    &lt;/audio&gt;
  </div>
  &lt;style webc:scoped&gt;
    .fixed-bottom { position: fixed; bottom: 1rem; }
  &lt;/style&gt;
&lt;/template&gt;
```

1. **AJAX Navigation System** ([^1][^2])
```javascript
// _includes/layouts/base.webc
&lt;script&gt;
document.addEventListener('click', async (e) =&gt; {
  if (e.target.closest('a:not([data-no-ajax])')) {
    e.preventDefault();
    const response = await fetch(e.target.href);
    const html = await response.text();

    document.startViewTransition(() =&gt; {
      document.querySelector('main').innerHTML =
        new DOMParser().parseFromString(html, 'text/html')
          .querySelector('main').innerHTML;
    });
  }
});
&lt;/script&gt;
```

---

### **Key Features Implementation**

**1. Episode Data Flow** ([^3][^6][^8])

```json
# _data/podcast.json
{
  "title": "Podcast Title",
  "author": "Host Name",
  "description": "Show description",
  "artwork": "/img/cover.jpg"
}
```

**2. Dynamic JSON Endpoints** ([^2][^5])

```njk
{# episode.webc #}
---
permalink: /episodes/{{ episode.slug }}/data.json
eleventyExcludeFromCollections: true
---
{{ episode | json }}
```

**3. RSS Feed Generation** ([^3][^6][^8])

```javascript
// .eleventy.js
const pluginRSS = require('@11ty/eleventy-plugin-rss');
eleventyConfig.addPlugin(pluginRSS);
eleventyConfig.addShortcode('itunesNamespace', () =&gt; `
  xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"
  xmlns:content="http://purl.org/rss/1.0/modules/content/"
`);
```

---

### **Performance Requirements**

1. **Partial Hydration** ([^2][^4])
```html
&lt;is-land on:visible&gt;
  &lt;template data-island&gt;

  &lt;/template&gt;
&lt;/is-land&gt;
```

2. **Asset Optimization**

- Audio: Lazy-load with `&lt;audio preload="none"&gt;`
- Images: Use `@11ty/eleventy-img` WebC component
- CSS: Critical path extraction via WebC bundler

---

### **Build Configuration**

```javascript
// .eleventy.js
const pluginWebc = require("@11ty/eleventy-plugin-webc");
const { EleventyRenderPlugin } = require("@11ty/eleventy");

module.exports = function(eleventyConfig) {
  eleventyConfig.addPlugin(EleventyRenderPlugin);
  eleventyConfig.addPlugin(pluginWebc, {
    components: "_components/**/*.webc",
    bundlePluginOptions: {
      transforms: [
        async (content) =&gt; {
          if(this.type === "css") return optimizeCSS(content);
          return content;
        }
      ]
    }
  });
};
```

---

### **Deployment Requirements**

1. **Static Hosting** ([^7][^8])

- Generate valid podcast RSS feed at `/feed.xml`
- Set cache headers for audio files (TTL: 1 year)
- Enable Brotli compression for text assets

2. **Validation Steps**

- Podcast RSS validation (Podbase)
- Lighthouse Performance score >95
- AMP validation for episode pages

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

This spec combines WebC's component architecture[^2][^4][^5] with podcast-specific requirements[^3][^6][^8], optimized for maintainability and performance. The AI agent should implement progressive enhancement patterns and validate all podcast RSS requirements through Apple Podcasts specifications.

<div>⁂</div>

[^1]: https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/2254427/d599cb91-a803-40f9-9140-b47397c19051/Evangelist-and-the-Critic.md

[^2]: https://www.11ty.dev/docs/languages/webc/

[^3]: https://www.packtpub.com/en-ic/product/eleventy-by-example-9781804610497/chapter/chapter-7-building-a-podcast-website-with-11ty-plugins-and-custom-outputs-7/section/technical-requirements?chapterId=7

[^4]: https://11ty.rocks/posts/understanding-webc-features-and-concepts/

[^5]: https://github.com/11ty/webc

[^6]: https://www.packtpub.com/en-ic/product/eleventy-by-example-9781804610497/chapter/chapter-7-building-a-podcast-website-with-11ty-plugins-and-custom-outputs-7/section/finding-11ty-plugins?chapterId=7

[^7]: https://www.smashingmagazine.com/2021/03/eleventy-static-site-generator/

[^8]: https://katiekodes.com/11ty-podcast-rss/

[^9]: https://github.com/kkgthb/web-site-11ty-06-podcast

[^10]: https://11tybundle.dev/categories/webc/

[^11]: https://podwise.ai/dashboard/episodes/1288323

[^12]: https://www.11ty.dev/docs/data-frontmatter/

[^13]: https://11ty.rocks/posts/introduction-webc/

[^14]: https://11tybundle.dev/blog/11ty-bundle-1/

[^15]: https://stevenwoodson.com/blog/eleventy-style-guide-generator-with-webc-component-support/

[^16]: https://www.11ty.dev/docs/plugins/rss/

[^17]: https://www.11ty.dev

[^18]: https://11tymeetup.dev/events/ep-11-webc-with-zach/

[^19]: https://www.11ty.dev/docs/plugins/community/

