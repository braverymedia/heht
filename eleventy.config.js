import pluginRss from "@11ty/eleventy-plugin-rss";
import pluginBundle from "@11ty/eleventy-plugin-bundle";
import Image from "@11ty/eleventy-img";
import { eleventyImagePlugin } from "@11ty/eleventy-img";
import { minify } from "terser";
import CleanCSS from "clean-css";
import * as sass from "sass";
import postcss from "postcss";
import autoprefixer from "autoprefixer";
import postcssPresetEnv from "postcss-preset-env";
import fs from "fs/promises";
import path from "path";

// Image processing configuration
const imageConfig = {
	widths: [300, 900, 1600, 2000, 3000],
	formats: ["avif", "webp", "jpeg"],
	outputDir: "_site/img/",
	urlPath: "/img/",
	filenameFormat: function(id, src, width, format) {
		const hash = require('crypto').createHash('md5').update(src).digest('hex');
		return `${hash}-${width}.${format}`;
	}
};

// Bunny.net CDN configuration
const cdnConfig = {
	url: process.env.BUNNY_CDN_URL,
	storageZone: process.env.BUNNY_STORAGE_ZONE,
	apiKey: process.env.BUNNY_API_KEY,
};

// Function to upload processed images to bunny.net
async function uploadToBunnyCDN(filePath, cdnPath) {
	if (!cdnConfig.storageZone || !cdnConfig.apiKey) {
		console.warn("Bunny.net credentials not configured. Skipping CDN upload.");
		return;
	}

	try {
		const fileContent = await fs.readFile(filePath);
		const fileName = path.basename(filePath);
		const fileExt = path.extname(filePath).toLowerCase();

		// Determine the correct content type based on file extension
		let contentType = "application/octet-stream";
		if (fileExt === ".jpg" || fileExt === ".jpeg") {
			contentType = "image/jpeg";
		} else if (fileExt === ".png") {
			contentType = "image/png";
		} else if (fileExt === ".gif") {
			contentType = "image/gif";
		} else if (fileExt === ".webp") {
			contentType = "image/webp";
		} else if (fileExt === ".avif") {
			contentType = "image/avif";
		}

		// Construct the correct URL according to Bunny.net documentation
		// Format: https://{region}.storage.bunnycdn.com/{storageZoneName}/{path}/{fileName}
		const region = process.env.BUNNY_REGION || "la"; // Default to Los Angeles if not specified
		const baseUrl = region ? `https://${region}.storage.bunnycdn.com` : "https://storage.bunnycdn.com";
		const url = `${baseUrl}/${cdnConfig.storageZone}/heht${cdnPath}`;

		console.log(`Uploading to Bunny.net: ${url}`);

		const response = await fetch(url, {
			method: "PUT",
			headers: {
				"AccessKey": cdnConfig.apiKey,
				"Content-Type": contentType
			},
			body: fileContent
		});

		if (!response.ok) {
			throw new Error(`Failed to upload to bunny.net: ${response.status} ${response.statusText}`);
		}
		console.log(`Successfully uploaded ${cdnPath} to bunny.net`);
	} catch (error) {
		console.error("Error uploading to bunny.net:", error);
	}
}

// Image shortcode with CDN integration
async function imageShortcode(src, alt, sizes = "100vw") {
	if (!src) throw new Error("Missing image source");
	if (!alt) throw new Error("Missing image alt");

	let metadata = await Image(src, imageConfig);

	// Upload processed images to bunny.net in both development and production
	if (process.env.BUNNY_API_KEY) {
		for (const format of imageConfig.formats) {
			if (metadata[format]) {
				for (const image of metadata[format]) {
					const filePath = path.join(process.cwd(), imageConfig.outputDir, path.basename(image.url));
					// Use the correct path structure for Bunny.net
					// The path should be relative to the storage zone root
					const cdnPath = `/img/${path.basename(image.url)}`;
					await uploadToBunnyCDN(filePath, cdnPath);

					// Update the image URL to use the CDN URL if available
					if (process.env.BUNNY_CDN_URL) {
						// Replace the local URL with the CDN URL, including the 'heht' subdirectory
						image.url = `${process.env.BUNNY_CDN_URL}/heht${cdnPath}`;
					}
				}
			}
		}
	}

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
	eleventyConfig.addPlugin(pluginBundle);

	// Add the Eleventy Image plugin
	eleventyConfig.addPlugin(eleventyImagePlugin, {
		formats: ["avif", "webp", "jpeg"],
		urlPath: "/img/",
		defaultAttributes: {
			loading: "lazy",
			decoding: "async"
		}
	});

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

	eleventyConfig.addFilter("json", function(obj) {
		return JSON.stringify(obj);
	});

	// Collections
	eleventyConfig.addCollection("episodes", async (collection) => {
		const episodes = collection.getFilteredByGlob("src/episodes/**/*.md")
			.filter(post => !post.data.draft)
			.sort((a, b) => new Date(b.data.date) - new Date(a.data.date));

		const processedEpisodes = await Promise.all(episodes.map(async episode => {
			// Get the raw content without trying to parse it
			const content = await episode.template.read();

			// Return the episode data with the content
			return {
				...episode.data,
				url: episode.url,
				content: content
			};
		}));

		return processedEpisodes;
	})

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

	// Base Config
	return {
		dir: {
			input: "src",
			output: "_site",
			includes: "_includes",
			data: "_data"
		},
		templateFormats: ["md", "html", "njk", "11ty.js"],
		markdownTemplateEngine: "njk",
		htmlTemplateEngine: "njk",
		dataTemplateEngine: "njk",
		pathPrefix: process.env.ELEVENTY_SITE_URL || "/",
		env: {
			siteUrl: process.env.SITE_URL || "https://higheredhottakes.com",
			bunnyCdnUrl: cdnConfig.url
		}
	};
}
