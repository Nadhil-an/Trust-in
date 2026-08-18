const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const express = require('express');
const qrcodeTerminal = require('qrcode-terminal');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

const PORT = process.env.PORT || 3001;
let sock = null;
let currentQR = null;
let isConnected = false;

async function connectToWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState(path.join(__dirname, 'auth_info_baileys'));

  sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    browser: ['Sree Lakshmi Trust Gateway', 'Chrome', '1.0.0'],
    syncFullHistory: false,
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      currentQR = qr;
      console.log('\n======================================================');
      console.log('📱 SCAN THIS QR CODE WITH TRUST WHATSAPP PHONE:');
      console.log('======================================================\n');
      qrcodeTerminal.generate(qr, { small: true });
      console.log(`\nOr view QR code in browser at: http://localhost:${PORT}/qr\n`);
    }

    if (connection === 'close') {
      const shouldReconnect = (lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut);
      console.log('❌ Connection closed due to ', lastDisconnect?.error, ', reconnecting: ', shouldReconnect);
      isConnected = false;
      if (shouldReconnect) {
        connectToWhatsApp();
      }
    } else if (connection === 'open') {
      console.log('\n✅ WHATSAPP CONNECTED SUCCESSFULLY TO TRUST PHONE NUMBER!\n');
      isConnected = true;
      currentQR = null;
    }
  });
}

// Endpoint to view QR code in browser if needed
app.get('/qr', (req, res) => {
  if (isConnected) {
    return res.send('<h2>✅ WhatsApp is connected to your Trust phone!</h2>');
  }
  if (!currentQR) {
    return res.send('<h2>⌛ Generating QR Code... Please refresh in a few seconds.</h2>');
  }
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(currentQR)}`;
  res.send(`
    <div style="text-align: center; font-family: sans-serif; padding: 40px;">
      <h2>📱 Scan QR Code with Trust's WhatsApp Phone</h2>
      <p>Open WhatsApp on Trust Phone -> Linked Devices -> Link a Device</p>
      <img src="${qrImageUrl}" alt="WhatsApp QR Code" style="border: 4px solid #10B981; border-radius: 12px; padding: 12px;" />
    </div>
  `);
});

// Status check endpoint
app.get('/status', (req, res) => {
  res.json({ connected: isConnected });
});

const fs = require('fs');

function getMediaPayload(mediaUrlOrPath) {
  if (!mediaUrlOrPath) return null;
  try {
    if (mediaUrlOrPath.includes('/media/')) {
      let relPath = mediaUrlOrPath.split('/media/')[1];
      relPath = relPath.replace('membership_receipts/membership_receipts/', 'membership_receipts/');
      const localPath = path.join(__dirname, '..', 'media', relPath);
      if (fs.existsSync(localPath)) {
        console.log(`📁 Resolved local media file directly: ${localPath}`);
        return fs.readFileSync(localPath);
      }
      console.warn(`⚠️ Local file path does not exist on disk: ${localPath}`);
    }
  } catch (err) {
    console.error('Error resolving local media file:', err);
  }
  return { url: mediaUrlOrPath };
}

// Send message API endpoint
app.post('/send-message', async (req, res) => {
  try {
    if (!isConnected) {
      return res.status(503).json({ success: false, error: 'WhatsApp gateway is not connected. Scan QR code first.' });
    }

    const { to, body, document_url, image_url, file_name, mimetype } = req.body;
    if (!to) {
      return res.status(400).json({ success: false, error: 'Missing "to" parameter' });
    }

    // Format phone number to JID (e.g. 919876543210@s.whatsapp.net)
    let cleanPhone = to.toString().replace(/\D/g, '');
    if (cleanPhone.length === 10) cleanPhone = '91' + cleanPhone;
    const jid = `${cleanPhone}@s.whatsapp.net`;

    if (image_url) {
      console.log(`🖼️ Dispatching WhatsApp Image card to ${cleanPhone}...`);
      const mediaPayload = getMediaPayload(image_url);
      const imgMsg = {
        caption: body || ''
      };
      if (Buffer.isBuffer(mediaPayload)) {
        imgMsg.image = mediaPayload;
      } else {
        imgMsg.image = { url: image_url };
      }
      await sock.sendMessage(jid, imgMsg);
      console.log(`✅ WhatsApp Image card dispatched successfully to ${cleanPhone}`);
      return res.json({ success: true, message: 'WhatsApp Image card dispatched successfully' });
    }

    if (document_url) {
      console.log(`📄 Dispatching PDF receipt document to ${cleanPhone}...`);
      const mediaPayload = getMediaPayload(document_url);
      const docMsg = {
        fileName: file_name || 'Membership_Receipt.pdf',
        mimetype: mimetype || 'application/pdf',
        caption: body || ''
      };
      if (Buffer.isBuffer(mediaPayload)) {
        docMsg.document = mediaPayload;
      } else {
        docMsg.document = { url: document_url };
      }
      await sock.sendMessage(jid, docMsg);
      console.log(`✅ PDF Document attachment dispatched successfully to ${cleanPhone}`);
      return res.json({ success: true, message: 'PDF document attachment dispatched successfully' });
    }

    await sock.sendMessage(jid, { text: body || '' });
    console.log(`✉️ Receipt message sent to ${cleanPhone}`);
    return res.json({ success: true, message: 'Dispatched successfully' });
  } catch (err) {
    console.error('Failed to send message:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Start Express server and connect WhatsApp
app.listen(PORT, () => {
  console.log(`\n🚀 100% Free WhatsApp Gateway running on http://localhost:${PORT}`);
  connectToWhatsApp();
});
