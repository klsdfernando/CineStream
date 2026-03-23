import fetch from 'node-fetch';
import jwt from 'jsonwebtoken';

async function test() {
    const token = jwt.sign({ id: 1, email: 'test@test.com' }, 'super-secret-jwt-key-change-in-production', { expiresIn: '24h' });

    const response = await fetch('http://localhost:3001/api/activity/record', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            mediaId: '12345',
            mediaType: 'movie',
            title: 'Test Movie',
            actionType: 'like'
        })
    });
    
    console.log(response.status);
    console.log(await response.json());
}
test();
