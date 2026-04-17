const axios = require('axios');

async function testVendaSegura() {
  try {
    const res = await axios.get('http://localhost:3000/');
    console.log("Success:", res.data.substring(0, 100)); // Just print the start
  } catch (err) {
    if (err.response) {
      console.log("Error status:", err.response.status);
    } else {
      console.log("Network error:", err.message);
    }
  }
}

testVendaSegura();
