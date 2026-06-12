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
        console.log('Server is up. Getting login page...');
        
        http.get('http://127.0.0.1:3000/?tab=admin', res1 => {
            const cookies = res1.headers['set-cookie'].map(c => c.split(';')[0]).join('; ');
            let html = '';
            res1.on('data', c => html += c);
            res1.on('end', () => {
                const csrfMatch = html.match(/name="_csrf" value="([^"]+)"/);
                const csrf = csrfMatch ? csrfMatch[1] : '';
                console.log('Got CSRF:', csrf);
                
                const req = http.request({
                    hostname: '127.0.0.1',
                    port: 3000,
                    path: '/admin/login',
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'Cookie': cookies
                    }
                }, res2 => {
                    console.log('POST STATUS:', res2.statusCode);
                    console.log('POST HEADERS:', res2.headers);
                    let data = '';
                    res2.on('data', c => data += c);
                    res2.on('end', () => {
                        console.log('POST DATA length:', data.length);
                        server.kill();
                        process.exit();
                    });
                });
                
                req.write('password=admin123&cf-turnstile-response=dummy&_csrf=' + csrf);
                req.end();
            });
        });
    } catch (e) {
        console.error(e);
        server.kill();
    }
})();
