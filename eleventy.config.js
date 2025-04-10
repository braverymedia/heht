import { readFileSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { promisify } from 'util';
import { exec } from 'child_process';
import postcss from 'postcss';
import postcssConfig from 'postcss-load-config';
import * as sass from 'sass';
import markdownIt from 'markdown-it';
import container from 'markdown-it-container';
import { eleventyImageTransformPlugin } from '@11ty/eleventy-img';
import pluginRss from '@11ty/eleventy-plugin-rss';
import bundlePlugin from '@11ty/eleventy-plugin-bundle';
import path from 'path';
import fs from 'fs';
import { rollup } from 'rollup';
import commonjs from '@rollup/plugin-commonjs';
import resolvePlugin from '@rollup/plugin-node-resolve';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export default async function (eleventyConfig) {
  // Plugins
  eleventyConfig.addPlugin(pluginRss);

  // Add the Eleventy Image plugin
  eleventyConfig.addPlugin(eleventyImageTransformPlugin, {
    formats: ["avif", "webp", "jpeg"],
    urlPath: "/assets/img/",
    widths: ["auto"],
    defaultAttributes: {
      loading: "lazy",
      decoding: "async",
    },
  });

  // Add the bundler plugin
  eleventyConfig.addPlugin(bundlePlugin);

  // Passthrough copy
  eleventyConfig.addPassthroughCopy("src/assets/img");
  eleventyConfig.addPassthroughCopy("src/assets/webfont");
  eleventyConfig.addPassthroughCopy("src/assets/audio");
  eleventyConfig.addPassthroughCopy("src/manifest.webmanifest");

  // Add SCSS template type
  eleventyConfig.addTemplateFormats("scss");
  eleventyConfig.setTemplateFormats(["njk", "md", "html", "scss"]);

  // Set environment variables
  process.env.ELEVENTY_ENV = process.env.ELEVENTY_ENV || 'development';
  process.env.NODE_ENV = process.env.NODE_ENV || process.env.ELEVENTY_ENV;
  const isProduction = process.env.ELEVENTY_ENV === 'production' || process.env.NODE_ENV === 'production';

  // Add SCSS template type
  eleventyConfig.addExtension("scss", {
    outputFileExtension: "css",

    // `compile` is called once per .scss file in the input directory
    compile: async function (inputContent, inputPath) {
      // Skip files like _fileName.scss
      const parsed = path.parse(inputPath);
      if (parsed.name.startsWith("_")) {
        return;
      }
      try {
        // Compile SCSS to CSS
        const result = await sass.compileStringAsync(inputContent, {
          loadPaths: ["src/assets/styles", "node_modules"],
          sourceMap: process.env.NODE_ENV !== "production",
        });

        // Process with PostCSS using config file
        const config = await postcssConfig({ config: { path: 'postcss.config.cjs' } });
        const postCSSResult = await postcss(config.plugins).process(result.css, {
          from: inputPath,
          to: inputPath.replace(/\.scss$/, '.css'),
          map: process.env.NODE_ENV !== "production" ? { inline: true } : false
        });

        // This is the render function
        return async (data) => postCSSResult.css;
      } catch (error) {
        console.error("SCSS Processing Error:", error);
        return async (data) => "";
      }
    }
  });

  // Add CSS inlining
  eleventyConfig.addFilter("inlineCss", async function (css) {
    if (process.env.NODE_ENV === "production") {
      const minified = await postcss([
        require("cssnano")({
          preset: "default",
        })
      ]).process(css, {
        from: undefined,
        to: undefined,
        map: false,
      });
      return minified.css;
    }
    return css;
  });

  // Podcast-specific filters
  eleventyConfig.addFilter("podcastDate", (date) => {
    return new Date(date).toUTCString();
  });

  eleventyConfig.addFilter("episodeUrl", (filename, podcast) => {
    if (!podcast || !podcast.episodeUrlBase) {
      console.warn("Warning: podcast.episodeUrlBase is not defined");
      return filename;
    }
    return new URL(filename, podcast.episodeUrlBase).toString();
  });

  eleventyConfig.addFilter("formatDuration", (seconds) => {
    if (!seconds) return "00:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  });

  eleventyConfig.addFilter("absoluteUrl", (path, base) => {
    if (!base) {
      console.warn("Warning: base URL is not defined");
      return path;
    }
    return new URL(path, base).toString();
  });

  eleventyConfig.addFilter("slugify", (str) => {
    if (!str) return "";
    return str
      .toLowerCase()
      .replace(/[^\w\s-]/g, "")
      .replace(/[\s_-]+/g, "-")
      .replace(/^-+|-+$/g, "");
  });

  eleventyConfig.addFilter("padStart", (str, length, char) => {
    return String(str).padStart(length, char);
  });

  eleventyConfig.addFilter("htmlDateString", (dateObj) => {
    return new Date(dateObj).toISOString().split("T")[0];
  });

  eleventyConfig.addFilter("readableDate", (dateObj) => {
    return new Date(dateObj).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  });

  eleventyConfig.addFilter("json", function (obj) {
    return JSON.stringify(obj);
  });

  eleventyConfig.addFilter("cssmin", function (code) {
    return new CleanCSS({}).minify(code).styles;
  });

  // Set development environment
  const isDev = process.env.NODE_ENV === "development";

  // Add global data for development
  if (isDev) {
    eleventyConfig.addGlobalData("env", "development");
  } else {
    eleventyConfig.addGlobalData("env", "production");
  }

  // Add timestamp for cache busting
  if (isDev) {
    eleventyConfig.addGlobalData("timestamp", Math.floor(Date.now() / 1000));
  }

  // Add cache busting for assets
  eleventyConfig.addGlobalData("cacheBust", Date.now());
  eleventyConfig.addFilter("cacheBust", function(url) {
    return `${url}?v=${this.cacheBust}`;
  });

  // Handle JavaScript bundling
  async function bundleJS() {
    try {
      console.log('Bundling JS:', { isProduction, NODE_ENV: process.env.NODE_ENV, ELEVENTY_ENV: process.env.ELEVENTY_ENV });
      
      // Define plugins array for Rollup
      const plugins = [
        resolvePlugin(),
        commonjs()
      ];
      
      const bundle = await rollup({
        input: resolve(__dirname, 'src/assets/js/index.js'),
        plugins
      });

      // Ensure the output directory exists
      const outputDir = resolve(__dirname, '_site/assets/js');
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      // Generate the bundle
      const { output } = await bundle.generate({
        format: isProduction ? 'iife' : 'es',
        sourcemap: !isProduction
      });

      // Get the main chunk (the actual JS code)
      let jsContent = output.find(chunk => chunk.type === 'chunk').code;
      
      // Write the output directly to file
      const outputPath = resolve(__dirname, '_site/assets/js/bundle.js');
      await fs.promises.writeFile(outputPath, jsContent);
      
      // Use terser CLI for minification in production
      if (isProduction) {
        console.log('Minifying JS with terser CLI...');
        const execPromise = promisify(exec);
        try {
          // Create a temporary file for the unminified JS
          const tempPath = resolve(__dirname, '_site/assets/js/bundle.unmin.js');
          await fs.promises.rename(outputPath, tempPath);
          
          // Run terser CLI command
          const terserCmd = `npx terser ${tempPath} --compress 'ecma=2020,passes=3,drop_console=true,drop_debugger=true,toplevel=true' --mangle 'toplevel=true' --format 'ecma=2020' --output ${outputPath}`;
          const { stdout, stderr } = await execPromise(terserCmd);
          
          if (stderr) {
            console.error('Terser error:', stderr);
          }
          
          // Clean up the temporary file
          await fs.promises.unlink(tempPath);
          console.log('JS minification completed');
        } catch (error) {
          console.error('Error during terser minification:', error);
          throw error;
        }
      }
      
      // If we have a sourcemap and we're not in production, write that too
      if (!isProduction) {
        const sourceMapChunk = output.find(chunk => chunk.fileName.endsWith('.map'));
        if (sourceMapChunk) {
          await fs.promises.writeFile(`${outputPath}.map`, sourceMapChunk.source);
        }
      }

      await bundle.close();
      console.log('JS bundle created successfully');
    } catch (error) {
      console.error('JavaScript bundling error:', error);
      throw error;
    }
  }

  // Add JavaScript bundling to Eleventy's lifecycle
  eleventyConfig.on('beforeBuild', async () => {
    await bundleJS();
  });

  // Base Config
  return {
    dir: {
      input: "src",
      output: "_site",
      includes: "_includes",
      data: "_data",
    },
    templateFormats: ["njk", "md", "html", "scss"],
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
    dataTemplateEngine: "njk",
    pathPrefix: process.env.ELEVENTY_SITE_URL || "/",
    env: {
      siteUrl: process.env.SITE_URL || "https://higheredhottakes.com",
    },
    development: isDev,
    cache: !isDev,
    cacheDuration: isDev ? "0s" : "1y",
    files: [
      "src/**/*.{njk,md,html,scss}"
    ],
    transforms: {
      scss: async function (content, inputPath) {
        if (inputPath.endsWith(".scss")) {
          const result = sass.compileString(content, {
            loadPaths: ["src/assets/styles", "node_modules"],
            sourceMap: process.env.NODE_ENV !== "production"
          });
          return result.css;
        }
        return content;
      }
    },
    data: {
      cacheBust: Date.now(),
      css: async function() {
        if (process.env.NODE_ENV === "production") {
          return this.processScss();
        }
        // In development, return empty string since we're using external CSS file
        return "";
      },
      isProduction: process.env.NODE_ENV === "production"
    }
  };
}
