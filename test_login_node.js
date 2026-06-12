
const { spawn } = require('child_process');
const http = require('http');

const server = spawn('node', ['server.js'], { stdio: 'pipe' });

function waitForServer() {
    return new Promise(resolve => {
        const interval = setInterval(() => {
            http.get('http://127.0.0.1:3000', res => {
                clearInterval(interval);
                resolve();
            }).on('error', () => {});
        }, 500);
    });
}

(async () => {
    try {
        await waitForServer();
        console.log('Server is up. Sending POST /admin/login...');
        
        const req = http.request({
            hostname: '127.0.0.1',
            port: 3000,
            path: '/admin/login',
            method: 'POST',
            headers: {'Content-Type': 'application/x-www-form-urlencoded'}
        }, res => {
            console.log('STATUS:', res.statusCode);
            console.log('HEADERS:', res.headers);
            
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                console.log('DATA:', data);
                server.kill();
                process.exit();
            });
        });
        
        req.write('password=admin123&cf-turnstile-response=dummy');
        req.end();
    } catch (e) {
        console.error(e);
        server.kill();
    }
})();

