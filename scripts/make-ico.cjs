const { imagesToIco } = require('png-to-ico');
const fs = require('fs');
const path = require('path');

const inputPath = path.join(__dirname, '../public/app_icon.png');
const outputPath = path.join(__dirname, '../public/icons/icon.ico');

imagesToIco([inputPath])
  .then(buf => {
    fs.writeFileSync(outputPath, buf);
    console.log('✅ icon.ico generado correctamente desde app_icon.png');
  })
  .catch(err => {
    console.error('❌ Error:', err);
  });
