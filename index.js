const express = require('express');
const { Client, LocalAuth } = require('whatsapp-web.js');

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
            '--single-process',
            '--disable-gpu'
        ]
    }
});

let latestQr = "";
let isConnected = false;

client.on('qr', (qr) => {
    console.log('New QR Code generated.');
    latestQr = qr;
});

client.on('ready', () => {
    console.log('WhatsApp client is ready!');
    isConnected = true;
    latestQr = "";
});

client.on('disconnected', () => {
    console.log('Client disconnected.');
    isConnected = false;
});

// A clean Frontend Web View right on your main URL to scan easily
app.get('/', (req, res) => {
    if (isConnected) {
        return res.send(`
            <div style="font-family:sans-serif; text-align:center; margin-top:100px;">
                <h1 style="color:#128C7E;">✅ WhatsApp Client is Connected!</h1>
                <p>Your server is securely linked and listening for n8n commands.</p>
            </div>
        `);
    }

    if (!latestQr) {
        return res.send(`
            <div style="font-family:sans-serif; text-align:center; margin-top:100px;">
                <h1>⏳ Initializing Browser...</h1>
                <p>Generating a fresh WhatsApp Web session. Please refresh this page in 10 seconds.</p>
                <script>setTimeout(() => { location.reload(); }, 5000);</script>
            </div>
        `);
    }

    // Displays a dynamic QR code that regenerates instantly when it changes
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Scan WhatsApp Bot</title>
            <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
            <style>
                body { font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; background: #f0f2f5; margin: 0; }
                .card { background: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 10px rgba(0,0,0,0.1); text-align: center; }
                h2 { color: #128C7E; }
            </style>
        </head>
        <body>
            <div class="card">
                <h2>Link Your WhatsApp Bot</h2>
                <p>Scan this QR code with your WhatsApp app (Linked Devices):</p>
                <div id="qrcode" style="display:flex; justify-content:center; margin: 20px 0;"></div>
                <p style="color:#666; font-size:12px;">This page auto-refreshes to ensure the token doesn't expire.</p>
            </div>
            <script>
                new QRCode(document.getElementById("qrcode"), {
                    text: "${latestQr}",
                    width: 256,
                    height: 256
                });
                // Auto refresh every 30 seconds to fetch a fresh QR code before it expires
                setTimeout(() => { location.reload(); }, 30000);
            </script>
        </body>
        </html>
    `);
});

// Outbound endpoints for your n8n workflows
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

const PORT = process.env.PORT || 10000;
client.initialize();
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
