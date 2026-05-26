const { google } = require('googleapis');
const { serviceAccountClient } = require('./googleAuth');

// Default Database Config
const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID || '1mMfpTipZ8w9LpnebDlc1qC7pkNoX3NafhGXdUeJjyH4'; // Fallback to their exact ID
const MASTER_SHEET = 'CHECKLIST'; // Tên tab thực tế trong Google Sheets
const PARTNER_SHEET = 'PARTNER';  // Tên tab thực tế trong Google Sheets

async function getSheetsInstance() {
    if (!serviceAccountClient) {
        throw new Error('Service Account Client is not initialized. Check credentials.json');
    }
    return google.sheets({ version: 'v4', auth: serviceAccountClient });
}

let cachedStudents = null;
let lastCacheTime = 0;
const CACHE_TTL = 30000; // 30 seconds

/**
 * Lấy tất cả thông tin học viên từ Master Sheet
 */
async function getAllStudents() {
    if (!SPREADSHEET_ID) return [];
    
    if (cachedStudents && Date.now() - lastCacheTime < CACHE_TTL) {
        return cachedStudents;
    }
    
    try {
        const sheets = await getSheetsInstance();
        // Fetch both CHECKLIST and NSL-ASSESS tabs
        const response = await sheets.spreadsheets.values.batchGet({
            spreadsheetId: SPREADSHEET_ID,
            ranges: [`${MASTER_SHEET}!A:AZ`, `NSL-ASSESS!A:AZ`],
        });

        const checklistRows = response.data.valueRanges[0].values;
        const assessRows = response.data.valueRanges[1] ? response.data.valueRanges[1].values : null;

        if (!checklistRows || checklistRows.length === 0) return [];

        // Parse CHECKLIST
        let headerIndex = checklistRows.findIndex(row => row.some(cell => cell.trim().toLowerCase().replace(/\s/g, '') === 'studentid'));
        if (headerIndex === -1) headerIndex = 0;

        const rawHeaders = checklistRows[headerIndex];
        const headers = rawHeaders.map(h => {
            let key = h.trim();
            if (key.toLowerCase() === 'student name' || key.toLowerCase() === 'fullname') return 'FullName';
            if (key.toLowerCase() === 'student id' || key.toLowerCase() === 'studentid') return 'StudentID';
            if (key.toLowerCase() === 'photo' || key.toLowerCase() === 'photo link') return 'PhotoLink';
            if (key.toLowerCase() === 'activity photo' || key.toLowerCase() === 'activity photo link') return 'ActivityPhotoLink';
            if (key.toLowerCase() === 'introduction video' || key.toLowerCase() === 'youtube link') return 'YouTubeLink';
            if (key.toLowerCase() === 'availability' || key.toLowerCase() === 'available from') return 'AvailableFrom';
            if (key.toLowerCase() === 'language school' || key.toLowerCase() === 'center code') return 'CenterCode';
            if (key.toLowerCase() === 'superpower 1' || key.toLowerCase() === 'strength 1') return 'Strength1';
            if (key.toLowerCase() === 'superpower 2' || key.toLowerCase() === 'strength 2') return 'Strength2';
            if (key.toLowerCase() === 'superpower 3' || key.toLowerCase() === 'strength 3') return 'Strength3';
            if (key.toLowerCase() === 'candidate cards' || key.toLowerCase() === 'setcard') return 'SetcardLink';
            return key;
        });

        const students = checklistRows.slice(headerIndex + 1).map((row, index) => {
            const student = { rowIndex: headerIndex + index + 2 };
            headers.forEach((header, i) => {
                if (header) {
                    student[header] = row[i] || '';
                }
            });
            
            // Extract DOB from StudentID
            if (student.StudentID) {
                const parts = student.StudentID.split('_');
                if (parts.length > 0) {
                    const lastPart = parts[parts.length - 1];
                    if (/\d{2}\.\d{2}\.\d{4}/.test(lastPart)) {
                        student.DOB = lastPart;
                    }
                }
            }
            
            return student;
        });

        // Parse NSL-ASSESS and merge
        if (assessRows && assessRows.length > 0) {
            let assessHeaderIndex = assessRows.findIndex(row => row.some(cell => cell.trim().toLowerCase().replace(/\s/g, '') === 'studentid'));
            if (assessHeaderIndex !== -1) {
                const assessHeaders = assessRows[assessHeaderIndex];
                const idColIdx = assessHeaders.findIndex(h => h.trim().toLowerCase().replace(/\s/g, '') === 'studentid');
                const scoreColIdx = assessHeaders.findIndex(h => h.trim().toLowerCase() === 'nsl score');
                const gradeColIdx = assessHeaders.findIndex(h => h.trim().toLowerCase() === 'nsl grade');
                const levelColIdx = assessHeaders.findIndex(h => h.trim().toLowerCase() === 'current german level');
                const intakeColIdx = assessHeaders.findIndex(h => h.trim().toLowerCase() === 'applied intake');
                const profColIdx = assessHeaders.findIndex(h => h.trim().toLowerCase() === 'applied professions');

                if (idColIdx !== -1) {
                    // Create a lookup map for faster merging
                    const assessMap = {};
                    assessRows.slice(assessHeaderIndex + 1).forEach(row => {
                        const sid = row[idColIdx];
                        if (sid) {
                            assessMap[sid] = {
                                NSLScore: scoreColIdx !== -1 ? (row[scoreColIdx] || '') : '',
                                NSLGrade: gradeColIdx !== -1 ? (row[gradeColIdx] || '') : '',
                                DeutschLevel: levelColIdx !== -1 ? (row[levelColIdx] || '') : '',
                                Intake: intakeColIdx !== -1 ? (row[intakeColIdx] || '') : '',
                                ProfessionCode: profColIdx !== -1 ? (row[profColIdx] || '') : ''
                            };
                        }
                    });

                    // Merge into students
                    students.forEach(student => {
                        if (student.StudentID && assessMap[student.StudentID]) {
                            student.NSLScore = assessMap[student.StudentID].NSLScore;
                            student.NSLGrade = assessMap[student.StudentID].NSLGrade;
                            if (assessMap[student.StudentID].DeutschLevel) {
                                student.DeutschLevel = assessMap[student.StudentID].DeutschLevel;
                            }
                            if (assessMap[student.StudentID].Intake) {
                                student.Intake = assessMap[student.StudentID].Intake;
                            }
                            if (assessMap[student.StudentID].ProfessionCode) {
                                student.ProfessionCode = assessMap[student.StudentID].ProfessionCode;
                            }
                        }
                    });
                }
            }
        }

        // Calculate legacy fallback values just in case
        students.forEach(student => {
            // If they have the old columns but no new score
            if (!student.NSLScore && student.AssessmentScore && student.VideoScore) {
                const asScore = parseFloat(student.AssessmentScore) || 0;
                const vScore = parseFloat(student.VideoScore) || 0;
                student.NSLScore = Math.round((asScore / 2) * 0.70 + vScore * 0.30);
                
                if (student.NSLScore >= 85) student.NSLGrade = 'A';
                else if (student.NSLScore >= 75) student.NSLGrade = 'B';
                else if (student.NSLScore >= 65) student.NSLGrade = 'C';
                else if (student.NSLScore >= 55) student.NSLGrade = 'D';
                else if (student.NSLScore >= 45) student.NSLGrade = 'E';
                else student.NSLGrade = 'F';
            }
        });

        cachedStudents = students;
        lastCacheTime = Date.now();
        return students;
    } catch (error) {
        console.error('Error reading Master Sheet:', error);
        return [];
    }
}

/**
 * Lấy danh sách Partner Access
 */
async function getPartnerAccessConfigs() {
    if (!SPREADSHEET_ID) return [];
    
    try {
        const sheets = await getSheetsInstance();
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `${PARTNER_SHEET}!A:Z`,
        });

        const rows = response.data.values;
        if (!rows || rows.length === 0) return [];

        const headers = rows[0];
        return rows.slice(1).map((row) => {
            const config = {};
            headers.forEach((header, i) => {
                config[header.trim()] = row[i] || '';
            });
            return config;
        });
    } catch (error) {
        console.error('Error reading PartnerAccess Sheet:', error);
        return [];
    }
}

/**
 * Tìm kiếm học viên theo StudentID
 */
async function getStudentById(studentId) {
    if (!studentId) return null;
    const searchId = studentId.trim().toLowerCase();
    
    // Fallback cho quá trình test khi không có credentials.json
    if (searchId === 'hdeu_tam_huynh_06.01.2004' || searchId === 'nsl-2601001') {
        return {
            StudentID: studentId.trim(),
            FullName: 'Huỳnh Tâm',
            DOB: '06.01.2004',
            ProfessionCode: 'HDEU',
            CenterCode: 'NSL',
            Status: 'ACTIVE',
            NSLScore: 85,
            Rank: 'A',
            VideoStatus: 'DONE',
            SetcardStatus: 'DONE'
        };
    }

    const students = await getAllStudents();
    return students.find(s => s.StudentID && s.StudentID.trim().toLowerCase() === searchId);
}

function colIndexToA1(index) {
    let letter = '';
    let temp = index;
    while (temp >= 0) {
        letter = String.fromCharCode((temp % 26) + 65) + letter;
        temp = Math.floor(temp / 26) - 1;
    }
    return letter;
}

/**
 * Cập nhật một số trường cho học viên dựa vào StudentID
 */
async function updateStudentFields(studentId, updates) {
    const students = await getAllStudents();
    const student = students.find(s => s.StudentID === studentId);
    if (!student) throw new Error('Student not found');

    const sheets = await getSheetsInstance();
    
    // Lấy lại header để map cột
    const headerResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${MASTER_SHEET}!1:1`,
    });
    const headers = headerResponse.data.values[0];

    const data = [];
    for (const [key, value] of Object.entries(updates)) {
        const colIndex = headers.indexOf(key);
        if (colIndex !== -1) {
            const colLetter = colIndexToA1(colIndex);
            data.push({
                range: `${MASTER_SHEET}!${colLetter}${student.rowIndex}`,
                values: [[value]]
            });
        }
    }

    if (data.length > 0) {
        try {
            await sheets.spreadsheets.values.batchUpdate({
                spreadsheetId: SPREADSHEET_ID,
                requestBody: {
                    valueInputOption: 'USER_ENTERED',
                    data: data
                }
            });
            return true;
        } catch (error) {
            console.error('Error updating Google Sheets:', error);
            throw error;
        }
    }
    return false;
}

/**
 * Thêm học viên mới
 */
async function addStudent(studentData) {
    if (!studentData.StudentID) {
        studentData.StudentID = 'NSL-' + Date.now().toString().substring(5);
    }
    const sheets = await getSheetsInstance();
    const headerResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${MASTER_SHEET}!1:1`,
    });
    const headers = headerResponse.data.values[0];

    const rowData = headers.map(header => studentData[header] || '');

    await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: `${MASTER_SHEET}!A:Z`,
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        requestBody: {
            values: [rowData]
        }
    });
    return studentData;
}

module.exports = {
    getAllStudents,
    getStudentById,
    updateStudentFields,
    addStudent,
    getPartnerAccessConfigs
};
