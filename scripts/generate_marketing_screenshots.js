const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const SCREENSHOT_DIR = path.join(__dirname, 'public', 'images', 'marketing');

if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

const run = async () => {
    console.log('Launching browser...');
    const browser = await puppeteer.launch({
        headless: "new",
        defaultViewport: { width: 1440, height: 900 }
    });

    try {
        const page = await browser.newPage();
        
        console.log('Navigating to dashboard...');
        await page.goto('http://localhost:3000/partner/dashboard?mock=1&lang=en', { waitUntil: 'networkidle0' });
        
        await new Promise(r => setTimeout(r, 2000));

        console.log('Taking dashboard screenshot...');
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'dashboard_full.png'), fullPage: false });

        console.log('Opening Setcard modal...');
        const clicked = await page.evaluate(() => {
            const btn = document.querySelector('.btn-nsl-brutal.primary');
            if (btn) {
                btn.click();
                return true;
            }
            return false;
        });

        if (clicked) {
            await new Promise(r => setTimeout(r, 1500));
            
            console.log('Taking Setcard screenshot...');
            await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'setcard_modal.png') });
            
            // close it
            await page.mouse.click(10, 10);
            await new Promise(r => setTimeout(r, 1000));
        }

        console.log('Typing into Sharkie...');
        const aiInput = await page.$('#aiSearchInputPartner');
        const aiBtn = await page.$('.ai-search-btn');
        if (aiInput && aiBtn) {
            await aiInput.type('Show me A rank nurses');
            await aiBtn.click();
            await new Promise(r => setTimeout(r, 1000));

            // Wait for ai response if any
            await new Promise(r => setTimeout(r, 3000));

            console.log('Taking Sharkie screenshot...');
            await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'sharkie_chat.png') });
        }

        console.log('Screenshots saved successfully!');
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await browser.close();
    }
};

run();
