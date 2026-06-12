
const puppeteer = require('puppeteer');
const { spawn } = require('child_process');
const http = require('http');

const server = spawn('node', ['server.js'], { stdio: 'pipe' });
server.stdout.on('data', d => console.log('SERVER:', d.toString().trim()));
server.stderr.on('data', d => console.error('SERVER ERR:', d.toString().trim()));

function waitForServer() {
    return new Promise(resolve => {
        const interval = setInterval(() => {
            http.get('http://127.0.0.1:3000', res => {
                clearInterval(interval);
                resolve();
            }).on('error', () => {});
        }, 500);
    });
}

(async () => {
    try {
        console.log('Waiting for server...');
        await waitForServer();
        console.log('Server is up. Launching browser...');
        
        const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
        const page = await browser.newPage();
        
        console.log('Navigating to admin login...');
        await page.goto('http://127.0.0.1:3000/?tab=admin', { waitUntil: 'networkidle0' });
        
        console.log('Typing password...');
        await page.type('input[name=password]', 'admin123');
        
        console.log('Clicking login...');
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle0' }),
            page.click('#btn-admin')
        ]);
        
        console.log('Navigated to:', page.url());
        const cookies = await page.cookies();
        console.log('Cookies:', cookies);
        
        const pageContent = await page.content();
        if (pageContent.includes('Invalid password')) {
            console.log('Result: INVALID PASSWORD DETECTED');
        } else if (pageContent.includes('CAPTCHA validation failed')) {
            console.log('Result: CAPTCHA FAILED DETECTED');
        } else if (page.url().includes('dashboard')) {
            console.log('Result: SUCCESS! Reached dashboard.');
        } else {
            console.log('Result: UNKNOWN. Page title:', await page.title());
            if (pageContent.includes('Portal Access')) {
                console.log('We are back at the login page!');
            }
        }
        
        await browser.close();
    } catch (e) {
        console.error('Test error:', e);
    } finally {
        server.kill();
        process.exit();
    }
})();

