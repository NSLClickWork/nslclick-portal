const { Jimp } = require('jimp');

async function padImage() {
    try {
        console.log("Loading image...");
        const image = await Jimp.read('public/assets/design/Logo_YTB-removebg-preview.png');
        
        const w = image.bitmap.width;
        const h = image.bitmap.height;
        const size = Math.max(w, h);
        
        console.log(`Original size: ${w}x${h}. Padding to ${size}x${size}...`);
        
        const newImage = new Jimp({ width: size, height: size, color: 0x00000000 });
        
        // Center the original image
        const x = (size - w) / 2;
        const y = (size - h) / 2;
        
        newImage.composite(image, x, y);
        
        console.log("Saving padded image...");
        await newImage.write('public/assets/design/Logo_YTB-removebg-preview.png');
        console.log("Done padding!");
    } catch (e) {
        console.error(e);
    }
}

padImage();
