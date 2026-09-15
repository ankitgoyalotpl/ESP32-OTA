const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.static('public'));

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
        // ORIGINAL NAME SAVE KAREGA
        cb(null, file.originalname); 
    }
});
const upload = multer({ storage: storage });

app.post('/upload', upload.single('ota_file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });

    console.log(`[SERVER] File received: ${req.file.originalname}. Releasing to waiting ESP32 clients.`);

    // Release any waiting clients (For Test Script)
    if (waitingClients.length > 0) {
        waitingClients.forEach(client => {
            // ORIGINAL NAME SEND KAREGA
            client.download(req.file.path, req.file.originalname, (err) => {
                if (err) console.error("Error sending file to ESP32:", err);
            });
        });
        waitingClients = [];
    }

    return res.json({ success: true, message: `Upload Success! ${req.file.originalname} sent to ESP32.` });
});

app.listen(PORT, () => {
    console.log(`🚀 ESP32 OTA Server running on port ${PORT}`);
});
