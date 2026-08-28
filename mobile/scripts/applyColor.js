const fs = require('fs');
const path = require('path');

const files = [
  "c:\\Users\\NADIL\\OneDrive\\Desktop\\sree Trust\\mobile\\src\\screens\\staff\\AttendanceScreen.js",
  "c:\\Users\\NADIL\\OneDrive\\Desktop\\sree Trust\\mobile\\src\\screens\\staff\\UploadEventScreen.js",
  "c:\\Users\\NADIL\\OneDrive\\Desktop\\sree Trust\\mobile\\src\\screens\\staff\\StaffReportsScreen.js"
];

for (const file of files) {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    
    // Replace Colors.primary with '#1A74EE'
    content = content.replace(/Colors\.primary/g, "'#1A74EE'");
    
    fs.writeFileSync(file, content, 'utf8');
    console.log(`Updated ${path.basename(file)}`);
  }
}
