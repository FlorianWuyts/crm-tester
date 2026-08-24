const express = require('express');
const app = express();

app.use(express.json());

// In-memory array of logged call lookups
let callLogs = [];
let sseClients = [];

// 1. Live SSE Stream endpoint for the frontend
app.get('/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Send existing history on connection
    res.write(`data: ${JSON.stringify({ type: 'INIT', data: callLogs })}\n\n`);

    sseClients.push(res);
    req.on('close', () => {
        sseClients = sseClients.filter(c => c !== res);
    });
});

// 2. 3CX CRM Endpoint (handles GET with all query params)
app.get('/3cx-lookup', (req, res) => {
    const rawPhone = req.query.phone || req.query.number || 'Unknown';
    const agentExt = req.query.ext || 'N/A';
    const callType = req.query.calltype || 'Inbound';

    // Format phone to +32...
    let digits = rawPhone.replace(/[^0-9]/g, '');
    if (digits.startsWith('0')) {
        digits = '32' + digits.substring(1);
    }
    const formattedPhone = '+' + digits;
    const autotaskUrl = `https://ww4.autotask.net/Autotask/AutotaskExtend/ExecuteCommand.aspx?Code=OpenAccount&Phone=${encodeURIComponent(formattedPhone)}`;

    // Structure the call data to display on dashboard
    const logEntry = {
        id: Date.now(),
        timestamp: new Date().toLocaleTimeString(),
        rawParams: req.query,
        formattedPhone: formattedPhone,
        agentExtension: agentExt,
        callType: callType,
        generatedUrl: autotaskUrl
    };

    callLogs.unshift(logEntry);
    if (callLogs.length > 50) callLogs.pop(); // Keep last 50 calls

    // Broadcast the new call instantly to all open web dashboard pages
    sseClients.forEach(client => {
        client.write(`data: ${JSON.stringify({ type: 'NEW_CALL', data: logEntry })}\n\n`);
    });

    // Send valid CRM response back to 3CX
    res.json({
        ContactId: "1",
        FirstName: "Autotask",
        LastName: "Account",
        PhoneBusiness: formattedPhone,
        ContactUrl: autotaskUrl
    });
});

// 3. Web Dashboard UI
app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>3CX Real-Time CRM Inspector</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #f8fafc; padding: 24px; margin: 0; }
        .container { max-width: 1000px; margin: auto; }
        header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #334155; padding-bottom: 16px; margin-bottom: 24px; }
        h1 { margin: 0; font-size: 1.5rem; color: #38bdf8; }
        .badge { background: #1e293b; border: 1px solid #38bdf8; color: #38bdf8; padding: 4px 12px; border-radius: 9999px; font-size: 0.875rem; }
        .card { background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 16px; margin-bottom: 16px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
        .card-header { display: flex; justify-content: space-between; font-weight: bold; margin-bottom: 8px; color: #94a3b8; font-size: 0.85rem; }
        .phone { font-size: 1.25rem; font-weight: bold; color: #4ade80; margin-bottom: 8px; }
        .details { font-family: monospace; background: #0b1120; padding: 10px; border-radius: 6px; font-size: 0.85rem; color: #e2e8f0; overflow-x: auto; }
        .url-link { color: #38bdf8; text-decoration: none; word-break: break-all; }
        .url-link:hover { text-decoration: underline; }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>3CX CRM Lookup Monitor</h1>
            <span class="badge" id="status">Listening...</span>
        </header>
        <div id="feed"></div>
    </div>

    <script>
        const feed = document.getElementById('feed');
        const evtSource = new EventSource('/events');

        function createCard(call) {
            const card = document.createElement('div');
            card.className = 'card';
            card.innerHTML = \`
                <div class="card-header">
                    <span>\${call.timestamp} | Agent Ext: \${call.agentExtension} | Type: \${call.callType}</span>
                    <span>ID: #\${call.id}</span>
                </div>
                <div class="phone">📞 \${call.formattedPhone}</div>
                <div style="margin-bottom: 8px;">
                    <strong>Generated ContactUrl:</strong><br>
                    <a class="url-link" href="\${call.generatedUrl}" target="_blank">\${call.generatedUrl}</a>
                </div>
                <div>
                    <strong>Raw Query Parameters Received:</strong>
                    <pre class="details">\${JSON.stringify(call.rawParams, null, 2)}</pre>
                </div>
            \`;
            return card;
        }

        evtSource.onmessage = function(e) {
            const msg = JSON.parse(e.data);
            if (msg.type === 'INIT') {
                feed.innerHTML = '';
                msg.data.forEach(call => feed.appendChild(createCard(call)));
            } else if (msg.type === 'NEW_CALL') {
                feed.insertBefore(createCard(msg.data), feed.firstChild);
            }
        };
    </script>
</body>
</html>
    `);
});

app.listen(3000, () => console.log('CRM Monitor running on http://localhost:3000'));