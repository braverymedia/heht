import pluginRss from "@11ty/eleventy-plugin-rss";
import pluginWebc from "@11ty/eleventy-plugin-webc";
import pluginBundle from "@11ty/eleventy-plugin-bundle";
import Image from "@11ty/eleventy-img";
import { minify } from "terser";
import CleanCSS from "clean-css";
import * as sass from "sass";
import postcss from "postcss";
import autoprefixer from "autoprefixer";
import postcssPresetEnv from "postcss-preset-env";

// Image shortcode
async function imageShortcode(src, alt, sizes = "100vw") {
	if (!src) throw new Error("Missing image source");
	if (!alt) throw new Error("Missing image alt");

	let metadata = await Image(src, {
		widths: [300, 600, 900, 1200],
		formats: ["avif", "webp", "jpeg"],
		outputDir: "_site/img/"
	});

	let imageAttributes = {
		alt,
		sizes,
		loading: "lazy",
		decoding: "async"
	};

	return Image.generateHTML(metadata, imageAttributes);
}

// SCSS Processing
async function processSCSS(content, inputPath) {
	// Compile SCSS to CSS
	let result = sass.compileString(content, {
		loadPaths: [
			"src/assets/styles",
			"node_modules"
		],
		sourceMap: process.env.NODE_ENV !== "production"
	});

	// Process with PostCSS
	const postCSSResult = await postcss([
		autoprefixer,
		postcssPresetEnv({ stage: 1 })
	]).process(result.css, {
		from: inputPath,
		map: process.env.NODE_ENV !== "production" ? { inline: true } : false
	});

	// Minify in production
	if (process.env.NODE_ENV === "production") {
		const cleanCSS = new CleanCSS({
			level: 2,
			sourceMap: false
		});
		const minified = cleanCSS.minify(postCSSResult.css);
		return minified.styles;
	}

	return postCSSResult.css;
}

export default async function (eleventyConfig) {
	// Plugins
	eleventyConfig.addPlugin(pluginRss);
	eleventyConfig.addPlugin(pluginWebc, {
		components: "src/_components/**/*.webc"
	});
	eleventyConfig.addPlugin(pluginBundle);

	// Passthrough copy
	eleventyConfig.addPassthroughCopy("src/assets");
	eleventyConfig.addPassthroughCopy({ "src/assets/favicon": "/" });

	// Image shortcode
	eleventyConfig.addAsyncShortcode("image", imageShortcode);

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
		return `${mins}:${secs.toString().padStart(2, '0')}`;
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
		return str.toLowerCase()
			.replace(/[^\w\s-]/g, '')
			.replace(/[\s_-]+/g, '-')
			.replace(/^-+|-+$/g, '');
	});

	eleventyConfig.addFilter("padStart", (str, length, char) => {
		return String(str).padStart(length, char);
	});

	eleventyConfig.addFilter("htmlDateString", (dateObj) => {
		return new Date(dateObj).toISOString().split('T')[0];
	});

	eleventyConfig.addFilter("readableDate", (dateObj) => {
		return new Date(dateObj).toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'long',
			day: 'numeric'
		});
	});

	// Collections
	eleventyConfig.addCollection("episodes", (collection) => {
		return collection.getFilteredByGlob("src/episodes/**/*.md")
			.filter(post => !post.data.draft)
			.sort((a, b) => b.date - a.date);
	});

	// SCSS Template
	eleventyConfig.addTemplateFormats("scss");
	eleventyConfig.addExtension("scss", {
		outputFileExtension: "css",
		compile: async function(inputContent, inputPath) {
			if (!inputPath.includes("/styles/")) {
				return;
			}
			return async () => {
				try {
					const processed = await processSCSS(inputContent, inputPath);
					return processed;
				} catch (error) {
					console.error("SCSS Processing Error:", error);
					return "";
				}
			};
		}
	});

	// Minify JS
	eleventyConfig.addNunjucksAsyncFilter("jsmin", async function (code, callback) {
		try {
			const minified = await minify(code);
			callback(null, minified.code);
		} catch (err) {
			console.error("Terser error: ", err);
			callback(null, code);
		}
	});

	// Minify CSS
	eleventyConfig.addFilter("cssmin", function (code) {
		return new CleanCSS({}).minify(code).styles;
	});

	// Watch targets
	eleventyConfig.addWatchTarget("./src/assets/styles/");

	// Base Config
	return {
		dir: {
			input: "src",
			output: "_site",
			includes: "_includes",
			data: "_data"
		},
		templateFormats: ["md", "njk", "html", "webc", "scss"],
		markdownTemplateEngine: "webc",
		htmlTemplateEngine: "webc",
		pathPrefix: "/",
		env: {
			siteUrl: process.env.SITE_URL || "https://higheredhottakes.com"
		}
	};
}
