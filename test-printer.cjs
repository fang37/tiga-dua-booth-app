const printer = require('node-printer');

try {
  console.log('Attempting to find printers using printer.list()...');
  const printers = printer.list(); // <-- This is the correct function
  console.log('--- Found Printers ---');
  console.log(printers);
  console.log('------------------------');
} catch (error) {
  console.error('ERROR running node-printer:', error);
}
// TODO: Find another library for printing
// Try https://github.com/Susheer/electron-printer