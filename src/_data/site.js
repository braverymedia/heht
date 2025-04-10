"use strict";

// Make arbitrary global data available with this file.
export const env = process.env.ELEVENTY_ENV || process.env.NODE_ENV || 'development';
export const isProduction = env === 'production';
