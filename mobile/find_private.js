const fs = require('fs');
const path = require('path');

function scanDir(dir) {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            if (file === 'react-native-reanimated') continue; // We know this one
            scanDir(fullPath);
        } else if (fullPath.endsWith('.js') || fullPath.endsWith('.ts')) {
            const content = fs.readFileSync(fullPath, 'utf8');
            // Look for this.#prop or #prop = or #prop(
            if (/(?<!['"`\/\w])this\.#[a-zA-Z_]|(?<!['"`\/\w])#[a-zA-Z_][a-zA-Z0-9_]*\s*[\(\=;]/.test(content)) {
                // exclude false positives like color codes in strings or css
                if (!content.includes('hex') && !content.includes('color')) {
                     console.log('Found private field in:', fullPath.replace(__dirname, ''));
                     const lines = content.split('\n');
                     lines.forEach((line, i) => {
                         if (/(?<!['"`\/\w])this\.#[a-zA-Z_]|(?<!['"`\/\w])#[a-zA-Z_][a-zA-Z0-9_]*\s*[\(\=;]/.test(line)) {
                             console.log(`  Line ${i+1}: ${line.trim().substring(0, 100)}`);
                         }
                     });
                }
            }
        }
    }
}

scanDir(path.join(__dirname, 'node_modules'));
