// Global variables
let ws = null;
let isAuthenticated = false;
let currentPath = '';
let commandHistory = [];
let historyIndex = -1;
let performanceCharts = {};
let serverStartTime = null;

// Initialize application
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

function initializeApp() {
    setupEventListeners();
    checkAuthStatus();
    setupWebSocket();
    initializeCharts();
    
    // Check server status periodically
    setInterval(updateServerStatus, 5000);
    setInterval(updateSystemStats, 10000);
    setInterval(updateUptime, 1000);
}

function setupEventListeners() {
    // Login form
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    
    // Logout button
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);
    
    // Navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => switchTab(item.dataset.tab));
    });
    
    // Server controls
    document.getElementById('startBtn').addEventListener('click', () => serverAction('start'));
    document.getElementById('stopBtn').addEventListener('click', () => serverAction('stop'));
    document.getElementById('restartBtn').addEventListener('click', () => serverAction('restart'));
    document.getElementById('killBtn').addEventListener('click', () => serverAction('kill'));
    
    // Console
    document.getElementById('commandInput').addEventListener('keydown', handleCommandInput);
    document.getElementById('sendCommand').addEventListener('click', sendCommand);
    document.getElementById('clearConsole').addEventListener('click', clearConsole);
    document.getElementById('scrollToBottom').addEventListener('click', scrollConsoleToBottom);
    
    // File manager
    document.getElementById('uploadFiles').addEventListener('click', () => showModal('uploadModal'));
    document.getElementById('refreshFiles').addEventListener('click', loadFiles);
    document.getElementById('uploadBtn').addEventListener('click', uploadFiles);
    
    // Configuration
    document.getElementById('configForm').addEventListener('submit', saveConfiguration);
    
    // Modal close buttons
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const modal = e.target.closest('.modal');
            if (modal) hideModal(modal.id);
        });
    });
    
    // Click outside modal to close
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                hideModal(modal.id);
            }
        });
    });
}

// Authentication
async function handleLogin(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const credentials = {
        username: formData.get('username'),
        password: formData.get('password')
    };
    
    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(credentials)
        });
        
        const result = await response.json();
        
        if (response.ok) {
            isAuthenticated = true;
            document.getElementById('currentUser').textContent = credentials.username;
            hideModal('loginModal');
            document.getElementById('app').classList.remove('hidden');
            showToast('Login successful', 'success');
            
            // Load initial data
            loadConfiguration();
            loadFiles();
            updateServerStatus();
        } else {
            showToast(result.error || 'Login failed', 'error');
        }
    } catch (error) {
        showToast('Connection error', 'error');
    }
}

async function handleLogout() {
    try {
        await fetch('/api/logout', { method: 'POST' });
    } catch (error) {
        console.error('Logout error:', error);
    }
    
    isAuthenticated = false;
    document.getElementById('app').classList.add('hidden');
    document.getElementById('loginModal').classList.remove('hidden');
    
    if (ws) {
        ws.close();
    }
    
    showToast('Logged out successfully', 'info');
}

function checkAuthStatus() {
    // This is a simple check - in production, you'd verify with the server
    if (!isAuthenticated) {
        document.getElementById('loginModal').classList.remove('hidden');
        document.getElementById('app').classList.add('hidden');
    }
}

// WebSocket connection
function setupWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    
    ws = new WebSocket(wsUrl);
    
    ws.onopen = function() {
        console.log('WebSocket connected');
    };
    
    ws.onmessage = function(event) {
        const data = JSON.parse(event.data);
        handleWebSocketMessage(data);
    };
    
    ws.onclose = function() {
        console.log('WebSocket disconnected');
        // Attempt to reconnect after 5 seconds
        setTimeout(setupWebSocket, 5000);
    };
    
    ws.onerror = function(error) {
        console.error('WebSocket error:', error);
    };
}

function handleWebSocketMessage(data) {
    switch (data.type) {
        case 'console':
            appendToConsole(data.data, data.level);
            break;
        case 'status':
            updateServerStatusDisplay(data.status);
            break;
        default:
            console.log('Unknown WebSocket message:', data);
    }
}

// Navigation
function switchTab(tabName) {
    // Update navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    
    // Update content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(tabName).classList.add('active');
    
    // Load tab-specific data
    switch (tabName) {
        case 'files':
            loadFiles();
            break;
        case 'performance':
            updatePerformanceCharts();
            break;
        case 'config':
            loadConfiguration();
            break;
    }
}

// Server controls
async function serverAction(action) {
    try {
        const response = await fetch(`/api/server/${action}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showToast(result.message, 'success');
            if (action === 'start') {
                serverStartTime = new Date();
            } else if (action === 'stop' || action === 'kill') {
                serverStartTime = null;
            }
        } else {
            showToast(result.error || 'Action failed', 'error');
        }
    } catch (error) {
        showToast('Connection error', 'error');
    }
}

async function updateServerStatus() {
    try {
        const response = await fetch('/api/server/status');
        const data = await response.json();
        
        updateServerStatusDisplay(data.status);
        updateControlButtons(data.status);
        
        if (data.status === 'running' && !serverStartTime) {
            serverStartTime = new Date();
        } else if (data.status === 'stopped') {
            serverStartTime = null;
        }
    } catch (error) {
        console.error('Failed to update server status:', error);
    }
}

function updateServerStatusDisplay(status) {
    const statusElement = document.getElementById('serverStatus');
    const indicatorElement = document.getElementById('statusIndicator');
    
    statusElement.textContent = status.charAt(0).toUpperCase() + status.slice(1);
    
    // Remove all status classes
    indicatorElement.className = 'status-indicator';
    
    // Add appropriate class
    if (status === 'running') {
        indicatorElement.classList.add('running');
    } else if (['starting', 'stopping', 'restarting'].includes(status)) {
        indicatorElement.classList.add(status);
    }
}

function updateControlButtons(status) {
    const startBtn = document.getElementById('startBtn');
    const stopBtn = document.getElementById('stopBtn');
    const restartBtn = document.getElementById('restartBtn');
    const killBtn = document.getElementById('killBtn');
    const commandInput = document.getElementById('commandInput');
    const sendCommand = document.getElementById('sendCommand');
    
    const isRunning = status === 'running';
    const isStopped = status === 'stopped';
    
    startBtn.disabled = !isStopped;
    stopBtn.disabled = !isRunning;
    restartBtn.disabled = !isRunning;
    killBtn.disabled = isStopped;
    commandInput.disabled = !isRunning;
    sendCommand.disabled = !isRunning;
    
    if (isRunning) {
        commandInput.placeholder = 'Enter server command...';
    } else {
        commandInput.placeholder = 'Server must be running to send commands';
    }
}

// Console functionality
function handleCommandInput(e) {
    if (e.key === 'Enter') {
        sendCommand();
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        navigateHistory(-1);
    } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        navigateHistory(1);
    }
}

function sendCommand() {
    const input = document.getElementById('commandInput');
    const command = input.value.trim();
    
    if (!command) return;
    
    // Add to history
    commandHistory.unshift(command);
    if (commandHistory.length > 50) {
        commandHistory.pop();
    }
    historyIndex = -1;
    
    // Send via WebSocket
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'command', command: command }));
    }
    
    // Also send via HTTP as fallback
    fetch('/api/server/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: command })
    });
    
    // Clear input
    input.value = '';
    
    // Add command to console display
    appendToConsole(`> ${command}\n`, 'command');
}

function navigateHistory(direction) {
    const input = document.getElementById('commandInput');
    
    historyIndex += direction;
    
    if (historyIndex < -1) {
        historyIndex = -1;
    } else if (historyIndex >= commandHistory.length) {
        historyIndex = commandHistory.length - 1;
    }
    
    if (historyIndex === -1) {
        input.value = '';
    } else {
        input.value = commandHistory[historyIndex];
    }
}

function appendToConsole(text, level = 'info') {
    const consoleOutput = document.getElementById('consoleOutput');
    const recentConsole = document.getElementById('recentConsole');
    
    const timestamp = new Date().toLocaleTimeString();
    let formattedText = `[${timestamp}] ${text}`;
    
    // Add styling based on level
    if (level === 'error') {
        formattedText = `<span style="color: #ff6b6b;">${formattedText}</span>`;
    } else if (level === 'command') {
        formattedText = `<span style="color: #4ecdc4;">${formattedText}</span>`;
    } else if (level === 'warning') {
        formattedText = `<span style="color: #feca57;">${formattedText}</span>`;
    }
    
    consoleOutput.innerHTML += formattedText;
    
    // Update recent console (last 5 lines)
    const lines = consoleOutput.innerHTML.split('\n');
    const recentLines = lines.slice(-5).join('\n');
    recentConsole.innerHTML = recentLines;
    
    // Auto-scroll to bottom
    consoleOutput.scrollTop = consoleOutput.scrollHeight;
    
    // Limit console history to prevent memory issues
    const maxLines = 1000;
    if (lines.length > maxLines) {
        consoleOutput.innerHTML = lines.slice(-maxLines).join('\n');
    }
}

function clearConsole() {
    document.getElementById('consoleOutput').innerHTML = '';
    document.getElementById('recentConsole').innerHTML = '';
}

function scrollConsoleToBottom() {
    const consoleOutput = document.getElementById('consoleOutput');
    consoleOutput.scrollTop = consoleOutput.scrollHeight;
}

// File management
async function loadFiles(path = '') {
    try {
        const response = await fetch(`/api/files?path=${encodeURIComponent(path)}`);
        const data = await response.json();
        
        if (response.ok) {
            currentPath = data.currentPath;
            displayFiles(data.items);
            updateBreadcrumb(currentPath);
        } else {
            showToast(data.error || 'Failed to load files', 'error');
        }
    } catch (error) {
        showToast('Connection error', 'error');
    }
}

function displayFiles(items) {
    const fileList = document.getElementById('fileList');
    fileList.innerHTML = '';
    
    // Add parent directory link if not at root
    if (currentPath !== '') {
        const parentItem = createFileItem({
            name: '..',
            isDirectory: true,
            path: '',
            size: 0,
            modified: new Date()
        });
        fileList.appendChild(parentItem);
    }
    
    // Sort items: directories first, then files
    items.sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return a.name.localeCompare(b.name);
    });
    
    items.forEach(item => {
        const fileItem = createFileItem(item);
        fileList.appendChild(fileItem);
    });
}

function createFileItem(item) {
    const div = document.createElement('div');
    div.className = `file-item ${item.isDirectory ? 'directory' : 'file'}`;
    
    const icon = item.isDirectory ? 'fas fa-folder' : getFileIcon(item.name);
    const size = item.isDirectory ? '' : formatFileSize(item.size);
    const modified = new Date(item.modified).toLocaleString();
    
    div.innerHTML = `
        <i class="${icon}"></i>
        <div class="file-info">
            <div class="file-name">${item.name}</div>
            <div class="file-meta">${size} ${modified}</div>
        </div>
    `;
    
    div.addEventListener('click', () => {
        if (item.isDirectory) {
            if (item.name === '..') {
                const parentPath = currentPath.split('/').slice(0, -1).join('/');
                loadFiles(parentPath);
            } else {
                loadFiles(item.path);
            }
        } else {
            // Handle file click (download, edit, etc.)
            handleFileClick(item);
        }
    });
    
    return div;
}

function getFileIcon(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    
    const iconMap = {
        'jar': 'fas fa-file-archive',
        'zip': 'fas fa-file-archive',
        'rar': 'fas fa-file-archive',
        'txt': 'fas fa-file-alt',
        'log': 'fas fa-file-alt',
        'yml': 'fas fa-file-code',
        'yaml': 'fas fa-file-code',
        'json': 'fas fa-file-code',
        'properties': 'fas fa-file-code',
        'cfg': 'fas fa-file-code',
        'conf': 'fas fa-file-code',
        'png': 'fas fa-file-image',
        'jpg': 'fas fa-file-image',
        'jpeg': 'fas fa-file-image',
        'gif': 'fas fa-file-image'
    };
    
    return iconMap[ext] || 'fas fa-file';
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function updateBreadcrumb(path) {
    const breadcrumb = document.getElementById('breadcrumb');
    const parts = path.split('/').filter(part => part);
    
    let breadcrumbHTML = '<span onclick="loadFiles(\'\')">Root</span>';
    
    let currentPath = '';
    parts.forEach(part => {
        currentPath += '/' + part;
        breadcrumbHTML += ` / <span onclick="loadFiles('${currentPath}')">${part}</span>`;
    });
    
    breadcrumb.innerHTML = breadcrumbHTML;
}

function handleFileClick(item) {
    // For now, just download the file
    window.open(`/api/files/download/${encodeURIComponent(item.name)}`, '_blank');
}

async function uploadFiles() {
    const fileInput = document.getElementById('fileInput');
    const files = fileInput.files;
    
    if (files.length === 0) {
        showToast('Please select files to upload', 'warning');
        return;
    }
    
    const formData = new FormData();
    for (let file of files) {
        formData.append('files', file);
    }
    formData.append('path', currentPath);
    
    try {
        const response = await fetch('/api/files/upload', {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showToast(result.message, 'success');
            hideModal('uploadModal');
            loadFiles(currentPath);
            fileInput.value = '';
        } else {
            showToast(result.error || 'Upload failed', 'error');
        }
    } catch (error) {
        showToast('Upload error', 'error');
    }
}

// Configuration
async function loadConfiguration() {
    try {
        const response = await fetch('/api/config');
        const config = await response.json();
        
        if (response.ok) {
            document.getElementById('jarFile').value = config.jarFile;
            document.getElementById('minMemory').value = config.minMemory;
            document.getElementById('maxMemory').value = config.maxMemory;
            document.getElementById('useAikarFlags').checked = config.useAikarFlags;
            document.getElementById('customArgs').value = config.customArgs;
        }
    } catch (error) {
        console.error('Failed to load configuration:', error);
    }
}

async function saveConfiguration(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const config = {
        jarFile: formData.get('jarFile'),
        minMemory: formData.get('minMemory'),
        maxMemory: formData.get('maxMemory'),
        useAikarFlags: formData.has('useAikarFlags'),
        customArgs: formData.get('customArgs')
    };
    
    try {
        const response = await fetch('/api/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config)
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showToast(result.message, 'success');
        } else {
            showToast(result.error || 'Failed to save configuration', 'error');
        }
    } catch (error) {
        showToast('Connection error', 'error');
    }
}

// System monitoring
async function updateSystemStats() {
    try {
        const response = await fetch('/api/system/stats');
        const stats = await response.json();
        
        if (response.ok) {
            updateQuickStats(stats);
            updatePerformanceCharts(stats);
        }
    } catch (error) {
        console.error('Failed to update system stats:', error);
    }
}

function updateQuickStats(stats) {
    document.getElementById('cpuUsage').textContent = `${stats.cpu.usage.toFixed(1)}%`;
    document.getElementById('memoryUsage').textContent = `${stats.memory.usage.toFixed(1)}%`;
    
    if (stats.disk.length > 0) {
        document.getElementById('diskUsage').textContent = `${stats.disk[0].usage.toFixed(1)}%`;
    }
}

function updateUptime() {
    if (serverStartTime) {
        const now = new Date();
        const diff = now - serverStartTime;
        
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        
        const uptime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        document.getElementById('uptime').textContent = uptime;
    } else {
        document.getElementById('uptime').textContent = '00:00:00';
    }
}

// Performance charts
function initializeCharts() {
    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            y: {
                beginAtZero: true,
                max: 100
            }
        },
        plugins: {
            legend: {
                display: false
            }
        }
    };
    
    // CPU Chart
    const cpuCtx = document.getElementById('cpuChart').getContext('2d');
    performanceCharts.cpu = new Chart(cpuCtx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'CPU Usage (%)',
                data: [],
                borderColor: '#667eea',
                backgroundColor: 'rgba(102, 126, 234, 0.1)',
                tension: 0.4
            }]
        },
        options: chartOptions
    });
    
    // Memory Chart
    const memoryCtx = document.getElementById('memoryChart').getContext('2d');
    performanceCharts.memory = new Chart(memoryCtx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Memory Usage (%)',
                data: [],
                borderColor: '#764ba2',
                backgroundColor: 'rgba(118, 75, 162, 0.1)',
                tension: 0.4
            }]
        },
        options: chartOptions
    });
    
    // Disk Chart
    const diskCtx = document.getElementById('diskChart').getContext('2d');
    performanceCharts.disk = new Chart(diskCtx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Disk Usage (%)',
                data: [],
                borderColor: '#56ab2f',
                backgroundColor: 'rgba(86, 171, 47, 0.1)',
                tension: 0.4
            }]
        },
        options: chartOptions
    });
    
    // Network Chart
    const networkCtx = document.getElementById('networkChart').getContext('2d');
    performanceCharts.network = new Chart(networkCtx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                {
                    label: 'RX (MB/s)',
                    data: [],
                    borderColor: '#ff416c',
                    backgroundColor: 'rgba(255, 65, 108, 0.1)',
                    tension: 0.4
                },
                {
                    label: 'TX (MB/s)',
                    data: [],
                    borderColor: '#ff4b2b',
                    backgroundColor: 'rgba(255, 75, 43, 0.1)',
                    tension: 0.4
                }
            ]
        },
        options: {
            ...chartOptions,
            plugins: {
                legend: {
                    display: true
                }
            }
        }
    });
}

function updatePerformanceCharts(stats) {
    if (!stats) return;
    
    const now = new Date().toLocaleTimeString();
    const maxDataPoints = 20;
    
    // Update CPU chart
    const cpuChart = performanceCharts.cpu;
    cpuChart.data.labels.push(now);
    cpuChart.data.datasets[0].data.push(stats.cpu.usage);
    
    if (cpuChart.data.labels.length > maxDataPoints) {
        cpuChart.data.labels.shift();
        cpuChart.data.datasets[0].data.shift();
    }
    cpuChart.update('none');
    
    // Update Memory chart
    const memoryChart = performanceCharts.memory;
    memoryChart.data.labels.push(now);
    memoryChart.data.datasets[0].data.push(stats.memory.usage);
    
    if (memoryChart.data.labels.length > maxDataPoints) {
        memoryChart.data.labels.shift();
        memoryChart.data.datasets[0].data.shift();
    }
    memoryChart.update('none');
    
    // Update Disk chart
    if (stats.disk.length > 0) {
        const diskChart = performanceCharts.disk;
        diskChart.data.labels.push(now);
        diskChart.data.datasets[0].data.push(stats.disk[0].usage);
        
        if (diskChart.data.labels.length > maxDataPoints) {
            diskChart.data.labels.shift();
            diskChart.data.datasets[0].data.shift();
        }
        diskChart.update('none');
    }
    
    // Update Network chart
    if (stats.network.length > 0) {
        const networkChart = performanceCharts.network;
        const rxMBps = (stats.network[0].rx_sec || 0) / (1024 * 1024);
        const txMBps = (stats.network[0].tx_sec || 0) / (1024 * 1024);
        
        networkChart.data.labels.push(now);
        networkChart.data.datasets[0].data.push(rxMBps);
        networkChart.data.datasets[1].data.push(txMBps);
        
        if (networkChart.data.labels.length > maxDataPoints) {
            networkChart.data.labels.shift();
            networkChart.data.datasets[0].data.shift();
            networkChart.data.datasets[1].data.shift();
        }
        networkChart.update('none');
    }
}

// Utility functions
function showModal(modalId) {
    document.getElementById(modalId).classList.remove('hidden');
}

function hideModal(modalId) {
    document.getElementById(modalId).classList.add('hidden');
}

function showToast(message, type = 'info') {
    const toastContainer = document.getElementById('toastContainer');
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icon = {
        success: 'fas fa-check-circle',
        error: 'fas fa-exclamation-circle',
        warning: 'fas fa-exclamation-triangle',
        info: 'fas fa-info-circle'
    }[type] || 'fas fa-info-circle';
    
    toast.innerHTML = `
        <i class="${icon}"></i>
        <span>${message}</span>
    `;
    
    toastContainer.appendChild(toast);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
        }
    }, 5000);
    
    // Click to dismiss
    toast.addEventListener('click', () => {
        if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
        }
    });
}