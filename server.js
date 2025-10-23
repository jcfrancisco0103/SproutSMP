const express = require('express');
const session = require('express-session');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const WebSocket = require('ws');
const http = require('http');
const path = require('path');
const fs = require('fs-extra');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');
const { spawn } = require('child_process');
const si = require('systeminformation');
const ProcessManager = require('./scripts/process-manager');
const chokidar = require('chokidar');
const { v4: uuidv4 } = require('uuid');
const sanitize = require('sanitize-filename');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Initialize process manager
const processManager = new ProcessManager();

// Configuration
const CONFIG = {
    port: process.env.PORT || 3000,
    sessionSecret: process.env.SESSION_SECRET || 'minecraft-server-wrapper-secret',
    serverPath: process.env.SERVER_PATH || path.join(__dirname, 'minecraft-server'),
    maxFileSize: 100 * 1024 * 1024, // 100MB
    defaultUsername: 'admin',
    defaultPassword: 'admin123'
};

// Global variables
let minecraftProcess = null;
let serverStatus = 'stopped';
let serverConfig = {
    jarFile: 'server.jar',
    minMemory: '1G',
    maxMemory: '2G',
    useAikarFlags: true,
    customArgs: ''
};

// Middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'", "ws:", "wss:"]
        }
    }
}));
app.use(compression());
app.use(morgan('combined'));
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Session configuration
app.use(session({
    secret: CONFIG.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: false, // Set to true in production with HTTPS
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// Authentication middleware
const requireAuth = (req, res, next) => {
    if (req.session && req.session.authenticated) {
        return next();
    } else {
        return res.status(401).json({ error: 'Authentication required' });
    }
};

// File upload configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = req.body.path || CONFIG.serverPath;
        fs.ensureDirSync(uploadPath);
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        cb(null, sanitize(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: CONFIG.maxFileSize },
    fileFilter: (req, file, cb) => {
        // Security check - prevent executable uploads in certain directories
        const dangerousExtensions = ['.exe', '.bat', '.cmd', '.sh', '.ps1'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (dangerousExtensions.includes(ext)) {
            return cb(new Error('File type not allowed'));
        }
        cb(null, true);
    }
});

// Initialize server directory
fs.ensureDirSync(CONFIG.serverPath);

// Routes
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    
    // Simple authentication (in production, use proper user management)
    if (username === CONFIG.defaultUsername && password === CONFIG.defaultPassword) {
        req.session.authenticated = true;
        req.session.username = username;
        res.json({ success: true, message: 'Login successful' });
    } else {
        res.status(401).json({ error: 'Invalid credentials' });
    }
});

app.post('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true, message: 'Logged out successfully' });
});

// Server status endpoint
app.get('/api/server/status', requireAuth, (req, res) => {
    const status = processManager.getProcessStatus('minecraft-server');
    res.json({
        status: status.running ? 'running' : 'stopped',
        ...status
    });
});

// Start server endpoint
app.post('/api/server/start', requireAuth, async (req, res) => {
    try {
        const status = processManager.getProcessStatus('minecraft-server');
        if (status.running) {
            return res.status(400).json({ error: 'Server is already running' });
        }

        serverStatus = 'starting';
        broadcastToClients({ type: 'status', status: serverStatus });

        const processInfo = await processManager.startMinecraftServer({
            ...serverConfig,
            workingDir: CONFIG.serverPath
        });

        serverStatus = 'running';
        broadcastToClients({ 
            type: 'status',
            status: serverStatus,
            pid: processInfo.pid,
            startTime: processInfo.startTime
        });

        res.json({ 
            success: true, 
            message: 'Server started successfully',
            ...processInfo
        });
    } catch (error) {
        serverStatus = 'stopped';
        broadcastToClients({ type: 'status', status: serverStatus });
        res.status(500).json({ error: error.message });
    }
});

// Stop server endpoint
app.post('/api/server/stop', requireAuth, async (req, res) => {
    try {
        const status = processManager.getProcessStatus('minecraft-server');
        if (!status.running) {
            return res.status(400).json({ error: 'Server is not running' });
        }

        serverStatus = 'stopping';
        broadcastToClients({ type: 'status', status: serverStatus });

        const result = await processManager.stopProcess('minecraft-server', 30000);
        
        serverStatus = 'stopped';
        broadcastToClients({ type: 'status', status: serverStatus });

        res.json({ 
            success: true, 
            message: 'Server stopped successfully',
            exitCode: result.code,
            signal: result.signal
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Restart server endpoint
app.post('/api/server/restart', requireAuth, async (req, res) => {
    try {
        const status = processManager.getProcessStatus('minecraft-server');
        
        if (status.running) {
            serverStatus = 'stopping';
            broadcastToClients({ type: 'status', status: serverStatus });
            
            await processManager.stopProcess('minecraft-server', 30000);
        }

        // Wait a moment before starting
        setTimeout(async () => {
            try {
                serverStatus = 'starting';
                broadcastToClients({ type: 'status', status: serverStatus });

                const processInfo = await processManager.startMinecraftServer({
                    ...serverConfig,
                    workingDir: CONFIG.serverPath
                });

                serverStatus = 'running';
                broadcastToClients({ 
                    type: 'status',
                    status: serverStatus,
                    pid: processInfo.pid,
                    startTime: processInfo.startTime
                });
            } catch (error) {
                serverStatus = 'stopped';
                broadcastToClients({ type: 'status', status: serverStatus });
            }
        }, 2000);

        res.json({ success: true, message: 'Server restart initiated' });
    } catch (error) {
        serverStatus = 'stopped';
        broadcastToClients({ type: 'status', status: serverStatus });
        res.status(500).json({ error: error.message });
    }
});

// Kill server endpoint
app.post('/api/server/kill', requireAuth, (req, res) => {
    try {
        const status = processManager.getProcessStatus('minecraft-server');
        if (!status.running) {
            return res.status(400).json({ error: 'Server is not running' });
        }

        processManager.killProcess('minecraft-server', 'SIGKILL');
        
        serverStatus = 'stopped';
        broadcastToClients({ type: 'status', status: serverStatus });

        res.json({ success: true, message: 'Server killed successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Send command to server
app.post('/api/server/command', requireAuth, (req, res) => {
    const { command } = req.body;
    
    if (!command) {
        return res.status(400).json({ error: 'Command is required' });
    }

    try {
        const success = processManager.sendCommand('minecraft-server', command);
        
        if (success) {
            res.json({ success: true, message: 'Command sent successfully' });
        } else {
            res.status(500).json({ error: 'Failed to send command' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// System stats endpoint
app.get('/api/system/stats', requireAuth, async (req, res) => {
    try {
        const stats = await processManager.getSystemStats();
        res.json(stats);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/files', requireAuth, (req, res) => {
    const requestedPath = req.query.path || CONFIG.serverPath;
    const safePath = path.resolve(CONFIG.serverPath, path.relative(CONFIG.serverPath, requestedPath));
    
    // Security check - ensure path is within server directory
    if (!safePath.startsWith(CONFIG.serverPath)) {
        return res.status(403).json({ error: 'Access denied' });
    }

    try {
        const items = fs.readdirSync(safePath).map(item => {
            const itemPath = path.join(safePath, item);
            const stats = fs.statSync(itemPath);
            return {
                name: item,
                path: itemPath,
                isDirectory: stats.isDirectory(),
                size: stats.size,
                modified: stats.mtime
            };
        });

        res.json({
            currentPath: safePath,
            items: items
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to read directory' });
    }
});

app.post('/api/files/upload', requireAuth, upload.array('files'), (req, res) => {
    res.json({ success: true, message: `${req.files.length} file(s) uploaded successfully` });
});

app.get('/api/files/download/:filename', requireAuth, (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(CONFIG.serverPath, filename);
    
    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'File not found' });
    }

    res.download(filePath);
});

app.delete('/api/files/:filename', requireAuth, (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(CONFIG.serverPath, filename);
    
    try {
        fs.removeSync(filePath);
        res.json({ success: true, message: 'File deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete file' });
    }
});

app.get('/api/config', requireAuth, (req, res) => {
    res.json(serverConfig);
});

app.post('/api/config', requireAuth, (req, res) => {
    const { jarFile, minMemory, maxMemory, useAikarFlags, customArgs } = req.body;
    
    serverConfig = {
        jarFile: jarFile || serverConfig.jarFile,
        minMemory: minMemory || serverConfig.minMemory,
        maxMemory: maxMemory || serverConfig.maxMemory,
        useAikarFlags: useAikarFlags !== undefined ? useAikarFlags : serverConfig.useAikarFlags,
        customArgs: customArgs || serverConfig.customArgs
    };

    // Save config to file
    fs.writeJsonSync(path.join(__dirname, 'config.json'), serverConfig);
    
    res.json({ success: true, message: 'Configuration updated' });
});

// WebSocket handling
function broadcastToClients(message) {
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(message));
        }
    });
}

wss.on('connection', (ws) => {
    console.log('Client connected');
    
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            
            if (data.type === 'command' && minecraftProcess && serverStatus === 'running') {
                minecraftProcess.stdin.write(data.command + '\n');
            }
        } catch (error) {
            console.error('WebSocket message error:', error);
        }
    });

    ws.on('close', () => {
        console.log('Client disconnected');
    });
});

// Load saved configuration
try {
    const savedConfig = fs.readJsonSync(path.join(__dirname, 'config.json'));
    serverConfig = { ...serverConfig, ...savedConfig };
} catch (error) {
    console.log('No saved configuration found, using defaults');
}

// Start server
server.listen(CONFIG.port, () => {
    console.log(`Minecraft Server Wrapper running on port ${CONFIG.port}`);
    console.log(`Default login: ${CONFIG.defaultUsername} / ${CONFIG.defaultPassword}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('Shutting down gracefully...');
    if (minecraftProcess) {
        minecraftProcess.stdin.write('stop\n');
        setTimeout(() => {
            process.exit(0);
        }, 10000);
    } else {
        process.exit(0);
    }
});