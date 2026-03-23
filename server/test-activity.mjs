async function test() {
    // 1. Login to get a valid token
    const loginRes = await fetch('http://localhost:3001/api/auth/signin', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            email: 'test@test.com',
            password: 'password'
        })
    });
    
    if (!loginRes.ok) {
        console.error("Login failed:", await loginRes.text());
        return;
    }
    
    const { token } = await loginRes.json();
    console.log("Got token");

    // 2. Test the activity endpoint
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
            actionType: 'like',
            posterPath: '/path'
        })
    });
    
    console.log("Activity Status:", response.status);
    console.log(await response.json());
}
test();
