const { Jimp } = require('jimp');

async function createFavicon() {
    try {
        console.log("Loading image...");
        const image = await Jimp.read('d:/NSLClick/logo/NSL_logo_mid.png');
        image.autocrop(); // remove whitespace
        const height = image.bitmap.height;
        
        console.log(`Cropping left square of size ${height}x${height}...`);
        image.crop(0, 0, height, height);
        
        image.resize(256, 256);
        console.log("Saving new favicon...");
        await image.write('public/assets/design/favicon_square.png');
        console.log("Favicon created successfully!");
    } catch (error) {
        console.error("Error creating favicon:", error);
    }
}
createFavicon();
