const { imagesToIco } = require('png-to-ico');
const fs = require('fs');
const path = require('path');

const input = path.join(__dirname, '../public/Icono mas lindo.png');
const output = path.join(__dirname, '../public/icons/icon.ico');

imagesToIco([input])
  .then(buf => {
    fs.writeFileSync(output, buf);
    console.log('✅ icon.ico generado con el nuevo logo LYNX');
  })
  .catch(err => {
    console.error('❌ Error:', err.message);
  });
