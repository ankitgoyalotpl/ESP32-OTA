const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const mqtt = require('mqtt'); // 👈 MQTT package

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.static('public'));

// 🚀 MQTT SETUP
const mqttClient = mqtt.connect('mqtt://otplai.com:1883', {
    username: 'oxmo',
    password: '123456789'
});

mqttClient.on('connect', () => {
    console.log('✅ Node.js Backend connected to MQTT');
});

// --- LONG-POLLING COMPATIBILITY FOR TEST SCRIPT ---
let waitingClients = [];
let esp32Connected = false;

app.get('/poll', (req, res) => {
    console.log('[POLL] ESP32 Connected for Polling!');
    esp32Connected = true;
    
    // Hold connection for 50 seconds max
    req.setTimeout(50000, () => {
        esp32Connected = false;
        res.status(204).end();
    });

    waitingClients.push(res);

    req.on('close', () => {
        waitingClients = waitingClients.filter(client => client !== res);
        esp32Connected = false;
    });
});

app.get('/status', (req, res) => {
    res.json({ connected_devices: esp32Connected ? 1 : 0 });
});
// --------------------------------------------------

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path.join(__dirname, 'public', 'uploads'); 
        if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, { recursive: true });
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        cb(null, 'latest_ota.bin'); 
    }
});
const upload = multer({ storage: storage });

app.post('/upload', upload.single('ota_file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });
    
    // Server ka live URL nikalna
    const host = req.get('host');
    const protocol = req.protocol === 'https' || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
    const downloadUrl = protocol + '://' + host + '/uploads/latest_ota.bin';

    console.log(`[SERVER] File received. Sending MQTT trigger with URL: ${downloadUrl}`);

    // ESP32 ko MQTT par silent command bhejna! (For Main 600-line code)
    const otaPayload = JSON.stringify({
        cmd: "download_ota",
        url: downloadUrl
    });
    mqttClient.publish("transformer/global/ota", otaPayload, { qos: 1 });

    // Release any waiting clients (For Test Script)
    if (waitingClients.length > 0) {
        waitingClients.forEach(client => {
            res.download(req.file.path, 'latest_ota.bin', (err) => {
                if (err) console.error("Error sending file to ESP32:", err);
            });
        });
        waitingClients = [];
    }

    return res.json({ success: true, message: 'Upload Success! File sent to ESP32.' });
});

app.listen(PORT, () => {
    console.log(`🚀 ESP32 OTA Server running on port ${PORT}`);
});
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const mqtt = require('mqtt'); // 👈 Naya MQTT package

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.static('public'));

// 🚀 MQTT SETUP
const mqttClient = mqtt.connect('mqtt://otplai.com:1883', {
    username: 'oxmo',
    password: '123456789'
});

mqttClient.on('connect', () => {
    console.log('✅ Node.js Backend connected to MQTT (otplai.com)');
});

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path.join(__dirname, 'public', 'uploads'); // Uploading inside public so it can be downloaded directly
        if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, { recursive: true });
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        cb(null, 'latest_ota.bin'); // Save as fixed name for easy download
    }
});
const upload = multer({ storage: storage });

app.post('/upload', upload.single('ota_file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });
    
    // Server ka live URL nikalna (Render URL ya local)
    const host = req.get('host');
    const protocol = req.protocol === 'https' || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
    const downloadUrl = protocol + '://' + host + '/uploads/latest_ota.bin';

    console.log(`[SERVER] File received. Sending MQTT trigger with URL: ${downloadUrl}`);

    // ESP32 ko MQTT par silent command bhejna!
    const otaPayload = JSON.stringify({
        cmd: "download_ota",
        url: downloadUrl
    });
    
    mqttClient.publish("transformer/global/ota", otaPayload, { qos: 1 }, (err) => {
        if(err) console.log("MQTT Publish Error:", err);
    });

    return res.json({ success: true, message: 'MQTT Trigger Sent! ESP32 is downloading now.' });
});

app.listen(PORT, () => {
    console.log(`🚀 ESP32 OTA Server running on port ${PORT}`);
});
