async function run() {
    try {
        const res1 = await fetch('http://127.0.0.1:3000/?tab=admin');
        const cookies = res1.headers.get('set-cookie');
        const html = await res1.text();
        const csrfMatch = html.match(/name="_csrf"[\s\S]*?value="([^"]+)"/);
        const csrf = csrfMatch ? csrfMatch[1] : '';
        console.log('CSRF:', csrf);
        console.log('Cookies:', cookies);
        
        let cookieHeader = '';
        if (cookies) {
            cookieHeader = cookies.split(',').map(c => c.split(';')[0].trim()).join('; ');
        }
        
        const params = new URLSearchParams();
        params.append('password', 'admin123');
        params.append('_csrf', csrf);
        params.append('cf-turnstile-response', 'dummy');
        
        const res2 = await fetch('http://127.0.0.1:3000/admin/login', {
            method: 'POST',
            headers: {
                'Cookie': cookieHeader,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: params,
            redirect: 'manual'
        });
        
        console.log('POST Status:', res2.status);
        console.log('POST Location:', res2.headers.get('location'));
        const postCookies = res2.headers.get('set-cookie');
        console.log('POST Cookies:', postCookies);
        
        if (res2.status === 302) {
            let nextCookieHeader = cookieHeader;
            if (postCookies) {
                // merge cookies
                nextCookieHeader = postCookies.split(',').map(c => c.split(';')[0].trim()).join('; ');
            }
            const res3 = await fetch('http://127.0.0.1:3000' + res2.headers.get('location'), {
                headers: { 'Cookie': nextCookieHeader },
                redirect: 'manual'
            });
            console.log('GET', res2.headers.get('location'), 'Status:', res3.status);
            console.log('GET Location:', res3.headers.get('location'));
            console.log('GET text length:', (await res3.text()).length);
        } else {
            console.log('POST body:', (await res2.text()).substring(0, 200));
        }
    } catch(e) {
        console.error(e);
    }
}
run();
