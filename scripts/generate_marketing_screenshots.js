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

        console.log('Faking DOM for realistic screenshots...');
        const result = await page.evaluate(() => {
            // Make ALL cards look realistic before taking screenshot
            const allCards = document.querySelectorAll('tr, .candidate-card, .list-item');
            const fakePhotos = [
                'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=120&h=120&fit=crop',
                'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=120&h=120&fit=crop',
                'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=120&h=120&fit=crop',
                'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=120&h=120&fit=crop',
                'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=120&h=120&fit=crop'
            ];
            let idx = 0;
            allCards.forEach(c => {
                const nEl = c.querySelector('h3, strong, .name');
                if (nEl) {
                    const originalName = nEl.innerText || 'Candidate';
                    const initial = originalName.charAt(0);
                    nEl.innerHTML = initial + '*** ' + String.fromCharCode(65 + (idx % 26)) + '***';
                }
                const imgEl = c.querySelector('img.avatar, img[src*="drive"], img[src*="google"], img[src*="ui-avatars"]');
                if (imgEl) {
                    imgEl.src = fakePhotos[idx % fakePhotos.length];
                    imgEl.style.filter = 'blur(4px)';
                    imgEl.style.objectFit = 'cover';
                }
                idx++;
            });

            let btn = document.querySelector('.btn-nsl-brutal.primary');
            if (btn) {
                // Set score for the clicked one specifically
                const card = btn.closest('div[style*="border"], tr, .card');
                if (card) {
                    const scoreEl = card.querySelector('.score, [style*="color: var(--nsl-dark)"]');
                    if (scoreEl) scoreEl.innerHTML = 'NSL-Result: <strong>89</strong>';
                }
                
                return { clicked: true, cardsFound: allCards.length };
            }
            return { clicked: false, cardsFound: allCards.length };
        });

        console.log('Cards modified: ' + result.cardsFound);
        const clicked = result.clicked;

        // Wait for Unsplash images to load
        await new Promise(r => setTimeout(r, 4000));

        console.log('Taking dashboard screenshot...');
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'dashboard_full.png'), fullPage: false });

        if (clicked) {
            console.log('Opening Setcard modal...');
            await page.evaluate(() => {
                let btn = document.querySelector('.btn-nsl-brutal.primary');
                if (btn) btn.click();
            });
        }

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
