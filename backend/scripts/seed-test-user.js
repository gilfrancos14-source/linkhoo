const { createClerkClient } = require('@clerk/backend');

const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

async function createTestUser() {
  try {
    const user = await clerk.users.createUser({
      emailAddress: ['testuser+clerk_test@example.com'],
      password: 'test1234',
      firstName: 'Test',
      lastName: 'User',
    });
    console.log('Test user created:', user.id);
    console.log('Email:', user.emailAddresses[0].emailAddress);
  } catch (err) {
    if (err.status === 422) {
      console.log('Test user already exists');
    } else {
      console.error('Error creating test user:', err);
    }
  }
}

createTestUser();