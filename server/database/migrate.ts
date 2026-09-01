import { db } from './db.js';

// Constructing the singleton applies every pending migration transactionally.
// Reaching this line means checksum and foreign-key verification succeeded.
console.log('Database migrations completed successfully');
db.close();
