const { Jimp } = require('jimp');

async function createSquareFavicon() {
    try {
        console.log("Loading image...");
        const image = await Jimp.read('d:/NSLClick/logo/NSL_logo_mid.png');
        image.autocrop(); // remove any transparent whitespace
        
        const width = image.bitmap.width;
        const height = image.bitmap.height;
        
        // Use a very small padding to maximize the logo size
        const padding = 20; 
        const size = Math.max(width, height) + (padding * 2);
        
        console.log(`Original cropped size: ${width}x${height}. Creating ${size}x${size} transparent square canvas...`);
        // Create a transparent background square
        const square = new Jimp({ width: size, height: size, color: 0x00000000 });
        
        const x = Math.floor((size - width) / 2);
        const y = Math.floor((size - height) / 2);
        
        square.composite(image, x, y);
        
        console.log("Saving square image...");
        await square.write('public/assets/design/favicon_square.png');
        console.log("Favicon created successfully!");
    } catch (error) {
        console.error("Error creating favicon:", error);
    }
}
createSquareFavicon();
