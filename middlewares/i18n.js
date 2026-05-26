const dictionary = {
    vi: {
        professions: {
            'pflege': 'Điều dưỡng / Y tá',
            'mechaniker': 'Thợ cơ khí',
            'koch': 'Đầu bếp',
            'hotel': 'Nhà hàng Khách sạn',
            'it': 'Công nghệ thông tin'
        },
        labels: {
            search: 'Tìm kiếm',
            logout: 'Đăng xuất',
            center: 'Trung tâm',
            level: 'Trình độ',
            available: 'Sẵn sàng từ',
            view_profile: 'Xem hồ sơ',
            download_pdf: 'Tải Setcard (PDF)',
            view_video: 'Xem Video',
            date_of_birth: 'Ngày sinh',
            profession: 'Nghề'
        }
    },
    en: {
        professions: {
            'pflege': 'Nurse / Caregiver',
            'mechaniker': 'Mechanic',
            'koch': 'Chef / Cook',
            'hotel': 'Hospitality',
            'it': 'IT Specialist'
        },
        labels: {
            search: 'Search',
            logout: 'Logout',
            center: 'Center',
            level: 'Level',
            available: 'Available from',
            view_profile: 'View Profile',
            download_pdf: 'Download Setcard (PDF)',
            view_video: 'Watch Video',
            date_of_birth: 'Date of Birth',
            profession: 'Profession'
        }
    },
    de: {
        professions: {
            'pflege': 'Pflegefachkraft',
            'mechaniker': 'Mechaniker/in',
            'koch': 'Koch/Köchin',
            'hotel': 'Hotelfachmann/-frau',
            'it': 'IT-Fachkraft'
        },
        labels: {
            search: 'Suche',
            logout: 'Abmelden',
            center: 'Zentrum',
            level: 'Niveau',
            available: 'Verfügbar ab',
            view_profile: 'Profil ansehen',
            download_pdf: 'Setcard herunterladen (PDF)',
            view_video: 'Video ansehen',
            date_of_birth: 'Geburtsdatum',
            profession: 'Beruf'
        }
    }
};

function i18nMiddleware(req, res, next) {
    // Determine language from query string, session, or default to DE for partners
    let lang = req.query.lang || req.session.lang;
    
    // Default: DE if partner, VI if student
    if (!lang) {
        if (req.originalUrl.startsWith('/partner')) lang = 'de';
        else lang = 'vi';
    }

    if (!['vi', 'en', 'de'].includes(lang)) {
        lang = 'de';
    }

    req.session.lang = lang;
    res.locals.lang = lang;
    res.locals.__ = (key, type = 'labels') => {
        return dictionary[lang]?.[type]?.[key] || key;
    };

    next();
}

module.exports = i18nMiddleware;
