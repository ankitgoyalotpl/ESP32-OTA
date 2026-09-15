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

    console.log([SERVER] File received. Sending MQTT trigger with URL: );

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
    console.log(🚀 ESP32 OTA Server running on port );
});
