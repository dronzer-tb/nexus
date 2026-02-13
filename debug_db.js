const database = require('./src/utils/database');
const logger = require('./src/utils/logger');

// Initialize DB (path will be loaded from config or default)
// Ensure config is loaded
require('./src/utils/config').load();
database.init();

console.log('--- USERS ---');
const users = database.getAllUsers();
console.log(JSON.stringify(users, null, 2));

console.log('\n--- NODES ---');
const nodes = database.getAllNodes();
console.log(JSON.stringify(nodes, null, 2));

console.log('\n--- SETTINGS ---');
const settings = database.db.prepare('SELECT * FROM settings').all();
console.log(JSON.stringify(settings, null, 2));

console.log('\n--- FULL USER DUMP (with secrets) ---');
// Only for debugging!
const fullUsers = database.db.prepare('SELECT * FROM users').all();
console.log(JSON.stringify(fullUsers, null, 2));
