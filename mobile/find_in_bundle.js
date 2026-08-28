const fs = require('fs');

const bundle = fs.readFileSync('bundle_new.js', 'utf8');
const lines = bundle.split('\n');

for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Search for # followed by letters, not preceded by string quotes or slashes or word chars
    const match = /(?<!['"`\/\w])#[a-zA-Z_][a-zA-Z0-9_]*/.exec(line);
    if (match) {
        // Exclude common false positives like HTML entities or CSS colors if they exist
        if (!line.includes('hex') && !line.includes('color') && !line.includes('&#')) {
            console.log(`Found private field in bundle at line ${i + 1}, column ${match.index + 1}:`);
            console.log(line.substring(Math.max(0, match.index - 30), Math.min(line.length, match.index + 30)));
        }
    }
}
