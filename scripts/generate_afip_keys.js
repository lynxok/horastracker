const forge = require('node-forge');
const fs = require('fs');
const path = require('path');

// Datos para el CSR (Basados en tu recibo C)
const CUIT = '20326691314';
const COMMON_NAME = 'VALENTE IGNACIO';
const ORGANIZATION = 'VALENTE IGNACIO';
const COUNTRY = 'AR';

const certsDir = path.join(__dirname, '..', 'certs');
if (!fs.existsSync(certsDir)) fs.mkdirSync(certsDir);

async function generate() {
    console.log('--- GENERANDO CLAVES PARA AFIP ---');

    // 1. Generar par de claves RSA (2048 bits según AFIP)
    console.log('1. Generando clave privada RSA (Esto puede tardar unos segundos)...');
    const keys = forge.pki.rsa.generateKeyPair(2048);
    const privateKeyPem = forge.pki.privateKeyToPem(keys.privateKey);
    
    const keyPath = path.join(certsDir, 'privada.key');
    fs.writeFileSync(keyPath, privateKeyPem);
    console.log(`OK: Clave privada guardada en: ${keyPath}`);

    // 2. Generar el Pedido (CSR)
    console.log('2. Generando pedido de certificado (CSR)...');
    const csr = forge.pki.createCertificationRequest();
    csr.publicKey = keys.publicKey;
    csr.setSubject([
        { name: 'commonName', value: COMMON_NAME },
        { name: 'countryName', value: COUNTRY },
        { name: 'organizationName', value: ORGANIZATION },
        { name: 'serialNumber', value: `CUIT ${CUIT}` }
    ]);

    // Firmar con la clave privada propia
    csr.sign(keys.privateKey);

    const csrPem = forge.pki.certificationRequestToPem(csr);
    const csrPath = path.join(certsDir, 'pedido.csr');
    fs.writeFileSync(csrPath, csrPem);
    
    console.log(`OK: Pedido (CSR) guardado en: ${csrPath}`);
    console.log('\n--- PROCESO TERMINADO ---');
    console.log('Ahora subí el archivo "pedido.csr" a la web de AFIP en "Administración de Certificados Digitales".');
}

generate().catch(err => console.error(err));
