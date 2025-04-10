import { readFileSync } from "fs";
import { join } from "path";

export default async function() {
  const bunny = {
    storage: process.env.BUNNY_STORAGE_ZONE,
    api: process.env.BUNNY_API_KEY,
    cdn: `https://${process.env.BUNNY_CDN_URL}`,
    
    // Helper function to upload images to Bunny
    async upload(imagePath) {
      const formData = new FormData();
      formData.append('file', readFileSync(imagePath));
      formData.append('name', imagePath.split('/').pop());
      
      const response = await fetch(`https://api.bunny.net/storage/${process.env.BUNNY_STORAGE_ZONE}/files`, {
        method: 'POST',
        headers: {
          'AccessKey': process.env.BUNNY_API_KEY,
        },
        body: formData
      });
      
      if (!response.ok) {
        throw new Error(`Failed to upload image: ${await response.text()}`);
      }
      
      const data = await response.json();
      return `${this.cdn}/${data.name}`;
    }
  };
  
  return bunny;
}
