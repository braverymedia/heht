import uploadToBunny from 'upload-to-bunny';
import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

// Purges the CDN pull-zone cache after upload. Without this, the storage
// zone gets the new build but the CDN edge keeps serving whatever it had
// cached — pages carry a 1-year Cache-Control, so a deploy with no purge
// can leave the live site showing year-old content indefinitely. Ported
// from jggweb's deploy script after hitting exactly that on 2026-08-25.
async function purgePullZoneCache() {
  const id = process.env.BUNNY_PULL_ZONE_ID;
  const key = process.env.BUNNY_ACCOUNT_API_KEY;

  if (!id || !key) {
    console.warn('Skipping cache purge — BUNNY_PULL_ZONE_ID and/or BUNNY_ACCOUNT_API_KEY not set in .env');
    return;
  }

  console.log(`Purging Bunny pull-zone cache (zone ${id})...`);
  const res = await fetch(
    `https://api.bunny.net/pullzone/${id}/purgeCache`,
    {
      method: 'POST',
      headers: {
        AccessKey: key,
        Accept: 'application/json',
      },
    }
  );

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Cache purge failed: ${res.status} ${res.statusText} ${body}`);
  }

  console.log('Cache purged.');
}

async function uploadBuild() {
  // Validate required environment variables
  const requiredEnv = ['BUNNY_API_KEY', 'BUNNY_STORAGE_ZONE'];
  const missingEnv = requiredEnv.filter(key => !process.env[key]);
  
  if (missingEnv.length > 0) {
    throw new Error(`Missing required environment variables: ${missingEnv.join(', ')}`);
  }

  // Get build directory path
  const buildDir = path.join(process.cwd(), '_site');
  
  if (!await fs.access(buildDir).then(() => true).catch(() => false)) {
    throw new Error('Build directory not found! Please run the build first.');
  }

  console.log('Starting upload to Bunny.net:');
  console.log(`Storage Zone: ${process.env.BUNNY_STORAGE_ZONE}`);

  try {
    await uploadToBunny(
      buildDir,
      '', // remote path (empty for root)
      {
        storageZoneName: process.env.BUNNY_STORAGE_ZONE, // Using the storage zone name instead of ID
        accessKey: process.env.BUNNY_API_KEY,
        cleanDestination: process.env.CLEAN_DESTINATION === 'true',
        maxConcurrentUploads: 10
      }
    );
    
    console.log('Upload completed!');
    console.log('Files should be available at:');
    console.log(`https://cdn.bunny.net/${process.env.BUNNY_STORAGE_ZONE}/`);

    await purgePullZoneCache();
  } catch (error) {
    console.error('Upload failed:', error);
    throw error;
  }
}

uploadBuild().catch((err) => {
  console.error(err);
  process.exit(1);
});