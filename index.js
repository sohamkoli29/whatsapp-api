const express = require('express');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

const app = express();
app.use(express.json());

const client = new Client({
    authStrategy: new LocalAuth({ dataPath: './sessions' }),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process', // Crucial to save RAM on free hosting tiers
            '--disable-gpu'
        ]
    }
});

let latestQr = "";

client.on('qr', (qr) => {
    console.log('New QR Code generated.');
    latestQr = qr; // Save the raw string for n8n to fetch
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('WhatsApp client is ready!');
    latestQr = "CONNECTED";
});

// Endpoint for n8n to check status or fetch the current QR string
app.get('/api/status', (req, res) => {
    const apiKey = req.headers['x-api-key'];
    if (apiKey !== process.env.API_KEY) return res.status(401).send('Unauthorized');
    res.json({ status: latestQr === "CONNECTED" ? "CONNECTED" : "DISCONNECTED", qr: latestQr });
});

// Endpoint for n8n to dispatch text messages to an array of inputs
app.post('/api/sendText', async (req, res) => {
    const apiKey = req.headers['x-api-key'];
    if (apiKey !== process.env.API_KEY) return res.status(401).send('Unauthorized');

    const { chatId, text } = req.body;
    try {
        await client.sendMessage(chatId, text);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

const PORT = process.env.PORT || 3000;
client.initialize();
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
