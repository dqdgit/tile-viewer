/**
 * Required modules
 */
const fs = require('fs');

class SvgFile {
  constructor(path) {
    this.path = path;

    try {
      this.data = fs.readFileSync(this.path, 'utf8');
    } catch (err) {
      console.log("ERROR: " + err);
    }
  }

  reload() {
    try {
      this.data = fs.readFileSync(this.path, 'utf8');
    } catch (err) {
      console.log("ERROR: " + err);
    }    
  }
};

module.exports = SvgFile;