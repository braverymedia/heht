import { readFileSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { promisify } from 'util';
import { exec } from 'child_process';
import postcss from 'postcss';
import postcssConfig from 'postcss-load-config';
import * as sass from 'sass';
import CleanCSS from "clean-css";
import markdownIt from 'markdown-it';
import container from 'markdown-it-container';
import { eleventyImageTransformPlugin } from '@11ty/eleventy-img';
import pluginRss from '@11ty/eleventy-plugin-rss';
import bundlePlugin from '@11ty/eleventy-plugin-bundle';
import pluginWebc from '@11ty/eleventy-plugin-webc';
import path from 'path';
import fs from 'fs';
import { rollup } from 'rollup';
import commonjs from '@rollup/plugin-commonjs';
import resolvePlugin from '@rollup/plugin-node-resolve';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export default async function (eleventyConfig) {
	// Set environment variables
	process.env.ELEVENTY_ENV = process.env.ELEVENTY_ENV || "development";
	process.env.NODE_ENV = process.env.NODE_ENV || process.env.ELEVENTY_ENV;
	const isProduction =
		process.env.ELEVENTY_ENV === "production" ||
		process.env.NODE_ENV === "production";

	// Plugins
	eleventyConfig.addPlugin(pluginRss);
	eleventyConfig.addPlugin(pluginWebc, {
		components: "src/_components/**/*.webc",
	});

	// Custom markdown-it container for transcript blocks
	const markdownLib = markdownIt({ html: true, breaks: true, linkify: true });
	markdownLib.use(container, 'transcript', {
	  render: function (tokens, idx) {
	    if (tokens[idx].nesting === 1) {
	      return '<section class="transcript" role="region" aria-labelledby="transcript-title" itemscope itemtype="https://schema.org/PodcastEpisode">\n<h2 id="transcript-title" class="detail__section-title">Transcript</h2>\n';
	    } else {
	      return '</section>\n';
	    }
	  }
	});
	markdownLib.use(container, 'chapters', {
	  render: function (tokens, idx) {
	    if (tokens[idx].nesting === 1) {
	      return '<div class="chapters-section">\n<h3 class="detail__section-title">Chapters</h3>\n<ol class="chapters">\n';
	    } else {
	      return '</ol>\n</div>\n';
	    }
	  }
	});

	// Custom rule: convert chapter lines (MM:SS Text) inside :::chapters to <li>
	const defaultParagraphRender = markdownLib.renderer.rules.paragraph_open || function(tokens, idx, options, env, self) {
	  return self.renderToken(tokens, idx, options);
	};
	markdownLib.renderer.rules.paragraph_open = function(tokens, idx, options, env, self) {
	  // Check if the next inline token looks like chapter lines
	  const nextToken = tokens[idx + 1];
	  if (nextToken && nextToken.type === 'inline' && nextToken.content) {
	    const lines = nextToken.content.split('\n');
	    const allChapters = lines.every(l => /^\d{1,2}:\d{2}\s/.test(l.trim()) || l.trim() === '');
	    if (allChapters && lines.filter(l => l.trim()).length > 1) {
	      // Replace paragraph with chapter list items
	      const items = lines
	        .filter(l => l.trim())
	        .map(l => {
	          const match = l.trim().match(/^(\d{1,2}:\d{2})\s+(.+)/);
	          if (match) {
	            const [mm, ss] = match[1].split(':').map(Number);
	            const seconds = mm * 60 + ss;
	            return `<li><button type="button" class="chapters__item" data-seek="${seconds}"><time datetime="PT${mm}M${ss}S">${match[1]}</time><span>${match[2]}</span></button></li>`;
	          }
	          return '';
	        })
	        .join('\n');
	      // Override the inline content and suppress the paragraph tags
	      nextToken.content = '';
	      nextToken.children = [];
	      return `<ol class="chapters">\n${items}\n</ol>\n<!-- `;
	    }
	  }
	  return defaultParagraphRender(tokens, idx, options, env, self);
	};
	const defaultParagraphClose = markdownLib.renderer.rules.paragraph_close || function(tokens, idx, options, env, self) {
	  return self.renderToken(tokens, idx, options);
	};
	markdownLib.renderer.rules.paragraph_close = function(tokens, idx, options, env, self) {
	  // Check if previous paragraph_open was converted to chapters
	  const prevToken = tokens[idx - 2]; // paragraph_open is 2 back
	  if (prevToken && prevToken.type === 'paragraph_open') {
	    const inlineToken = tokens[idx - 1];
	    if (inlineToken && inlineToken.content === '' && inlineToken.children && inlineToken.children.length === 0) {
	      return ' -->';
	    }
	  }
	  return defaultParagraphClose(tokens, idx, options, env, self);
	};
	// Assign our custom markdown-it instance
	eleventyConfig.setLibrary('md', markdownLib);

	// Watch all SCSS files (including partials) for live reload in dev
	eleventyConfig.setServerOptions({
		watch: [
			"src/assets/styles/**/*.scss"
		],
		on: {
			"watch:fileChanged": (changedPath) => {
				if (
					changedPath.endsWith(".scss") &&
					changedPath.includes("partials") &&
					!changedPath.endsWith("main.scss")
				) {
					// Touch main.scss to trigger rebuild
					const mainPath = "src/assets/styles/main.scss";
					const now = new Date();
					fs.utimesSync(mainPath, now, now);
				}
			}
		}
	});

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

	// CSS minification filter
	eleventyConfig.addFilter("cssmin", function(code) {
		return new CleanCSS({}).minify(code).styles;
	});

	// Global inlineCss data (reads built CSS)
	eleventyConfig.addGlobalData("inlineCss", () => {
		const cssPath = "src/_includes/assets/assets/main.css";
		try {
			return fs.readFileSync(cssPath, "utf8");
		} catch (e) {
			return "";
		}
	});

	// Watch the compiled CSS for changes. This is the file that `inlineCss`
	// (addGlobalData above) reads synchronously — without this watch target
	// 11ty has no idea Rollup's watcher rebuilt the stylesheet, so the
	// served HTML keeps whatever CSS was inlined at server startup. The
	// previous path (`_site/assets/styles/main.css`) doesn't exist — CSS
	// isn't copied to _site, it's embedded in every page at build time.
	eleventyConfig.addWatchTarget("src/_includes/assets/assets/main.css");

	// Passthrough copy
	eleventyConfig.addPassthroughCopy("src/assets/img");
	eleventyConfig.addPassthroughCopy("src/assets/webfont");
	eleventyConfig.addPassthroughCopy("src/assets/audio");
	eleventyConfig.addPassthroughCopy("src/manifest.webmanifest");
	eleventyConfig.addPassthroughCopy("src/favicon.svg");
	eleventyConfig.addPassthroughCopy("src/icon-192.png");
	eleventyConfig.addPassthroughCopy("src/icon-512.png");
	eleventyConfig.addPassthroughCopy("src/apple-touch-icon.png");
	// Add CSS inlining
	eleventyConfig.addFilter("inlineCss", async function (css) {
		if (isProduction) {
			const minified = await postcss([
				require("cssnano")({
					preset: "default",
				}),
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
		// Always use the full URL — audio is hosted remotely, and JS-created
		// <audio> elements resolve bare filenames against the page URL.
		if (!podcast || !podcast.episodeUrlBase) {
			console.warn("Warning: podcast.episodeUrlBase is not defined");
			return filename;
		}
		return new URL(filename, podcast.episodeUrlBase).toString();
	});

	eleventyConfig.addFilter("videoUrl", (filename, podcast) => {
		if (!filename) return '';
		if (!podcast || !podcast.videoUrlBase) {
			console.warn("Warning: podcast.videoUrlBase is not defined");
			return filename;
		}
		return new URL(filename, podcast.videoUrlBase).toString();
	});

	eleventyConfig.addFilter("formatDuration", (seconds) => {
		if (!seconds) return "00:00";
		const mins = Math.floor(seconds / 60);
		const secs = Math.floor(seconds % 60);
		return `${mins}:${secs.toString().padStart(2, "0")}`;
	});

	eleventyConfig.addFilter("durationHuman", (seconds) => {
		if (!seconds || isNaN(seconds)) return "0s";
		const h = Math.floor(seconds / 3600);
		const m = Math.floor((seconds % 3600) / 60);
		const s = Math.floor(seconds % 60);
		let result = "";
		if (h > 0) result += `${h}h `;
		if (m > 0 || h > 0) result += `${m}m `;
		result += `${s}s`;
		return result.trim();
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

	eleventyConfig.addFilter("styledDate", (dateObj) => {
		const d = new Date(dateObj);
		const y = d.getFullYear();
		const m = String(d.getMonth() + 1).padStart(2, '0');
		const day = String(d.getDate()).padStart(2, '0');
		return `${y} · ${m} · ${day}`;
	});

	eleventyConfig.addFilter("json", function (obj) {
		return JSON.stringify(obj);
	});

	eleventyConfig.addFilter("cssmin", function (code) {
		return new CleanCSS({}).minify(code).styles;
	});

	// Add filter to remove transcript blocks
	eleventyConfig.addFilter("removeTranscript", function(content) {
		if (!content) return '';
		// Remove the transcript section by looking for the rendered HTML
		const transcriptRegex = /<section class="transcript"[\s\S]*?<\/section>/;
		return content.replace(transcriptRegex, '').trim();
	});

	// Add global data for development
	if (!isProduction) {
		eleventyConfig.addGlobalData("env", "development");
	} else {
		eleventyConfig.addGlobalData("env", "production");
	}

	// Add timestamp for cache busting
	if (!isProduction) {
		eleventyConfig.addGlobalData(
			"timestamp",
			Math.floor(Date.now() / 1000)
		);
	}

	// Add cache busting for assets
	eleventyConfig.addGlobalData("cacheBust", Date.now());
	eleventyConfig.addFilter("cacheBust", function (url) {
		return `${url}?v=${this.cacheBust}`;
	});

	// Passthrough copy
	eleventyConfig.addPassthroughCopy("src/assets/img");
	eleventyConfig.addPassthroughCopy("src/assets/webfont");
	eleventyConfig.addPassthroughCopy("src/assets/audio");
	eleventyConfig.addPassthroughCopy("src/manifest.webmanifest");
	eleventyConfig.addPassthroughCopy("src/favicon.svg");
	eleventyConfig.addPassthroughCopy("src/icon-192.png");
	eleventyConfig.addPassthroughCopy("src/icon-512.png");
	eleventyConfig.addPassthroughCopy("src/apple-touch-icon.png");
	// Only copy individual JS files in development
	if (!isProduction) {
		eleventyConfig.addPassthroughCopy("src/assets/js");
	}

	// Handle JavaScript bundling
	async function bundleJS() {
		try {
			console.log("Bundling JS:", {
				isProduction,
				NODE_ENV: process.env.NODE_ENV,
				ELEVENTY_ENV: process.env.ELEVENTY_ENV,
			});

			// Define plugins array for Rollup
			const plugins = [resolvePlugin(), commonjs()];

			const bundle = await rollup({
				input: resolve(__dirname, "src/assets/js/index.js"),
				plugins,
			});

			// Ensure the output directory exists
			const outputDir = resolve(__dirname, "_site/assets/js");
			if (!fs.existsSync(outputDir)) {
				fs.mkdirSync(outputDir, { recursive: true });
			}

			// Generate the bundle
			const { output } = await bundle.generate({
				format: isProduction ? "iife" : "es",
				sourcemap: !isProduction,
			});

			// Get the main chunk (the actual JS code)
			let jsContent = output.find((chunk) => chunk.type === "chunk").code;

			// Write the output directly to file
			const outputPath = resolve(__dirname, "_site/assets/js/bundle.js");
			await fs.promises.writeFile(outputPath, jsContent);

			// Use terser CLI for minification in production
			if (isProduction) {
				console.log("Minifying JS with terser CLI...");
				const execPromise = promisify(exec);
				try {
					// Create a temporary file for the unminified JS
					const tempPath = resolve(
						__dirname,
						"_site/assets/js/bundle.unmin.js"
					);
					await fs.promises.rename(outputPath, tempPath);

					// Run terser CLI command
					const terserCmd = `npx terser ${tempPath} --compress 'ecma=2020,passes=3,drop_console=true,drop_debugger=true,toplevel=true' --mangle 'toplevel=true' --format 'ecma=2020' --output ${outputPath}`;
					const { stdout, stderr } = await execPromise(terserCmd);

					if (stderr) {
						console.error("Terser error:", stderr);
					}

					// Clean up the temporary file
					await fs.promises.unlink(tempPath);
					console.log("JS minification completed");
				} catch (error) {
					console.error("Error during terser minification:", error);
					throw error;
				}
			}

			// If we have a sourcemap and we're not in production, write that too
			if (!isProduction) {
				const sourceMapChunk = output.find((chunk) =>
					chunk.fileName.endsWith(".map")
				);
				if (sourceMapChunk) {
					await fs.promises.writeFile(
						`${outputPath}.map`,
						sourceMapChunk.source
					);
				}
			}

			await bundle.close();
			console.log("JS bundle created successfully");
		} catch (error) {
			console.error("JavaScript bundling error:", error);
			throw error;
		}
	}

	// Add JavaScript bundling to Eleventy's lifecycle
	eleventyConfig.on("beforeBuild", async () => {
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
		templateFormats: ["njk", "md", "html", "webc"],
		markdownTemplateEngine: "njk",
		htmlTemplateEngine: "njk",
		dataTemplateEngine: "njk",
		pathPrefix: process.env.ELEVENTY_SITE_URL || "/",
		env: {
			siteUrl: process.env.SITE_URL || "https://higheredhottakes.com",
		},
		development: !isProduction,
		cache: isProduction,
		cacheDuration: !isProduction ? "0s" : "1y",
		files: ["src/**/*.{njk,md,html}"],
		collections: {
			episodes: function(collection) {
				return collection.getFilteredByTag("episodes").sort((a, b) => {
					return new Date(b.data.date) - new Date(a.data.date);
				});
			}
		},
		data: {
			cacheBust: Date.now(),
			isProduction: process.env.NODE_ENV === "production",
		},
	};
}
