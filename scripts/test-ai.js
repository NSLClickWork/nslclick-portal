require('dotenv').config();
const { chatWithGemini } = require('../services/gemini');
const { getAllStudents } = require('../services/sheets');
const fs = require('fs');

const testQueries = [
    "Ich brauche eine Krankenschwester",
    "Zeig mir jemanden mit B2 Deutsch",
    "Wer hat die höchste NSL Punktzahl?",
    "Finde einen Koch für mein Restaurant",
    "Hast du Pflegekräfte, die ab Oktober verfügbar sind?",
    "Gibt es Kandidaten mit Erfahrung in der Altenpflege?",
    "Welche Kandidaten haben B1 Deutsch und sind Krankenpfleger?",
    "Zeig mir alle Kandidaten mit Rank A",
    "Ich suche nach einem Mechaniker",
    "Wer ist der jüngste Kandidat in der Datenbank?",
    "Gibt es jemanden, der gut im Team arbeiten kann?",
    "Ich brauche Pflegekräfte mit Zertifikat",
    "Zeige mir Kandidaten mit dem Schwerpunkt Intensivpflege",
    "Wer hat eine NSL Score über 80?",
    "Finde mir 3 Krankenschwestern mit B2",
    "Zeig mir Kandidaten, die russisch sprechen",
    "Hast du jemanden für die Gastronomie?",
    "Welcher Kandidat ist ab sofort verfügbar?",
    "Ich suche eine Pflegekraft, die belastbar ist",
    "Gibt es jemanden aus Hanoi?"
];

async function runTests() {
    console.log("🚀 Starting AI Testing Framework...");
    const students = await getAllStudents();
    const validStudentNames = students.map(s => s.FullName.toLowerCase());
    const validStudentIds = students.map(s => s.StudentID.toLowerCase());
    
    let totalQueries = testQueries.length;
    let successCount = 0;
    let failCount = 0;
    let hallucinatedCount = 0;
    let totalLatency = 0;
    let maxLatency = 0;
    
    const results = [];
    
    for (let i = 0; i < testQueries.length; i++) {
        const query = testQueries[i];
        console.log(`\n[${i+1}/${totalQueries}] Testing: "${query}"`);
        
        const startTime = Date.now();
        let response = "";
        let isError = false;
        
        try {
            response = await chatWithGemini(query, 'admin', 'de', null, null);
        } catch (e) {
            isError = true;
            response = "ERROR: " + e.message;
        }
        
        const latency = Date.now() - startTime;
        totalLatency += latency;
        if (latency > maxLatency) maxLatency = latency;
        
        let isHallucinated = false;
        
        if (!isError) {
            // Also mark as error if it says system overloaded
            if (response.includes("quá tải hoàn toàn") || response.includes("lỗi") || response.includes("Lỗi")) {
                isError = true;
                failCount++;
            } else {
                successCount++;
                // Check for hallucination
            // AI responses have <h4 style="...">[Name]</h4>
            // We can regex to extract names from the h4 tags
            const nameRegex = /<h4[^>]*>(.*?)<\/h4>/g;
            let match;
            const extractedNames = [];
            while ((match = nameRegex.exec(response)) !== null) {
                extractedNames.push(match[1].trim());
            }
            
            if (extractedNames.length > 0) {
                for (const name of extractedNames) {
                    if (!validStudentNames.includes(name.toLowerCase())) {
                        isHallucinated = true;
                        break;
                    }
                }
            } else if (response.includes("Xin lỗi") || response.toLowerCase().includes("kann niemanden finden") || response.includes("Leider konnte ich")) {
                // Not a hallucination if it politely declines
            }
            } // Close inner else
        } else {
            failCount++;
        }
        
        if (isHallucinated) hallucinatedCount++;
        
        console.log(`⏱️ Latency: ${latency}ms | 🎯 Hallucinated: ${isHallucinated ? 'YES ❌' : 'NO ✅'} | 🟢 Success: ${!isError}`);
        
        results.push({
            query,
            latency,
            isError,
            isHallucinated,
            responsePreview: response.substring(0, 100).replace(/\n/g, " ") + "..."
        });
        
        // Wait 2 seconds between requests to avoid rate limits
        await new Promise(r => setTimeout(r, 2000));
    }
    
    const avgLatency = (totalLatency / totalQueries).toFixed(0);
    const hallucinationRate = ((hallucinatedCount / totalQueries) * 100).toFixed(1);
    const accuracy = (((totalQueries - hallucinatedCount - failCount) / totalQueries) * 100).toFixed(1);
    
    console.log("\n=================================");
    console.log("📊 TEST REPORT SUMMARY");
    console.log("=================================");
    console.log(`Total Queries: ${totalQueries}`);
    console.log(`Average Latency: ${avgLatency} ms`);
    console.log(`Max Latency: ${maxLatency} ms`);
    console.log(`Hallucination Rate: ${hallucinationRate}% (Target < 2%)`);
    console.log(`Accuracy/Success Rate: ${accuracy}% (Target > 95%)`);
    console.log(`Failures: ${failCount}`);
    
    // Generate HTML Report
    const htmlReport = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>AI Test Report</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 40px; background: #f4f7f6; color: #333; }
            h1 { color: #2c3e50; }
            .summary { display: flex; gap: 20px; margin-bottom: 30px; }
            .card { background: #fff; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); flex: 1; text-align: center; }
            .card h3 { margin: 0; font-size: 14px; color: #7f8c8d; text-transform: uppercase; }
            .card p { margin: 10px 0 0; font-size: 24px; font-weight: bold; color: #2c3e50; }
            .pass { color: #27ae60 !important; }
            .fail { color: #c0392b !important; }
            table { width: 100%; border-collapse: collapse; background: #fff; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
            th, td { padding: 12px 15px; text-align: left; border-bottom: 1px solid #ddd; }
            th { background-color: #2c3e50; color: #fff; }
            tr:hover { background-color: #f5f5f5; }
        </style>
    </head>
    <body>
        <h1>🤖 AI Testing Framework Report</h1>
        <div class="summary">
            <div class="card">
                <h3>Total Queries</h3>
                <p>${totalQueries}</p>
            </div>
            <div class="card">
                <h3>Avg Latency</h3>
                <p class="${avgLatency < 5000 ? 'pass' : 'fail'}">${avgLatency} ms</p>
            </div>
            <div class="card">
                <h3>Max Latency</h3>
                <p>${maxLatency} ms</p>
            </div>
            <div class="card">
                <h3>Hallucination Rate</h3>
                <p class="${hallucinationRate < 2 ? 'pass' : 'fail'}">${hallucinationRate}%</p>
            </div>
            <div class="card">
                <h3>Accuracy</h3>
                <p class="${accuracy > 95 ? 'pass' : 'fail'}">${accuracy}%</p>
            </div>
        </div>
        
        <h2>Detailed Results</h2>
        <table>
            <thead>
                <tr>
                    <th>Query</th>
                    <th>Latency (ms)</th>
                    <th>Hallucinated</th>
                    <th>Error</th>
                    <th>Response Preview</th>
                </tr>
            </thead>
            <tbody>
                ${results.map(r => `
                <tr>
                    <td>${r.query}</td>
                    <td>${r.latency}</td>
                    <td class="${r.isHallucinated ? 'fail' : 'pass'}">${r.isHallucinated ? 'Yes' : 'No'}</td>
                    <td class="${r.isError ? 'fail' : 'pass'}">${r.isError ? 'Yes' : 'No'}</td>
                    <td><small>${r.responsePreview}</small></td>
                </tr>
                `).join('')}
            </tbody>
        </table>
    </body>
    </html>
    `;
    
    fs.writeFileSync('scripts/test-report.html', htmlReport);
    console.log("\n✅ Detailed HTML report saved to scripts/test-report.html");
    process.exit(0);
}

runTests();
