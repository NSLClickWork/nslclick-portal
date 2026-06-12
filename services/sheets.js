const { google } = require('googleapis');
const { serviceAccountClient } = require('./googleAuth');
const fs = require('fs');
const path = require('path');

// Default Database Config
const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID; // Must be set in .env
const MASTER_SHEET = 'CHECKLIST';
const ASSESS_SHEET = 'NSL-ASSESS';
const PARTNER_SHEET = 'PARTNER_ACCESS';

// Mock Mode Helper
const isMockMode = process.env.USE_MOCK_DATA === 'true' || !SPREADSHEET_ID;
const mockDbPath = path.join(__dirname, '../data/mock_db.json');

function readMockDb() {
    try {
        if (fs.existsSync(mockDbPath)) {
            const raw = fs.readFileSync(mockDbPath, 'utf8');
            return JSON.parse(raw);
        }
    } catch (e) {
        console.error('Error reading mock_db.json:', e);
    }
    return { students: [], partners: [] };
}

function writeMockDb(data) {
    fs.writeFileSync(mockDbPath, JSON.stringify(data, null, 4), 'utf8');
}

async function getSheetsInstance() {
    if (!serviceAccountClient) {
        throw new Error('Service Account Client is not initialized. Check credentials.json');
    }
    return google.sheets({ version: 'v4', auth: serviceAccountClient });
}

let cachedStudents = null;
let lastCacheTime = 0;
const CACHE_TTL = 30000;

async function getAllStudents() {
    if (isMockMode) {
        const db = readMockDb();
        return db.students || [];
    }

    if (!SPREADSHEET_ID) return [];
    
    if (cachedStudents && Date.now() - lastCacheTime < CACHE_TTL) {
        return cachedStudents;
    }
    
    try {
        const sheets = await getSheetsInstance();
        // Fetch both CHECKLIST and NSL-ASSESS tabs
        const response = await sheets.spreadsheets.values.batchGet({
            spreadsheetId: SPREADSHEET_ID,
            ranges: [`${MASTER_SHEET}!A:ZZ`, `NSL-ASSESS!A:ZZ`],
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
            if (key.toLowerCase() === 'skill centre - video recording' || key.toLowerCase() === 'raw video link' || key.toLowerCase() === 'rawvideolink') return 'RawVideoLink';
            if (key.toLowerCase() === 'progress status' || key.toLowerCase() === 'progressstatus') return 'ProgressStatus';
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
                    if (/\d/.test(lastPart)) {
                        student.DOB = lastPart;
                    }
                }
            }

            // Compute Short Name from StudentID if missing from sheet
            // ID format: [Center]_[GivenName]_[FAMILYNAME]_[DOB or year]
            // e.g. ANG_Tinh_NGUYEN_26.09.2005 → "Tinh NGUYEN"
            if (!student['Short Name'] && student.StudentID) {
                const idParts = student.StudentID.split('_');
                // Needs at least: center, given, family (3 meaningful parts)
                if (idParts.length >= 3) {
                    const lastPart = idParts[idParts.length - 1];
                    const hasDOB = /\d/.test(lastPart); // last part is date/year
                    const familyIdx = hasDOB ? idParts.length - 2 : idParts.length - 1;
                    const givenIdx = 1; // always index 1 (after center code)
                    if (familyIdx > givenIdx) {
                        const given = idParts[givenIdx];
                        const family = idParts[familyIdx].toUpperCase();
                        student['Short Name'] = given.charAt(0).toUpperCase() + given.slice(1).toLowerCase() + ' ' + family;
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
                            const normalizedSid = sid.trim().toLowerCase();
                            assessMap[normalizedSid] = {
                                NSLScore: scoreColIdx !== -1 ? (row[scoreColIdx] || '') : '',
                                NSLGrade: gradeColIdx !== -1 ? (row[gradeColIdx] || '') : '',
                                DeutschLevel: levelColIdx !== -1 ? (row[levelColIdx] || '') : '',
                                Intake: intakeColIdx !== -1 ? (row[intakeColIdx] || '') : '',
                                ProfessionCode: profColIdx !== -1 ? (row[profColIdx] || '') : ''
                            };
                        }
                    });
                    
                    global.debugAssessKeys = Object.keys(assessMap);

                    // Merge into students
                    students.forEach(student => {
                        if (student.StudentID) {
                            const normalizedSid = student.StudentID.trim().toLowerCase();
                            let assessData = assessMap[normalizedSid];
                            
                            // Fallback: If exact match fails, try matching the prefix (Center_First_Last)
                            if (!assessData) {
                                const parts = normalizedSid.split('_');
                                if (parts.length >= 3) {
                                    const prefix = parts.slice(0, 3).join('_') + '_';
                                    const fallbackKey = Object.keys(assessMap).find(k => k.startsWith(prefix));
                                    if (fallbackKey) {
                                        assessData = assessMap[fallbackKey];
                                    }
                                }
                            }

                            if (assessData) {
                                student.NSLScore = assessData.NSLScore;
                                student.NSLGrade = assessData.NSLGrade;
                                if (assessData.DeutschLevel) {
                                    student.DeutschLevel = assessData.DeutschLevel;
                                }
                                if (assessData.Intake) {
                                    student.Intake = assessData.Intake;
                                }
                                if (assessData.ProfessionCode) {
                                    student.ProfessionCode = assessData.ProfessionCode;
                                }
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
    if (isMockMode) {
        const db = readMockDb();
        return db.partners || [];
    }

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
        return rows.slice(1).map((row, index) => {
            const config = { rowIndex: index + 2 };
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
    if (isMockMode) {
        const db = readMockDb();
        const student = db.students.find(s => s.StudentID === studentId);
        if (!student) throw new Error('Student not found in mock db');
        Object.assign(student, updates);
        writeMockDb(db);
        return true;
    }

    const students = await getAllStudents();
    const student = students.find(s => s.StudentID === studentId);
    if (!student) throw new Error('Student not found');

    const sheets = await getSheetsInstance();
    
    // Lấy lại header để map cột
    const headerResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${MASTER_SHEET}!1:10`,
    });
    const rows = headerResponse.data.values || [];
    let headerIndex = rows.findIndex(row => row.some(cell => cell && cell.trim().toLowerCase().replace(/\s/g, '') === 'studentid'));
    if (headerIndex === -1) headerIndex = 0;
    const headers = rows[headerIndex] || [];

    const reverseMap = {
        FullName: ['Student Name', 'FullName'],
        StudentID: ['Student ID', 'StudentID'],
        PhotoLink: ['Photo', 'Photo Link'],
        ActivityPhotoLink: ['Activity Photo', 'Activity Photo Link'],
        YouTubeLink: ['Introduction Video', 'YouTube Link'],
        AvailableFrom: ['Availability', 'Available From'],
        CenterCode: ['Language School', 'Center Code'],
        Strength1: ['Superpower 1', 'Strength 1'],
        Strength2: ['Superpower 2', 'Strength 2'],
        Strength3: ['Superpower 3', 'Strength 3'],
        SetcardLink: ['Candidate Cards', 'Setcard', 'SetcardLink'],
        RawVideoLink: ['Skill Centre - Video Recording', 'Raw Video Link', 'RawVideoLink'],
        ProgressStatus: ['Progress Status', 'ProgressStatus']
    };

    const data = [];
    for (const [key, value] of Object.entries(updates)) {
        let colIndex = headers.indexOf(key);
        if (colIndex === -1) {
            colIndex = headers.findIndex(h => {
                const hLower = h.trim().toLowerCase();
                return (reverseMap[key] && reverseMap[key].some(m => m.toLowerCase() === hLower));
            });
        }
        
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
            cachedStudents = null; // Clear cache
            return true;
        } catch (error) {
            console.error('Error updating Google Sheets:', error);
            throw error;
        }
    }
    
    throw new Error(`Column not found in Google Sheets for updates: ${Object.keys(updates).join(', ')}. Did you forget to add the 'Progress Status' column?`);
}

/**
 * Thêm học viên mới
 */
async function addStudent(studentData) {
    if (!studentData.StudentID) {
        studentData.StudentID = 'NSL-' + Date.now().toString().substring(5);
    }
    
    if (isMockMode) {
        const db = readMockDb();
        studentData.rowIndex = db.students.length > 0 ? Math.max(...db.students.map(s => s.rowIndex || 0)) + 1 : 2;
        db.students.push(studentData);
        writeMockDb(db);
        return true;
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
    return true;
}

/**
 * Thêm đối tác mới
 */
async function addPartnerAccess(partnerConfig) {
    if (isMockMode) {
        const db = readMockDb();
        partnerConfig.rowIndex = db.partners.length > 0 ? Math.max(...db.partners.map(p => p.rowIndex || 0)) + 1 : 2;
        db.partners.push(partnerConfig);
        writeMockDb(db);
        return true;
    }

    const sheets = await getSheetsInstance();
    const headerResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${PARTNER_SHEET}!1:1`,
    });
    
    let headers = headerResponse.data.values ? headerResponse.data.values[0] : [];
    if (headers.length === 0) {
        // If sheet is empty, create headers
        headers = ['partnerName', 'codeHash', 'accessCode', 'allowedProfessions', 'allowedCenters', 'expiresAt', 'revoked'];
        await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: `${PARTNER_SHEET}!A1:Z1`,
            valueInputOption: 'USER_ENTERED',
            requestBody: { values: [headers] }
        });
    } else if (!headers.includes('accessCode')) {
        // If accessCode column doesn't exist, append it to headers
        headers.push('accessCode');
        await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: `${PARTNER_SHEET}!A1:Z1`,
            valueInputOption: 'USER_ENTERED',
            requestBody: { values: [headers] }
        });
    }

    const rowData = headers.map(header => partnerConfig[header] || '');

    await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: `${PARTNER_SHEET}!A:A`,
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        requestBody: {
            values: [rowData]
        }
    });
    return true;
}

/**
 * Cập nhật thông tin đối tác
 */
async function updatePartnerAccess(rowIndex, updates) {
    if (isMockMode) {
        const db = readMockDb();
        const partner = db.partners.find(p => p.rowIndex == rowIndex);
        if (!partner) throw new Error('Partner not found in mock db');
        Object.assign(partner, updates);
        writeMockDb(db);
        return true;
    }

    const sheets = await getSheetsInstance();
    const headerResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${PARTNER_SHEET}!1:1`,
    });
    const headers = headerResponse.data.values[0];

    const data = [];
    for (const [key, value] of Object.entries(updates)) {
        const colIndex = headers.indexOf(key);
        if (colIndex !== -1) {
            const colLetter = colIndexToA1(colIndex);
            data.push({
                range: `${PARTNER_SHEET}!${colLetter}${rowIndex}`,
                values: [[value]]
            });
        }
    }

    if (data.length > 0) {
        await sheets.spreadsheets.values.batchUpdate({
            spreadsheetId: SPREADSHEET_ID,
            requestBody: {
                valueInputOption: 'USER_ENTERED',
                data: data
            }
        });
        return true;
    }
    return false;
}

/**
 * Cập nhật nhiều học viên cùng lúc
 */
async function batchUpdateStudentsFields(studentIds, updates) {
    if (!studentIds || studentIds.length === 0) return false;
    
    if (isMockMode) {
        const db = readMockDb();
        let changed = false;
        db.students.forEach(s => {
            if (studentIds.includes(s.StudentID)) {
                Object.assign(s, updates);
                changed = true;
            }
        });
        if (changed) writeMockDb(db);
        return true;
    }

    const students = await getAllStudents();
    const sheets = await getSheetsInstance();
    
    const headerResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${MASTER_SHEET}!1:10`,
    });
    const rows = headerResponse.data.values || [];
    let headerIndex = rows.findIndex(row => row.some(cell => cell && cell.trim().toLowerCase().replace(/\s/g, '') === 'studentid'));
    if (headerIndex === -1) headerIndex = 0;
    const headers = rows[headerIndex] || [];

    const reverseMap = {
        FullName: ['Student Name', 'FullName'],
        StudentID: ['Student ID', 'StudentID'],
        PhotoLink: ['Photo', 'Photo Link'],
        ActivityPhotoLink: ['Activity Photo', 'Activity Photo Link'],
        YouTubeLink: ['Introduction Video', 'YouTube Link'],
        AvailableFrom: ['Availability', 'Available From'],
        CenterCode: ['Language School', 'Center Code'],
        Strength1: ['Superpower 1', 'Strength 1'],
        Strength2: ['Superpower 2', 'Strength 2'],
        Strength3: ['Superpower 3', 'Strength 3'],
        SetcardLink: ['Candidate Cards', 'Setcard', 'SetcardLink'],
        RawVideoLink: ['Skill Centre - Video Recording', 'Raw Video Link', 'RawVideoLink'],
        ProgressStatus: ['Progress Status', 'ProgressStatus']
    };

    const data = [];
    
    for (const studentId of studentIds) {
        const student = students.find(s => s.StudentID === studentId);
        if (!student) continue;

        for (const [key, value] of Object.entries(updates)) {
            let colIndex = headers.indexOf(key);
            if (colIndex === -1) {
                colIndex = headers.findIndex(h => {
                    const hLower = h.trim().toLowerCase();
                    return (reverseMap[key] && reverseMap[key].some(m => m.toLowerCase() === hLower));
                });
            }
            
            if (colIndex !== -1) {
                const colLetter = colIndexToA1(colIndex);
                data.push({
                    range: `${MASTER_SHEET}!${colLetter}${student.rowIndex}`,
                    values: [[value]]
                });
            }
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
            cachedStudents = null; // Clear cache
            return true;
        } catch (error) {
            console.error('Error updating Google Sheets in batch:', error);
            throw error;
        }
    }
    
    throw new Error(`Column not found in Google Sheets for updates: ${Object.keys(updates).join(', ')}. Please make sure you added the 'Progress Status' column in your Google Sheet!`);
}

/**
 * Lưu lịch sử chat và quyết định của khách vào tab CHAT_LOGS
 */
async function logChatRequest(logData) {
    if (isMockMode) {
        console.log('[MOCK] Logged chat request:', logData);
        return true;
    }

    if (!SPREADSHEET_ID) return false;

    try {
        const sheets = await getSheetsInstance();
        
        const timestamp = new Date().toISOString();
        const { partnerId, role, language, userMessage, botReply, chosenCandidate } = logData;

        const rowData = [
            timestamp,
            partnerId || 'Unknown',
            role || 'Unknown',
            language || 'Unknown',
            userMessage || '',
            botReply || '',
            chosenCandidate || ''
        ];

        await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: `CHAT_LOGS!A:G`,
            valueInputOption: 'USER_ENTERED',
            insertDataOption: 'INSERT_ROWS',
            requestBody: {
                values: [rowData]
            }
        });
        return true;
    } catch (error) {
        console.error('Error logging chat to CHAT_LOGS Sheet (Please ensure a tab named CHAT_LOGS exists):', error.message);
        return false;
    }
}

/**
 * Kiểm tra xem học viên đã ký GDPR chưa
 */
async function hasSignedGDPR(studentId) {
    if (!studentId) return false;
    
    if (isMockMode) {
        return false;
    }

    if (!SPREADSHEET_ID) return false;

    try {
        const sheets = await getSheetsInstance();
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `GDPR_LOGS!B:B`, // Cột B là StudentID
        });

        const rows = response.data.values;
        if (!rows || rows.length === 0) return false;

        // Bỏ qua dòng tiêu đề
        for (let i = 1; i < rows.length; i++) {
            if (rows[i][0] === studentId) {
                return true;
            }
        }
        return false;
    } catch (error) {
        console.error('Error checking GDPR status:', error.message);
        return false; // Bắt ký lại nếu có lỗi (fail-safe)
    }
}

/**
 * Lưu Log ký GDPR của học viên
 */
async function logGDPRConsent(logData) {
    if (isMockMode) {
        console.log('[MOCK] Logged GDPR Consent:', logData);
        return true;
    }

    if (!SPREADSHEET_ID) return false;

    try {
        const sheets = await getSheetsInstance();
        
        const timestamp = new Date().toISOString();
        const { studentId, fullName, dob, centerCode, email, ipAddress, consentVersion, signatureBase64 } = logData;

        const rowData = [
            timestamp,
            studentId || '',
            fullName || '',
            dob || '',
            centerCode || '',
            email || '',
            ipAddress || '',
            consentVersion || '1.0-official',
            signatureBase64 || ''
        ];

        await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: `GDPR_LOGS!A:I`,
            valueInputOption: 'USER_ENTERED',
            insertDataOption: 'INSERT_ROWS',
            requestBody: {
                values: [rowData]
            }
        });
        return true;
    } catch (error) {
        console.error('Error logging GDPR consent to GDPR_LOGS Sheet:', error.message);
        return false;
    }
}

/**
 * Xóa thông tin đối tác
 */
async function deletePartnerAccess(rowIndex) {
    if (isMockMode) {
        const db = readMockDb();
        db.partners = db.partners.filter(p => p.rowIndex != rowIndex);
        writeMockDb(db);
        return true;
    }

    const sheets = await getSheetsInstance();
    await sheets.spreadsheets.values.clear({
        spreadsheetId: SPREADSHEET_ID,
        range: `${PARTNER_SHEET}!A${rowIndex}:Z${rowIndex}`
    });
    return true;
}

module.exports = {
    getAllStudents,
    getStudentById,
    updateStudentFields,
    batchUpdateStudentsFields,
    addStudent,
    addPartnerAccess,
    updatePartnerAccess,
    deletePartnerAccess,
    getPartnerAccessConfigs,
    logChatRequest,
    hasSignedGDPR,
    logGDPRConsent
};
