const axios = require('axios');
axios.get('http://localhost:3000/ping').then(r => console.log(r.data)).catch(e => console.log(e.response ? e.response.status : e.message));
