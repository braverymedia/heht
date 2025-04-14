const fs = require('fs').promises;
const path = require('path');

async function copyAssets() {
  try {
    const srcDir = path.join(__dirname, '../src/assets/js');
    const destDir = path.join(__dirname, '../_site/assets/js');

    // Create destination directory if it doesn't exist
    await fs.mkdir(destDir, { recursive: true });

    // Get all JavaScript files in src directory
    const files = await fs.readdir(srcDir);
    const jsFiles = files.filter(file => file.endsWith('.js'));

    // Copy each JavaScript file
    for (const file of jsFiles) {
      const srcPath = path.join(srcDir, file);
      const destPath = path.join(destDir, file);
      await fs.copyFile(srcPath, destPath);
      console.log(`Copied ${file} to _site`);
    }

    console.log('JavaScript assets copied successfully');
  } catch (error) {
    console.error('Error copying assets:', error);
  }
}

// Run the copy function
if (require.main === module) {
  copyAssets();
}
