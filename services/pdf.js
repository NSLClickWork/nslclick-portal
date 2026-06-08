const puppeteer = require('puppeteer');
const asyncQueue = require('async/queue');
const fs = require('fs');
const path = require('path');
const sheetsService = require('./sheets');
const driveService = require('./drive');
const jobsService = require('./jobs');

// Concurrency limit 2 for PDF generation
const pdfQueue = asyncQueue(async (task, done) => {
    try {
        await processPdfJob(task);
    } catch (err) {
        console.error(`PDF Job failed for StudentID: ${task.studentId}`, err);
    } finally {
        done();
    }
}, 2);

async function processPdfJob(task) {
    const { studentId, jobId } = task;
    let pdfPath;
    let photoLocalPath;
    let browser;

    try {
        jobsService.updateJobStatus(jobId, 'processing');
        console.log(`Starting PDF generation for ${studentId}`);

        // 1. Get Student Data
        const student = await sheetsService.getStudentById(studentId);
        if (!student) throw new Error('Student not found');

        // 2. Fetch photo from Drive (temp download)
        let photoBase64 = null;
        let logoBase64 = null;
        
        try {
            // Hardcode local logo as base64 for PDF
            const logoBuffer = fs.readFileSync(path.join(__dirname, '../public/logo.png'));
            logoBase64 = logoBuffer.toString('base64');
        } catch(e) {}

        if (student.PhotoLink) {
            const driveIdMatch = student.PhotoLink.match(/[-\w]{25,}/);
            if (driveIdMatch) {
                photoLocalPath = path.join(__dirname, `../public/uploads/temp_${studentId}_photo.jpg`);
                await driveService.downloadFromDrive(driveIdMatch[0], photoLocalPath);
                const photoBuffer = fs.readFileSync(photoLocalPath);
                photoBase64 = photoBuffer.toString('base64');
            }
        }

        // 3. Render EJS Template manually
        const ejs = require('ejs');
        const templatePath = path.join(__dirname, '../views/setcard-template.ejs');
        
        const html = await ejs.renderFile(templatePath, {
            student,
            photoBase64: photoBase64 ? `data:image/jpeg;base64,${photoBase64}` : null,
            logoBase64: logoBase64 ? `data:image/png;base64,${logoBase64}` : null
        });

        // 4. Puppeteer PDF Generation
        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: 'networkidle0' });
        
        pdfPath = path.join(__dirname, `../public/uploads/${studentId}-setcard.pdf`);
        await page.pdf({ path: pdfPath, format: 'A4', printBackground: true, landscape: true });

        // 5. Save locally instead of Drive
        jobsService.updateJobStatus(jobId, 'uploading');
        const fileName = `${studentId}-setcard.pdf`;
        const baseUrl = process.env.BASE_URL || 'https://new-solution.eu/portal';
        const driveLink = `${baseUrl}/uploads/${fileName}`;

        // 6. Write status back to Google Sheets
        await sheetsService.updateStudentFields(studentId, {
            SetcardLink: driveLink,
            SetcardStatus: 'DONE',
            LastGeneratedAt: new Date().toISOString(),
            GenerationError: ''
        });

        jobsService.updateJobStatus(jobId, 'done');
        console.log(`Successfully generated and uploaded Setcard for ${studentId}`);
    } catch (err) {
        jobsService.updateJobStatus(jobId, 'failed', err.message);
        
        // Write failure to sheets
        try {
            await sheetsService.updateStudentFields(studentId, {
                SetcardStatus: 'FAILED',
                GenerationError: err.message
            });
        } catch (sheetErr) {
            console.error('Failed to write FAILED status to sheets:', sheetErr);
        }
        
        throw err;
    } finally {
        if (browser) await browser.close();
        // 7. Cleanup temp files MUST be in finally block
        // Do NOT delete the PDF, because we serve it locally!
        if (photoLocalPath && fs.existsSync(photoLocalPath)) fs.unlinkSync(photoLocalPath);
    }
}

function enqueuePdfJob(studentId) {
    const jobId = jobsService.createJob('pdf', studentId);
    pdfQueue.push({ studentId, jobId });
    return { jobId, status: 'queued', message: 'Job added to PDF queue' };
}

module.exports = {
    enqueuePdfJob
};
