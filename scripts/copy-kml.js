const fs = require("fs");
const path = require("path");

const srcDir = path.join(__dirname, "..", "src", "kml");
const destDir = path.join(__dirname, "..", "public", "kml");

if (!fs.existsSync(srcDir)) {
  console.log("src/kml not found, skipping copy.");
  process.exit(0);
}

fs.mkdirSync(destDir, { recursive: true });
fs.cpSync(srcDir, destDir, { recursive: true });
console.log("Copied src/kml to public/kml");
