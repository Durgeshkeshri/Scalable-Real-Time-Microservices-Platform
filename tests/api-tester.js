const axios = require("axios");
const { performance } = require("perf_hooks");

// Settings
const BASE_URL = process.env.API_BASE_URL || "http://localhost";
const CONCURRENT_USERS = 5;
const TOTAL_REQUESTS = 20;

// Endpoints to test
const endpoints = [
  { method: "get", url: "/health" },
  { method: "post", url: "/api/tasks", data: {
    type: "email",
    data: { recipient: "test@example.com", subject: "API Test" },
    priority: 5, userId: "tester"
  }},
  { method: "get", url: "/api/tasks" },
  { method: "post", url: "/api/users", data: {
    username: "tester_" + Math.random().toString(36).substring(7),
    email: "tester_" + Math.random().toString(36).substring(7) + "@test.com",
    name: "Tester User"
  }},
  { method: "get", url: "/api/users?page=1&limit=10" },
];

const testMatrix = [];
let successCount = 0;
let failCount = 0;

// Utility to print results
function prettyPrintMatrix(matrix) {
  console.log("\nAPI Test Matrix:");
  console.log("Endpoint\tMethod\tStatus\tTime(ms)\tSuccess");
  matrix.forEach(row => {
    const s = row.success ? "✅" : "❌";
    console.log(`${row.url}\t${row.method.toUpperCase()}\t${row.status || "--"}\t${row.time_ms}\t${s}`);
  });
}

// Retry logic for endpoints
async function testEndpoint(ep, i, retries = 3, delay = 700) {
  const url = ep.url.startsWith("http") ? ep.url : BASE_URL + ep.url;
  let start = performance.now();
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      let res = await axios({
        method: ep.method,
        url,
        data: ep.data,
        validateStatus: () => true
      });
      let time_ms = Math.round(performance.now() - start);
      let success = res.status >= 200 && res.status < 400;
      if (success) successCount++;
      else failCount++;
      testMatrix.push({
        url: ep.url,
        method: ep.method,
        status: res.status,
        time_ms,
        success
      });
      if (success || res.status !== 503) return res.data;
      if (attempt < retries) {
        console.log(`🔁 Retrying ${ep.url} after 503 (attempt ${attempt + 1})...`);
        await new Promise(r => setTimeout(r, delay));
      }
    } catch (e) {
      if (attempt < retries) await new Promise(r => setTimeout(r, delay));
      else {
        let time_ms = Math.round(performance.now() - start);
        failCount++;
        testMatrix.push({
          url: ep.url,
          method: ep.method,
          status: (e.response && e.response.status) || "--",
          time_ms,
          success: false
        });
        return null;
      }
    }
  }
}

// Main test runner
async function runTests() {
  console.log("⏳ Waiting 15 seconds for all Docker services to initialize...");
  await new Promise(r => setTimeout(r, 15000));
  let requests = [];
  for (let u = 0; u < CONCURRENT_USERS; u++) {
    for (let r = 0; r < TOTAL_REQUESTS / CONCURRENT_USERS; r++) {
      for (let i = 0; i < endpoints.length; i++) {
        requests.push(testEndpoint(endpoints[i], i, 3, 700));
      }
    }
  }
  await Promise.all(requests);
  prettyPrintMatrix(testMatrix);
  // Stats
  const avgTime = (testMatrix.reduce((a, e) => a + e.time_ms, 0) / testMatrix.length).toFixed(2);
  console.log(`\nStats:\n- Total requests: ${testMatrix.length}\n- Success: ${successCount}\n- Failed: ${failCount}\n- Success Rate: ${(successCount / testMatrix.length * 100).toFixed(2)}%\n- Avg Time: ${avgTime} ms`);
}

// Run
runTests();
