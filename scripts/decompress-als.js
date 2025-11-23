const fs = require('fs');
const zlib = require('zlib');
const path = require('path');

// Get the input file from command line args
const inputFile = process.argv[2];

if (!inputFile) {
  console.log('Usage: node decompress-als.js <path-to-als-file>');
  process.exit(1);
}

const outputFile = inputFile.replace('.als', '.xml');

console.log(`Decompressing: ${inputFile}`);
console.log(`Output: ${outputFile}`);

const input = fs.createReadStream(inputFile);
const output = fs.createWriteStream(outputFile);
const unzip = zlib.createUnzip();

input.pipe(unzip).pipe(output);

output.on('finish', () => {
  console.log('Done! XML file created.');
});

output.on('error', (err) => {
  console.error('Error:', err);
});

input.on('error', (err) => {
  console.error('Error reading file:', err);
});
