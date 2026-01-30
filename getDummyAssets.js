const fs = require('fs');
const path = require('path');
const https = require('https');

// 1. Ensure the assets folder exists
const assetsDir = path.join(__dirname, 'client', 'public', 'assets');
if (!fs.existsSync(assetsDir)){
    fs.mkdirSync(assetsDir, { recursive: true });
    console.log(`Created directory: ${assetsDir}`);
}

// 2. The Dummy Data (Matches your server/gameData.js ids)
const images = [
    { 
        filename: 'q1.webp', 
        url: 'https://placehold.co/600x400/png?text=Round+1:+Real+Finger' 
    },
    { 
        filename: 'q2.webp', 
        url: 'https://placehold.co/600x400/png?text=Round+2:+AI+Poem' 
    },
    { 
        filename: 'q3.webp', 
        url: 'https://placehold.co/600x400/png?text=Round+3:+Deepfake' 
    }
];

// 3. The Downloader
const downloadImage = (url, filepath) => {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(filepath);
        https.get(url, (response) => {
            response.pipe(file);
            file.on('finish', () => {
                file.close();
                console.log(`Downloaded: ${path.basename(filepath)}`);
                resolve();
            });
        }).on('error', (err) => {
            fs.unlink(filepath, () => {}); // Delete failed file
            console.error(`Error downloading ${url}: ${err.message}`);
            reject(err);
        });
    });
};

// 4. Run it
(async () => {
    console.log('--- STARTING ASSET DOWNLOAD ---');
    for (const img of images) {
        await downloadImage(img.url, path.join(assetsDir, img.filename));
    }
    console.log('--- DONE. REFRESH YOUR BROWSER. ---');
})();