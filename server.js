const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.static('public'));

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path.join(__dirname, 'uploads');
        if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath);
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname);
    }
});
const upload = multer({ storage: storage });

let waitingClients = [];

app.post('/upload', upload.single('ota_file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });

    const filePath = req.file.path;
    const fileName = req.file.originalname;
    
    console.log(`[SERVER] Received file: ${fileName}. Sending to ${waitingClients.length} ESP32(s)...`);

    if (waitingClients.length > 0) {
        waitingClients.forEach(client => {
            clearTimeout(client.timeout);
            client.res.setHeader('Content-Type', 'application/octet-stream');
            client.res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
            
            const readStream = fs.createReadStream(filePath);
            readStream.pipe(client.res);
        });
        
        waitingClients = [];
        return res.json({ success: true, message: 'File sent to ESP32 instantly!' });
    } else {
        return res.json({ success: true, message: 'File uploaded, but no ESP32 connected.' });
    }
});

app.get('/poll', (req, res) => {
    console.log(`[ESP32] Connected and waiting for files...`);
    
    const timeoutId = setTimeout(() => {
        waitingClients = waitingClients.filter(c => c.res !== res);
        res.status(204).send();
        console.log(`[ESP32] Timeout. Sent 204.`);
    }, 50000); 

    waitingClients.push({ res: res, timeout: timeoutId });
});

app.get('/status', (req, res) => {
    res.json({ connected_devices: waitingClients.length });
});

app.listen(PORT, () => {
    console.log(`🚀 ESP32 OTA Server running at http://localhost:${PORT}`);
});
