const sheets = require('./services/sheets');
(async () => {
    try {
        const data = await sheets.getAllStudents();
        data.forEach(s => {
            if (s.FullName && s.PhotoLink) {
                console.log(s.FullName, '=>', s.PhotoLink);
            }
        });
    } catch (e) { console.error(e); }
})();
