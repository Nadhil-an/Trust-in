const fs = require('fs');
const path = require('path');

const files = [
  "c:\\Users\\NADIL\\OneDrive\\Desktop\\sree Trust\\mobile\\src\\screens\\staff\\CollectDonationScreen.js",
  "c:\\Users\\NADIL\\OneDrive\\Desktop\\sree Trust\\mobile\\src\\screens\\staff\\AddMemberScreen.js",
  "c:\\Users\\NADIL\\OneDrive\\Desktop\\sree Trust\\mobile\\src\\screens\\member\\MembershipPaymentScreen.js",
  "c:\\Users\\NADIL\\OneDrive\\Desktop\\sree Trust\\mobile\\src\\screens\\geo\\GEOReportScreen.js",
  "c:\\Users\\NADIL\\OneDrive\\Desktop\\sree Trust\\mobile\\src\\screens\\fao\\FAOReportScreen.js",
  "c:\\Users\\NADIL\\OneDrive\\Desktop\\sree Trust\\mobile\\src\\screens\\auth\\SignupScreen.js",
  "c:\\Users\\NADIL\\OneDrive\\Desktop\\sree Trust\\mobile\\src\\screens\\auth\\LoginScreen.js",
  "c:\\Users\\NADIL\\OneDrive\\Desktop\\sree Trust\\mobile\\src\\screens\\assessment\\NewAssessmentScreen.js",
  "c:\\Users\\NADIL\\OneDrive\\Desktop\\sree Trust\\mobile\\src\\screens\\aco\\ACOCalculationScreen.js"
];

for (const file of files) {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    
    // Add import if not present
    if (!content.includes('KeyboardAwareScrollView')) {
      // Find the react-native import and add KeyboardAwareScrollView import after it
      content = content.replace(
        /import\s+{[^}]*}\s+from\s+['"]react-native['"];/,
        "$& \nimport { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';"
      );
    }

    // Replace ScrollView with KeyboardAwareScrollView
    content = content.replace(/<ScrollView/g, '<KeyboardAwareScrollView enableOnAndroid={true} extraScrollHeight={20}');
    content = content.replace(/<\/ScrollView>/g, '</KeyboardAwareScrollView>');

    fs.writeFileSync(file, content, 'utf8');
    console.log(`Updated ${path.basename(file)}`);
  }
}
