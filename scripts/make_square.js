const { Jimp } = require('jimp');

async function createSquareFavicon() {
    try {
        console.log("Loading image...");
        // Use Logo_YTB-removebg-preview.png as requested by user!
        const image = await Jimp.read('d:/NSLClick/logo/Logo_YTB-removebg-preview.png');
        image.autocrop(); 
        
        const width = image.bitmap.width;
        const height = image.bitmap.height;
        
        const size = Math.max(width, height);
        
        console.log(`Original cropped size: ${width}x${height}. Creating ${size}x${size} transparent square canvas...`);
        const square = new Jimp({ width: size, height: size, color: 0x00000000 });
        
        const x = Math.floor((size - width) / 2);
        const y = Math.floor((size - height) / 2);
        
        square.composite(image, x, y);
        
        // Resize to 256x256
        square.resize({ w: 256, h: 256 });
        
        console.log("Saving square image...");
        await square.write('public/assets/design/favicon_square.png');
        console.log("Favicon created successfully!");
    } catch (error) {
        console.error("Error creating favicon:", error);
    }
}
createSquareFavicon();
