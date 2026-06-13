const express = require('express');
const router = express.Router();
const puppeteer = require('puppeteer');

// ── Helper: Render page to PDF via Puppeteer ──────────────────────────────────
async function renderPdf(pageUrl, pdfOptions, res, filename) {
    let browser;
    try {
        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
        });
        const page = await browser.newPage();

        // Block analytics / telemetry to speed up load
        await page.setRequestInterception(true);
        page.on('request', (req) => {
            const url = req.url();
            if (url.includes('google-analytics') || url.includes('gtag') || url.includes('hotjar')) {
                req.abort();
            } else {
                req.continue();
            }
        });

        await page.goto(pageUrl, { waitUntil: 'networkidle0', timeout: 30000 });

        // Extra wait for web fonts (Google Fonts)
        await page.evaluate(() => document.fonts.ready);

        const pdfBuffer = await page.pdf(pdfOptions);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.end(pdfBuffer);
    } catch (err) {
        console.error('[Marketing PDF] Puppeteer error:', err.message);
        res.status(500).send('PDF generation failed. Please try again later.');
    } finally {
        if (browser) await browser.close();
    }
}

// ── Marketing pages ────────────────────────────────────────────────────────────
router.get('/employer', (req, res) => {
    const lang = req.query.lang || req.cookies.lang || 'en';
    if (lang === 'de') {
        return res.render('marketing/employer_de', { lang });
    }
    res.render('marketing/employer', { lang });
});

router.get('/student', (req, res) => {
    const lang = req.query.lang || req.cookies.lang || 'en';
    if (lang === 'de') {
        return res.render('marketing/student_de', { lang });
    }
    res.render('marketing/student', { lang });
});

// ── PDF Export endpoints ────────────────────────────────────────────────────────
router.get('/employer/pdf', async (req, res) => {
    const lang = req.query.lang || 'en';
    const port = req.socket.localPort || process.env.PORT || 3000;
    const pageUrl = `http://localhost:${port}/marketing/employer?lang=${lang}`;
    const filename = `NSL_PersonalKampagne_Employer_${lang.toUpperCase()}.pdf`;

    await renderPdf(pageUrl, {
        format: 'A4',
        landscape: true,
        margin: { top: 0, right: 0, bottom: 0, left: 0 },
        printBackground: true,
        scale: 1,
    }, res, filename);
});

router.get('/student/pdf', async (req, res) => {
    const lang = req.query.lang || 'en';
    const port = req.socket.localPort || process.env.PORT || 3000;
    const pageUrl = `http://localhost:${port}/marketing/student?lang=${lang}`;
    const filename = `NSL_PersonalKampagne_Student_${lang.toUpperCase()}.pdf`;

    await renderPdf(pageUrl, {
        format: 'A4',
        landscape: false,
        margin: { top: 0, right: 0, bottom: 0, left: 0 },
        printBackground: true,
        scale: 1,
    }, res, filename);
});

module.exports = router;
