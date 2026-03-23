import jwt from 'jsonwebtoken';

async function test() {
    const token = jwt.sign(
        { id: 1, email: 'klsdfernando@gmail.com' }, 
        'movie-app-secret-key-change-in-production', 
        { expiresIn: '24h' }
    );
    
    // 2. Perform raw fetch POST request
    const response = await fetch('http://localhost:3001/api/activity/record', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            mediaId: '438631',
            mediaType: 'movie',
            title: 'Dune',
            actionType: 'like'
            // No poster path here
        })
    });
    
    console.log("Status:", response.status);
    console.log("Body:", await response.text());
}
test();
