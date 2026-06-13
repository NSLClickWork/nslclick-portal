const express = require('express');
const router = express.Router();

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

router.get('/personalkampagne', (req, res) => {
    const lang = req.query.lang || req.cookies.lang || 'de';
    if (lang === 'de') {
        return res.render('marketing/personalkampagne_de', { lang });
    }
    res.render('marketing/personalkampagne', { lang });
});

module.exports = router;
