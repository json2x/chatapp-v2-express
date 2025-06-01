// Simple script to test the JWT authentication with the secured endpoints
const fetch = require('node-fetch');
require('dotenv').config();

// Replace this with an actual token from Supabase
// You can get this by logging in through the Supabase client
const SUPABASE_JWT_TOKEN = 'YOUR_SUPABASE_JWT_TOKEN';

// Base URL for the API
const API_BASE_URL = 'http://localhost:8000/api';

// Test function to make authenticated requests
async function testAuthenticatedEndpoint(endpoint) {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${SUPABASE_JWT_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();
    console.log(`Response from ${endpoint}:`, data);
    return { success: response.ok, status: response.status, data };
  } catch (error) {
    console.error(`Error testing ${endpoint}:`, error);
    return { success: false, error: error.message };
  }
}

// Test function to make unauthenticated requests (should fail)
async function testUnauthenticatedEndpoint(endpoint) {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();
    console.log(`Unauthenticated response from ${endpoint}:`, data);
    return { success: response.ok, status: response.status, data };
  } catch (error) {
    console.error(`Error testing ${endpoint} without auth:`, error);
    return { success: false, error: error.message };
  }
}

// Run the tests
async function runTests() {
  console.log('Testing authenticated endpoints...');
  
  // Test with no authentication (should fail)
  console.log('\n1. Testing without authentication (should fail):');
  await testUnauthenticatedEndpoint('/models');
  
  // Test with authentication
  console.log('\n2. Testing with authentication:');
  console.log('NOTE: Replace YOUR_SUPABASE_JWT_TOKEN with a valid token before running this test');
  
  if (SUPABASE_JWT_TOKEN === 'YOUR_SUPABASE_JWT_TOKEN') {
    console.log('⚠️  Please replace the placeholder token with a valid Supabase JWT token');
  } else {
    await testAuthenticatedEndpoint('/models');
  }
}

runTests();

// Instructions for getting a Supabase JWT token:
// 1. Use the Supabase JavaScript client to sign in
// 2. After signing in, you can get the JWT token from the session
// 
// Example:
// const { data, error } = await supabase.auth.signInWithPassword({
//   email: 'user@example.com',
//   password: 'password',
// });
// 
// const token = data.session.access_token;
