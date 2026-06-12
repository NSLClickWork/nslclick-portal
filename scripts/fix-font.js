const fs = require('fs');
const files = [
    'public/css/nsl-design-system.css',
    'views/profile.ejs',
    'views/admin/dashboard.ejs',
    'views/partials/chat_widget.ejs',
    'views/setcard-template.ejs',
    'views/partner/dashboard.ejs',
    'views/login.ejs'
];
files.forEach(f => {
    if(fs.existsSync(f)) {
        let content = fs.readFileSync(f, 'utf8');
        content = content.replace(/family=Montserrat/g, 'family=Inter');
        content = content.replace(/family=Poppins/g, 'family=Inter');
        content = content.replace(/'Montserrat'/g, "'Inter'");
        content = content.replace(/'Poppins'/g, "'Inter'");
        fs.writeFileSync(f, content);
    }
});
