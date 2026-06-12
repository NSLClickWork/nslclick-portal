const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const SCREENSHOT_DIR = path.join(__dirname, '..', 'public', 'images', 'marketing');

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
            const rows = document.querySelectorAll('tr, .candidate-card, .list-item');
            let btn = document.querySelector('.btn-nsl-brutal.primary');
            if (btn) {
                // Fake the DOM to create an anonymous perfect candidate
                const card = btn.closest('div[style*="border"], tr, .card');
                if (card) {
                    const nameEl = card.querySelector('h3, strong, .name');
                    if (nameEl) nameEl.innerHTML = 'M*** P***';
                    
                    const scoreEl = card.querySelector('.score, [style*="color: var(--nsl-dark)"]');
                    if (scoreEl) scoreEl.innerHTML = 'NSL-Result: <strong>89</strong>';

                    const imgEl = card.querySelector('img.avatar, img[src*="drive"], img[src*="google"]');
                    if (imgEl) {
                        imgEl.src = 'https://ui-avatars.com/api/?name=MP&background=ccc&color=fff&size=120';
                        imgEl.style.filter = 'blur(4px)';
                    }
                }
                
                btn.click();
                return true;
            }
            return false;
        });

        if (clicked) {
            await new Promise(r => setTimeout(r, 1500));
            
            // Further fake the modal contents just in case
            await page.evaluate(() => {
                const iframe = document.getElementById('modalIframe');
                if (iframe) {
                    // Try to inject CSS if it's same origin, otherwise we just blur the whole iframe a bit or assume the modal itself is enough
                    // But actually it's a PDF Setcard, so the iframe points to a PDF. We can't edit PDF contents easily.
                    // Instead of a real setcard, maybe just blur the iframe to protect identity?
                    iframe.style.filter = 'blur(5px)';
                }
                const title = document.getElementById('modalTitle');
                if (title) title.innerHTML = "CANDIDATE'S SETCARD";
            });

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
