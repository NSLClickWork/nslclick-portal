const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const publicDir = path.join(__dirname, 'public');
const outDir = path.join(publicDir, 'images', 'marketing', 'baked');

if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
}

const imagesToBake = [
    {
        name: 'mockup1_baked.png',
        src: '../mockup1.png',
        styles: `
            border-radius: 12px;
            border: 4px solid #111;
            box-shadow: 0 20px 40px rgba(0,0,0,0.2);
            transform: perspective(1000px) rotateY(-5deg) rotateX(2deg);
        `,
        width: 600,
        height: 600
    },
    {
        name: 'dashboard_full_baked.png',
        src: '../dashboard_full.png',
        styles: `
            border-radius: 12px;
            border: 4px solid white;
            box-shadow: -20px 20px 40px rgba(0,0,0,0.3);
            transform: perspective(1000px) rotateY(-15deg) rotateX(5deg) scale(0.95) translateX(-20px);
        `,
        width: 1200,
        height: 800
    },
    {
        name: 'setcard_modal_baked.png',
        src: '../setcard_modal.png',
        styles: `
            border-radius: 12px;
            border: 4px solid white;
            box-shadow: 15px 25px 40px rgba(0,0,0,0.4);
            transform: perspective(1000px) rotateY(-8deg) rotateX(5deg) rotateZ(-2deg) scale(0.9);
        `,
        width: 600,
        height: 800
    },
    {
        name: 'video_frame_baked.png',
        src: '../video_frame.png',
        styles: `
            border-radius: 12px;
            border: 4px solid white;
            box-shadow: -15px 25px 40px rgba(0,0,0,0.4);
            filter: brightness(1.6) contrast(1.1);
            transform: perspective(1000px) rotateY(8deg) rotateX(5deg) rotateZ(2deg) scale(0.85);
        `,
        width: 600,
        height: 600
    }
];

const run = async () => {
    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();
    
    for (const img of imagesToBake) {
        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body {
                        margin: 0;
                        padding: 100px; /* Add padding to prevent clipping of shadows/transforms */
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        background: transparent;
                    }
                    img {
                        display: block;
                        max-width: 100%;
                        ${img.styles}
                    }
                </style>
            </head>
            <body>
                <img src="${img.src}" id="target-img">
            </body>
            </html>
        `;

        await page.setViewport({ width: img.width + 200, height: img.height + 200, deviceScaleFactor: 2 });
        const dummyPath = path.join(outDir, 'dummy.html');
        fs.writeFileSync(dummyPath, html);
        const fileUrl = 'file://' + dummyPath.replace(/\\\\/g, '/');
        await page.goto(fileUrl);

        // Wait for image to load
        await page.evaluate(() => {
            return new Promise((resolve) => {
                const img = document.getElementById('target-img');
                if (img.complete) {
                    resolve();
                } else {
                    img.onload = resolve;
                    img.onerror = resolve;
                }
            });
        });

        // Get bounding box of the transformed element including its shadow
        // For 3D transforms, getBoundingClientRect() might be tricky.
        // We can just screenshot the document body.
        const bodyHandle = await page.$('body');
        const boundingBox = await bodyHandle.boundingBox();
        
        await page.screenshot({
            path: path.join(outDir, img.name),
            omitBackground: true,
            clip: boundingBox
        });
        
        console.log("Baked " + img.name);
    }

    await browser.close();
};

run().catch(console.error);
