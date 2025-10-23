const { spawn, exec } = require('child_process');
const os = require('os');
const path = require('path');
const fs = require('fs');

class ProcessManager {
    constructor() {
        this.isWindows = os.platform() === 'win32';
        this.isLinux = os.platform() === 'linux';
        this.processes = new Map();
        this.logDir = path.join(__dirname, '..', 'logs');
        
        // Ensure log directory exists
        if (!fs.existsSync(this.logDir)) {
            fs.mkdirSync(this.logDir, { recursive: true });
        }
    }

    /**
     * Start a Minecraft server process with proper isolation
     */
    async startMinecraftServer(config) {
        const {
            jarFile = 'server.jar',
            minMemory = '1G',
            maxMemory = '2G',
            jvmArgs = [],
            serverArgs = [],
            workingDir = path.join(__dirname, '..', 'minecraft-server'),
            useAikarFlags = false
        } = config;

        // Validate jar file exists
        const jarPath = path.join(workingDir, jarFile);
        if (!fs.existsSync(jarPath)) {
            throw new Error(`Server jar file not found: ${jarPath}`);
        }

        // Build JVM arguments
        let args = [];
        
        // Memory settings
        args.push(`-Xms${minMemory}`, `-Xmx${maxMemory}`);
        
        // Aikar's flags for better performance
        if (useAikarFlags) {
            args.push(
                '-XX:+UseG1GC',
                '-XX:+ParallelRefProcEnabled',
                '-XX:MaxGCPauseMillis=200',
                '-XX:+UnlockExperimentalVMOptions',
                '-XX:+DisableExplicitGC',
                '-XX:+AlwaysPreTouch',
                '-XX:G1NewSizePercent=30',
                '-XX:G1MaxNewSizePercent=40',
                '-XX:G1HeapRegionSize=8M',
                '-XX:G1ReservePercent=20',
                '-XX:G1HeapWastePercent=5',
                '-XX:G1MixedGCCountTarget=4',
                '-XX:InitiatingHeapOccupancyPercent=15',
                '-XX:G1MixedGCLiveThresholdPercent=90',
                '-XX:G1RSetUpdatingPauseTimePercent=5',
                '-XX:SurvivorRatio=32',
                '-XX:+PerfDisableSharedMem',
                '-XX:MaxTenuringThreshold=1'
            );
        }
        
        // Custom JVM arguments
        args.push(...jvmArgs);
        
        // Server jar and arguments
        args.push('-jar', jarFile, '--nogui');
        args.push(...serverArgs);

        // Create log files
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const logFile = path.join(this.logDir, `minecraft-server-${timestamp}.log`);
        const errorLogFile = path.join(this.logDir, `minecraft-server-error-${timestamp}.log`);

        // Spawn options
        const spawnOptions = {
            cwd: workingDir,
            stdio: ['pipe', 'pipe', 'pipe'],
            detached: !this.isWindows, // On Unix, create new process group
            windowsHide: this.isWindows // On Windows, hide console window
        };

        try {
            // Start the process
            const child = spawn('java', args, spawnOptions);
            
            // Store process information
            const processInfo = {
                pid: child.pid,
                startTime: new Date(),
                config: config,
                logFile: logFile,
                errorLogFile: errorLogFile,
                process: child
            };
            
            this.processes.set('minecraft-server', processInfo);

            // Set up logging
            const logStream = fs.createWriteStream(logFile, { flags: 'a' });
            const errorLogStream = fs.createWriteStream(errorLogFile, { flags: 'a' });

            child.stdout.on('data', (data) => {
                const timestamp = new Date().toISOString();
                const logLine = `[${timestamp}] ${data.toString()}`;
                logStream.write(logLine);
            });

            child.stderr.on('data', (data) => {
                const timestamp = new Date().toISOString();
                const logLine = `[${timestamp}] ${data.toString()}`;
                errorLogStream.write(logLine);
            });

            // Handle process events
            child.on('close', (code, signal) => {
                const timestamp = new Date().toISOString();
                const logLine = `[${timestamp}] Process exited with code ${code} and signal ${signal}\n`;
                logStream.write(logLine);
                logStream.end();
                errorLogStream.end();
                
                this.processes.delete('minecraft-server');
            });

            child.on('error', (error) => {
                const timestamp = new Date().toISOString();
                const logLine = `[${timestamp}] Process error: ${error.message}\n`;
                errorLogStream.write(logLine);
            });

            // On Unix systems, unreference the child process so parent can exit
            if (!this.isWindows) {
                child.unref();
            }

            return {
                pid: child.pid,
                startTime: processInfo.startTime,
                logFile: logFile,
                errorLogFile: errorLogFile
            };

        } catch (error) {
            throw new Error(`Failed to start Minecraft server: ${error.message}`);
        }
    }

    /**
     * Stop a process gracefully
     */
    async stopProcess(processName, timeout = 30000) {
        const processInfo = this.processes.get(processName);
        if (!processInfo) {
            throw new Error(`Process ${processName} not found`);
        }

        const { process: child, pid } = processInfo;

        return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                reject(new Error(`Process ${processName} did not stop within ${timeout}ms`));
            }, timeout);

            child.on('close', (code, signal) => {
                clearTimeout(timeoutId);
                resolve({ code, signal });
            });

            // Send graceful shutdown command for Minecraft server
            if (processName === 'minecraft-server') {
                try {
                    child.stdin.write('stop\n');
                } catch (error) {
                    // If stdin is not available, try SIGTERM
                    this.killProcess(processName, 'SIGTERM');
                }
            } else {
                // For other processes, send SIGTERM
                this.killProcess(processName, 'SIGTERM');
            }
        });
    }

    /**
     * Kill a process forcefully
     */
    killProcess(processName, signal = 'SIGKILL') {
        const processInfo = this.processes.get(processName);
        if (!processInfo) {
            throw new Error(`Process ${processName} not found`);
        }

        const { process: child, pid } = processInfo;

        try {
            if (this.isWindows) {
                // On Windows, use taskkill for force termination
                if (signal === 'SIGKILL') {
                    exec(`taskkill /F /PID ${pid}`, (error) => {
                        if (error) {
                            console.error(`Failed to kill process ${pid}:`, error);
                        }
                    });
                } else {
                    child.kill(signal);
                }
            } else {
                // On Unix systems, kill the process group to ensure all child processes are terminated
                if (child.pid) {
                    process.kill(-child.pid, signal);
                }
            }
        } catch (error) {
            console.error(`Failed to kill process ${processName}:`, error);
            throw error;
        }
    }

    /**
     * Send a command to a process
     */
    sendCommand(processName, command) {
        const processInfo = this.processes.get(processName);
        if (!processInfo) {
            throw new Error(`Process ${processName} not found`);
        }

        const { process: child } = processInfo;

        try {
            child.stdin.write(command + '\n');
            return true;
        } catch (error) {
            console.error(`Failed to send command to ${processName}:`, error);
            return false;
        }
    }

    /**
     * Get process status
     */
    getProcessStatus(processName) {
        const processInfo = this.processes.get(processName);
        if (!processInfo) {
            return { running: false };
        }

        const { pid, startTime, config, logFile, errorLogFile } = processInfo;

        // Check if process is still running
        const isRunning = this.isProcessRunning(pid);

        return {
            running: isRunning,
            pid: pid,
            startTime: startTime,
            uptime: Date.now() - startTime.getTime(),
            config: config,
            logFile: logFile,
            errorLogFile: errorLogFile
        };
    }

    /**
     * Check if a process is running by PID
     */
    isProcessRunning(pid) {
        try {
            if (this.isWindows) {
                // On Windows, use tasklist to check if process exists
                const result = require('child_process').execSync(`tasklist /FI "PID eq ${pid}"`, { encoding: 'utf8' });
                return result.includes(pid.toString());
            } else {
                // On Unix systems, send signal 0 to check if process exists
                process.kill(pid, 0);
                return true;
            }
        } catch (error) {
            return false;
        }
    }

    /**
     * Get all running processes managed by this manager
     */
    getAllProcesses() {
        const result = {};
        for (const [name, info] of this.processes.entries()) {
            result[name] = this.getProcessStatus(name);
        }
        return result;
    }

    /**
     * Clean up orphaned processes
     */
    cleanup() {
        for (const [name, info] of this.processes.entries()) {
            if (!this.isProcessRunning(info.pid)) {
                this.processes.delete(name);
            }
        }
    }

    /**
     * Get system resource usage
     */
    async getSystemStats() {
        const stats = {
            platform: os.platform(),
            arch: os.arch(),
            cpus: os.cpus().length,
            totalMemory: os.totalmem(),
            freeMemory: os.freemem(),
            uptime: os.uptime(),
            loadAverage: os.loadavg()
        };

        // Get process-specific stats if available
        for (const [name, info] of this.processes.entries()) {
            if (this.isProcessRunning(info.pid)) {
                try {
                    const processStats = await this.getProcessStats(info.pid);
                    stats[`${name}_stats`] = processStats;
                } catch (error) {
                    console.error(`Failed to get stats for ${name}:`, error);
                }
            }
        }

        return stats;
    }

    /**
     * Get process-specific statistics
     */
    async getProcessStats(pid) {
        return new Promise((resolve, reject) => {
            if (this.isWindows) {
                // On Windows, use wmic to get process information
                exec(`wmic process where processid=${pid} get PageFileUsage,WorkingSetSize /format:csv`, (error, stdout) => {
                    if (error) {
                        reject(error);
                        return;
                    }
                    
                    try {
                        const lines = stdout.trim().split('\n');
                        const data = lines[1].split(',');
                        resolve({
                            memoryUsage: parseInt(data[1]) * 1024, // Convert KB to bytes
                            virtualMemory: parseInt(data[2]) * 1024
                        });
                    } catch (parseError) {
                        reject(parseError);
                    }
                });
            } else {
                // On Unix systems, use ps to get process information
                exec(`ps -p ${pid} -o pid,pcpu,pmem,vsz,rss --no-headers`, (error, stdout) => {
                    if (error) {
                        reject(error);
                        return;
                    }
                    
                    try {
                        const parts = stdout.trim().split(/\s+/);
                        resolve({
                            pid: parseInt(parts[0]),
                            cpuPercent: parseFloat(parts[1]),
                            memoryPercent: parseFloat(parts[2]),
                            virtualMemory: parseInt(parts[3]) * 1024, // Convert KB to bytes
                            memoryUsage: parseInt(parts[4]) * 1024
                        });
                    } catch (parseError) {
                        reject(parseError);
                    }
                });
            }
        });
    }

    /**
     * Create a backup of important files
     */
    async createBackup(processName) {
        const processInfo = this.processes.get(processName);
        if (!processInfo) {
            throw new Error(`Process ${processName} not found`);
        }

        const { config } = processInfo;
        const workingDir = config.workingDir || path.join(__dirname, '..', 'minecraft-server');
        const backupDir = path.join(__dirname, '..', 'backups');
        
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupPath = path.join(backupDir, `backup-${timestamp}`);
        
        // Create backup directory
        fs.mkdirSync(backupPath, { recursive: true });

        // Files to backup
        const filesToBackup = [
            'server.properties',
            'whitelist.json',
            'ops.json',
            'banned-players.json',
            'banned-ips.json'
        ];

        const backedUpFiles = [];

        for (const file of filesToBackup) {
            const sourcePath = path.join(workingDir, file);
            const destPath = path.join(backupPath, file);
            
            if (fs.existsSync(sourcePath)) {
                fs.copyFileSync(sourcePath, destPath);
                backedUpFiles.push(file);
            }
        }

        // Backup world directory if it exists
        const worldDir = path.join(workingDir, 'world');
        if (fs.existsSync(worldDir)) {
            const worldBackupDir = path.join(backupPath, 'world');
            await this.copyDirectory(worldDir, worldBackupDir);
            backedUpFiles.push('world/');
        }

        return {
            backupPath: backupPath,
            timestamp: timestamp,
            files: backedUpFiles
        };
    }

    /**
     * Recursively copy a directory
     */
    async copyDirectory(source, destination) {
        if (!fs.existsSync(destination)) {
            fs.mkdirSync(destination, { recursive: true });
        }

        const items = fs.readdirSync(source);

        for (const item of items) {
            const sourcePath = path.join(source, item);
            const destPath = path.join(destination, item);
            
            const stat = fs.statSync(sourcePath);
            
            if (stat.isDirectory()) {
                await this.copyDirectory(sourcePath, destPath);
            } else {
                fs.copyFileSync(sourcePath, destPath);
            }
        }
    }
}

module.exports = ProcessManager;