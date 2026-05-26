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
        if (!rawVideoUrl) {
            throw new Error('RawVideoLink is missing');
        }

        const rawDriveId = driveService.extractDriveId(rawVideoUrl);
        if (!rawDriveId) {
            throw new Error('No valid Raw Video Drive ID found in RawVideoLink');
        }

        rawLocalPath = path.join(__dirname, `../public/uploads/temp_${studentId}_raw.mp4`);
        outputLocalPath = path.join(__dirname, `../public/uploads/temp_${studentId}_final.mp4`);
        
        // Canva Overlay Path
        const overlayPath = path.join(__dirname, `../public/assets/overlay_${type}.png`);

        console.log(`Downloading raw video for ${studentId}...`);
        await driveService.downloadFromDrive(rawDriveId, rawLocalPath);

        console.log(`Detecting video metadata...`);
        const util = require('util');
        const ffprobe = util.promisify(ffmpeg.ffprobe);
        const metadata = await ffprobe(rawLocalPath);
        
        let hasAudio = false;
        let isHorizontal = false;

        if (metadata && metadata.streams) {
            for (const stream of metadata.streams) {
                if (stream.codec_type === 'audio') hasAudio = true;
                if (stream.codec_type === 'video') {
                    // Check actual orientation including rotation metadata
                    let w = stream.width;
                    let h = stream.height;
                    let rotation = 0;
                    if (stream.tags && stream.tags.rotate) {
                        rotation = parseInt(stream.tags.rotate);
                    }
                    if (stream.side_data_list) {
                        for (const sd of stream.side_data_list) {
                            if (sd.rotation !== undefined) {
                                rotation = parseInt(sd.rotation);
                            }
                        }
                    }
                    if (rotation === 90 || rotation === 270 || rotation === -90 || rotation === -270) {
                        w = stream.height;
                        h = stream.width;
                    }
                    if (w > h) isHorizontal = true;
                }
            }
        }

        const tw = isHorizontal ? 1920 : 1080;
        const th = isHorizontal ? 1080 : 1920;

        console.log(`Processing video with FFmpeg... (Audio: ${hasAudio}, Horizontal: ${isHorizontal})`);
        
        await new Promise((resolve, reject) => {
            let command = ffmpeg(rawLocalPath);
            
            // Only add fallback audio if the original doesn't have an audio stream
            if (!hasAudio) {
                command = command.input('anullsrc=channel_layout=stereo:sample_rate=44100').inputFormat('lavfi');
            }

            if (fs.existsSync(overlayPath)) {
                command = command.input(overlayPath);

                let overlayIndex = hasAudio ? 1 : 2;
                
                let complexFilter = [
                    // Scale, pad, fix HDR/format, and auto-rotate
                    `[0:v]autorotate,format=yuv420p,scale=${tw}:${th}:force_original_aspect_ratio=decrease,pad=${tw}:${th}:(ow-iw)/2:(oh-ih)/2[bg]`,
                    // Overlay the Canva template
                    `[bg][${overlayIndex}:v]overlay=0:0[outv]`
                ];

                command = command.complexFilter(complexFilter)
                    .outputOptions([
                        '-map [outv]',
                        hasAudio ? '-map 0:a' : '-map 1:a',
                        '-c:v libx264',
                        '-preset fast',
                        '-crf 28',
                        '-c:a aac',
                        '-ac 2',
                        '-shortest'
                    ]);
            } else {
                let filter = `autorotate,format=yuv420p,scale=${tw}:${th}:force_original_aspect_ratio=decrease,pad=${tw}:${th}:(ow-iw)/2:(oh-ih)/2`;
                command.outputOptions([
                    '-c:v libx264',
                    '-preset fast',
                    '-crf 28',
                    '-c:a aac',
                    '-ac 2',
                    `-vf ${filter}`,
                    '-shortest'
                ]);
                
                if (!hasAudio) {
                    // Map video from 0, generated audio from 1
                    command.outputOptions(['-map 0:v', '-map 1:a']);
                }
            }

            command.save(outputLocalPath)
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
            console.warn(`YouTube upload failed: ${ytErr.message}. Falling back to Google Drive...`);
            finalStatus = 'DONE_DRIVE_FALLBACK';
            generationError = `YouTube Error: ${ytErr.message}`;
            uploadType = 'Drive';
            const fileName = `Video_${student.FullName.replace(/\s+/g, '_')}_${studentId}.mp4`;
            finalLink = await driveService.uploadToDrive(outputLocalPath, fileName, 'video/mp4');
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
        // Cleanup
        if (rawLocalPath && fs.existsSync(rawLocalPath)) fs.unlinkSync(rawLocalPath);
        if (outputLocalPath && fs.existsSync(outputLocalPath)) fs.unlinkSync(outputLocalPath);
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
