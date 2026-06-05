const ffmpeg = require('fluent-ffmpeg');
const asyncQueue = require('async/queue');
const fs = require('fs');
const path = require('path');
const sheetsService = require('./sheets');
const driveService = require('./drive');
const youtubeService = require('./youtube');
const jobsService = require('./jobs');

// Concurrency limit 1 for Video generation
const videoQueue = asyncQueue(async (task, done) => {
    try {
        await processVideoJob(task);
    } catch (err) {
        console.error(`Video Job failed for StudentID: ${task.studentId}`, err);
    } finally {
        done();
    }
}, 1);

async function processVideoJob(task) {
    const { studentId, type, jobId } = task;
    jobsService.updateJobStatus(jobId, 'processing');
    
    let rawLocalPath = null;
    let outputLocalPath = null;

    try {
        const student = await sheetsService.getStudentById(studentId);
        if (!student) throw new Error('Student not found');

        const rawVideoUrl = student.RawVideoLink;
        if (!rawVideoUrl) throw new Error('RawVideoLink is missing');

        const rawDriveId = driveService.extractDriveId(rawVideoUrl);
        if (!rawDriveId) throw new Error('No valid Raw Video Drive ID found');

        rawLocalPath = path.join(__dirname, `../public/uploads/temp_${studentId}_raw.mp4`);
        outputLocalPath = path.join(__dirname, `../public/uploads/${studentId}-video.mp4`);
        let photoLocalPath = null;
        
        if (student.PhotoLink) {
            const driveIdMatch = student.PhotoLink.match(/[-\w]{25,}/);
            if (driveIdMatch) {
                photoLocalPath = path.join(__dirname, `../public/uploads/temp_${studentId}_photo.jpg`);
                try {
                    await driveService.downloadFromDrive(driveIdMatch[0], photoLocalPath);
                } catch(e) {
                    console.log(`Could not download photo for ${studentId}:`, e.message);
                    photoLocalPath = null;
                }
            }
        }
        
        const introPath = path.join(__dirname, '../public/assets/intro.mp4');
        const outroPath = path.join(__dirname, '../public/assets/outro.mp4');
        
        // Fonts
        const escapePath = (p) => p.replace(/\\/g, '/').replace(/:/g, '\\:');
        const fontBungee = escapePath(path.join(__dirname, '../public/assets/Bungee/Bungee-Regular.ttf'));
        const fontMontserrat = escapePath(path.join(__dirname, '../public/assets/Montserrat/Montserrat-VariableFont_wght.ttf'));
        const fontBaloo = escapePath(path.join(__dirname, '../public/assets/Baloo_Bhai_2/BalooBhai2-VariableFont_wght.ttf'));

        console.log(`Downloading raw video for ${studentId}...`);
        await driveService.downloadFromDrive(rawDriveId, rawLocalPath);

        const util = require('util');
        const ffprobe = util.promisify(ffmpeg.ffprobe);
        
        const getStreamInfo = async (p) => {
            if (!fs.existsSync(p)) return { exists: false };
            const meta = await ffprobe(p);
            let hasA = false;
            let duration = 5;
            if (meta && meta.streams) {
                for (const stream of meta.streams) {
                    if (stream.codec_type === 'audio') hasA = true;
                }
            }
            if (meta && meta.format && meta.format.duration) {
                duration = parseFloat(meta.format.duration);
            }
            return { exists: true, hasAudio: hasA, duration };
        };

        const rawMeta = await getStreamInfo(rawLocalPath);
        const introMeta = await getStreamInfo(introPath);
        const outroMeta = await getStreamInfo(outroPath);

        console.log(`Raw Video: Audio=${rawMeta.hasAudio}`);
        console.log(`Intro Video: Exists=${introMeta.exists}, Audio=${introMeta.hasAudio}, Duration=${introMeta.duration}`);
        console.log(`Outro Video: Exists=${outroMeta.exists}, Audio=${outroMeta.hasAudio}, Duration=${outroMeta.duration}`);

        await new Promise((resolve, reject) => {
            let command = ffmpeg();
            let inputCount = 0;

            // 0: Intro
            if (introMeta.exists) {
                command.input(introPath);
                inputCount++;
            }
            // 1 (or 0): Raw Main
            command.input(rawLocalPath);
            const mainIdx = inputCount;
            inputCount++;

            // 2 (or 1, 2): Outro
            let outroIdx = -1;
            if (outroMeta.exists) {
                command.input(outroPath);
                outroIdx = inputCount;
                inputCount++;
            }

            // 3: Photo
            let photoIdx = -1;
            if (photoLocalPath && fs.existsSync(photoLocalPath)) {
                command.input(photoLocalPath).inputOptions(['-loop 1']);
                photoIdx = inputCount;
                inputCount++;
            }

            let filterGraph = [];
            let concatStr = '';
            let concatCount = 0;

            if (introMeta.exists) {
                // Intro Text & PIP
                const name = (student.FullName || '').toUpperCase();
                const prof = student.ProfessionCode || '';
                const score = student.NSLScore || student.AssessmentScore || '0';
                const s1 = student.Strength1 || '';
                const s2 = student.Strength2 || '';
                const s3 = student.Strength3 || '';

                const nameFontSize = name.length > 15 ? 55 : 75;
                const drawtext = `drawtext=fontfile='${fontBungee}':text='${name}':x=150:y=310:fontsize=${nameFontSize}:fontcolor=yellow:shadowcolor=black:shadowx=2:shadowy=2,` +
                                 `drawtext=fontfile='${fontMontserrat}':text='${prof}':x=150:y=540:fontsize=50:fontcolor=white,` +
                                 `drawtext=fontfile='${fontBungee}':text='${score}':x=400:y=680:fontsize=80:fontcolor=white,` +
                                 `drawtext=fontfile='${fontMontserrat}':text='${s1.toUpperCase()}':x=150:y=960:fontsize=22:fontcolor=white,` +
                                 `drawtext=fontfile='${fontMontserrat}':text='${s2.toUpperCase()}':x=600:y=960:fontsize=22:fontcolor=white,` +
                                 `drawtext=fontfile='${fontMontserrat}':text='${s3.toUpperCase()}':x=1050:y=960:fontsize=22:fontcolor=white`;

                // PIP from Photo or Main Video
                if (photoIdx !== -1) {
                    filterGraph.push(`[${photoIdx}:v]scale=550:550:force_original_aspect_ratio=increase,crop=550:550[pip]`);
                } else {
                    filterGraph.push(`[${mainIdx}:v]scale=550:550:force_original_aspect_ratio=increase,crop=550:550[pip]`);
                }
                filterGraph.push(`[0:v]${drawtext}[intro_t]`);
                // PIP is around x=1050, y=150 (align top with white box)
                filterGraph.push(`[intro_t][pip]overlay=x=1050:y=150:shortest=1[intro_pip]`);
                filterGraph.push(`[intro_pip]scale=1920:1080,fps=30,format=yuv420p[intro_v]`);
                
                if (introMeta.hasAudio) {
                    filterGraph.push(`[0:a]aformat=sample_rates=44100:channel_layouts=stereo[intro_a]`);
                } else {
                    filterGraph.push(`anullsrc=channel_layout=stereo:sample_rate=44100,atrim=duration=${introMeta.duration}[intro_a]`);
                }
                
                concatStr += `[intro_v][intro_a]`;
                concatCount++;
            }

            // Main
            filterGraph.push(`[${mainIdx}:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,fps=30,format=yuv420p[main_v]`);
            if (rawMeta.hasAudio) {
                filterGraph.push(`[${mainIdx}:a]aformat=sample_rates=44100:channel_layouts=stereo[main_a]`);
            } else {
                filterGraph.push(`anullsrc=channel_layout=stereo:sample_rate=44100[main_a]`);
            }
            concatStr += `[main_v][main_a]`;
            concatCount++;

            // Outro
            if (outroMeta.exists) {
                filterGraph.push(`[${outroIdx}:v]scale=1920:1080,fps=30,format=yuv420p[outro_v]`);
                if (outroMeta.hasAudio) {
                    filterGraph.push(`[${outroIdx}:a]aformat=sample_rates=44100:channel_layouts=stereo[outro_a]`);
                } else {
                    filterGraph.push(`anullsrc=channel_layout=stereo:sample_rate=44100,atrim=duration=${outroMeta.duration}[outro_a]`);
                }
                concatStr += `[outro_v][outro_a]`;
                concatCount++;
            }

            filterGraph.push(`${concatStr}concat=n=${concatCount}:v=1:a=1[outv][outa]`);

            command.complexFilter(filterGraph)
                .outputOptions([
                    '-map [outv]',
                    '-map [outa]',
                    '-c:v libx264',
                    '-preset fast',
                    '-crf 28',
                    '-c:a aac',
                    '-ac 2',
                    '-shortest'
                ])
                .save(outputLocalPath)
                .on('end', () => resolve())
                .on('error', (err) => reject(err));
        });

        jobsService.updateJobStatus(jobId, 'uploading');
        let finalLink = '';
        let finalStatus = 'DONE';
        let generationError = '';
        let uploadType = 'YouTube';

        console.log(`Uploading to YouTube...`);
        try {
            const title = `NSL Candidate - ${student.FullName}`;
            const desc = `Profession: ${student.ProfessionCode}\nLevel: ${student.DeutschLevel}`;
            finalLink = await youtubeService.uploadVideo(outputLocalPath, title, desc, 'unlisted');
        } catch (ytErr) {
            console.warn(`YouTube upload failed: ${ytErr.message}. Falling back to Local Storage...`);
            finalStatus = 'DONE_LOCAL_FALLBACK';
            generationError = `YouTube Error: ${ytErr.message}`;
            uploadType = 'Local';
            const fileName = `${studentId}-video.mp4`;
            const baseUrl = process.env.BASE_URL || 'https://new-solution.eu/portal';
            finalLink = `${baseUrl}/uploads/${fileName}`;
        }

        console.log(`Updating Sheets...`);
        const updateObj = {
            VideoStatus: finalStatus,
            LastGeneratedAt: new Date().toISOString(),
            GenerationError: generationError
        };
        if (uploadType === 'YouTube') {
            updateObj.YouTubeLink = finalLink;
        } else {
            updateObj.DriveVideoLink = finalLink;
        }

        await sheetsService.updateStudentFields(studentId, updateObj);

        jobsService.updateJobStatus(jobId, 'done');
        console.log(`Successfully generated and uploaded Video for ${studentId}`);

    } catch (err) {
        jobsService.updateJobStatus(jobId, 'failed', err.message);
        try {
            await sheetsService.updateStudentFields(studentId, {
                VideoStatus: 'FAILED',
                GenerationError: err.message
            });
        } catch (sheetErr) {
            console.error('Failed to write FAILED status to sheets:', sheetErr);
        }
        throw err;
    } finally {
        // Cleanup temp files (only raw file, keep output file if it's local fallback)
        if (rawLocalPath && fs.existsSync(rawLocalPath)) fs.unlinkSync(rawLocalPath);
        if (photoLocalPath && fs.existsSync(photoLocalPath)) fs.unlinkSync(photoLocalPath);
        // Do NOT delete outputLocalPath because we serve it locally!
    }
}

function enqueueVideoJob(studentId, type) {
    const jobId = jobsService.createJob('video', studentId);
    videoQueue.push({ studentId, type, jobId });
    return { jobId, status: 'queued', message: 'Job added to Video queue' };
}

module.exports = {
    enqueueVideoJob
};
