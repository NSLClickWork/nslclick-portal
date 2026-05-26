const jobStore = new Map();

// Cleanup jobs older than 6 hours (21600000 ms)
const JOB_TTL = 6 * 60 * 60 * 1000;

function cleanupOldJobs() {
    const now = Date.now();
    for (const [jobId, job] of jobStore.entries()) {
        if (now - job.createdAt > JOB_TTL) {
            jobStore.delete(jobId);
        }
    }
}

// Run cleanup every hour
setInterval(cleanupOldJobs, 60 * 60 * 1000);

function createJob(type, studentId) {
    const jobId = Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
    jobStore.set(jobId, {
        id: jobId,
        type,
        studentId,
        status: 'pending', // pending | processing | uploading | done | failed
        error: null,
        createdAt: Date.now()
    });
    return jobId;
}

function updateJobStatus(jobId, status, error = null) {
    const job = jobStore.get(jobId);
    if (job) {
        job.status = status;
        if (error) job.error = error;
        job.updatedAt = Date.now();
        jobStore.set(jobId, job);
    }
}

function getJob(jobId) {
    return jobStore.get(jobId) || null;
}

module.exports = {
    createJob,
    updateJobStatus,
    getJob
};
