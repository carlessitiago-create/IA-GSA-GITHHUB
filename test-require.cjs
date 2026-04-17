const funcs = require('./functions/lib/index.js');

try {
  funcs.assertAuth({});
} catch(e) {
  console.log(e);
}
