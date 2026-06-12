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
        console.log('Server is up. Simulating GET /admin/login to get CSRF...');
        
        http.get('http://127.0.0.1:3000/admin/login', res1 => {
            console.log('Redirect URL:', res1.headers.location);
            const cookies = res1.headers['set-cookie'] ? res1.headers['set-cookie'].map(c => c.split(';')[0]).join('; ') : '';
            console.log('Cookies from GET:', cookies);
            
            http.get('http://127.0.0.1:3000/?tab=admin', { headers: { 'Cookie': cookies } }, res2 => {
                let html = '';
                res2.on('data', c => html += c);
                res2.on('end', () => {
                    const match = html.match(/name="_csrf" value="([^"]+)"/);
                    const csrf = match ? match[1] : 'dummy';
                    console.log('CSRF Token:', csrf);
                    
                    console.log('Sending POST /admin/login...');
                    const req = http.request({
                        hostname: '127.0.0.1',
                        port: 3000,
                        path: '/admin/login',
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/x-www-form-urlencoded',
                            'Cookie': cookies
                        }
                    }, res3 => {
                        console.log('POST /admin/login STATUS:', res3.statusCode);
                        console.log('POST /admin/login HEADERS:', res3.headers);
                        
                        const newCookies = res3.headers['set-cookie'] ? res3.headers['set-cookie'].map(c => c.split(';')[0]).join('; ') : cookies;
                        console.log('Cookies after POST:', newCookies);
                        
                        if (res3.statusCode === 302) {
                            console.log('Redirecting to:', res3.headers.location);
                            http.get('http://127.0.0.1:3000' + res3.headers.location, { headers: { 'Cookie': newCookies } }, res4 => {
                                console.log('GET ' + res3.headers.location + ' STATUS:', res4.statusCode);
                                console.log('GET ' + res3.headers.location + ' LOCATION:', res4.headers.location);
                                server.kill();
                                process.exit();
                            });
                        } else {
                            let data = '';
                            res3.on('data', c => data += c);
                            res3.on('end', () => {
                                console.log('Response body:', data.substring(0, 200));
                                server.kill();
                                process.exit();
                            });
                        }
                    });
                    
                    req.write('password=admin123&cf-turnstile-response=dummy&_csrf=' + csrf);
                    req.end();
                });
            });
        });
    } catch (e) {
        console.error(e);
        server.kill();
    }
})();
