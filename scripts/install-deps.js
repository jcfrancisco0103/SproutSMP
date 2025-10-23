#!/usr/bin/env node

const { spawn, exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const isWindows = os.platform() === 'win32';
const isLinux = os.platform() === 'linux';

console.log('🚀 Minecraft Server Wrapper - Dependency Installer');
console.log('='.repeat(50));

async function checkCommand(command, args = []) {
    return new Promise((resolve) => {
        const child = spawn(command, args, { stdio: 'pipe' });
        child.on('close', (code) => {
            resolve(code === 0);
        });
        child.on('error', () => {
            resolve(false);
        });
    });
}

async function execCommand(command) {
    return new Promise((resolve, reject) => {
        exec(command, (error, stdout, stderr) => {
            if (error) {
                reject({ error, stderr });
            } else {
                resolve(stdout);
            }
        });
    });
}

async function checkJava() {
    console.log('🔍 Checking Java installation...');
    
    const hasJava = await checkCommand('java', ['-version']);
    
    if (hasJava) {
        try {
            const output = await execCommand('java -version');
            console.log('✅ Java is installed');
            console.log('   Version info:', output.split('\n')[0]);
            return true;
        } catch (error) {
            console.log('⚠️  Java version check failed');
            return false;
        }
    } else {
        console.log('❌ Java is not installed or not in PATH');
        return false;
    }
}

async function installJava() {
    console.log('📦 Installing Java...');
    
    if (isWindows) {
        console.log('🪟 Windows detected');
        console.log('Please install Java manually from:');
        console.log('   - Oracle JDK: https://www.oracle.com/java/technologies/downloads/');
        console.log('   - OpenJDK: https://adoptium.net/');
        console.log('   - Or use Chocolatey: choco install openjdk');
        return false;
    } else if (isLinux) {
        console.log('🐧 Linux detected');
        
        // Try to detect package manager and install Java
        const hasApt = await checkCommand('apt', ['--version']);
        const hasYum = await checkCommand('yum', ['--version']);
        const hasDnf = await checkCommand('dnf', ['--version']);
        
        try {
            if (hasApt) {
                console.log('   Using apt package manager...');
                await execCommand('sudo apt update');
                await execCommand('sudo apt install -y openjdk-17-jdk');
            } else if (hasDnf) {
                console.log('   Using dnf package manager...');
                await execCommand('sudo dnf install -y java-17-openjdk-devel');
            } else if (hasYum) {
                console.log('   Using yum package manager...');
                await execCommand('sudo yum install -y java-17-openjdk-devel');
            } else {
                console.log('   No supported package manager found');
                console.log('   Please install Java manually');
                return false;
            }
            
            console.log('✅ Java installation completed');
            return true;
        } catch (error) {
            console.log('❌ Java installation failed:', error.stderr);
            return false;
        }
    } else {
        console.log('🍎 macOS detected');
        console.log('Please install Java manually from:');
        console.log('   - Oracle JDK: https://www.oracle.com/java/technologies/downloads/');
        console.log('   - OpenJDK: https://adoptium.net/');
        console.log('   - Or use Homebrew: brew install openjdk');
        return false;
    }
}

async function checkNode() {
    console.log('🔍 Checking Node.js installation...');
    
    const hasNode = await checkCommand('node', ['--version']);
    
    if (hasNode) {
        try {
            const version = await execCommand('node --version');
            const versionNumber = version.trim().substring(1); // Remove 'v' prefix
            const majorVersion = parseInt(versionNumber.split('.')[0]);
            
            console.log('✅ Node.js is installed');
            console.log('   Version:', version.trim());
            
            if (majorVersion >= 16) {
                console.log('   ✅ Version is compatible (>= 16.0.0)');
                return true;
            } else {
                console.log('   ⚠️  Version is too old (< 16.0.0)');
                console.log('   Please update Node.js to version 16 or higher');
                return false;
            }
        } catch (error) {
            console.log('⚠️  Node.js version check failed');
            return false;
        }
    } else {
        console.log('❌ Node.js is not installed or not in PATH');
        return false;
    }
}

async function checkNpm() {
    console.log('🔍 Checking npm installation...');
    
    const hasNpm = await checkCommand('npm', ['--version']);
    
    if (hasNpm) {
        try {
            const version = await execCommand('npm --version');
            console.log('✅ npm is installed');
            console.log('   Version:', version.trim());
            return true;
        } catch (error) {
            console.log('⚠️  npm version check failed');
            return false;
        }
    } else {
        console.log('❌ npm is not installed or not in PATH');
        return false;
    }
}

async function installNodeDependencies() {
    console.log('📦 Installing Node.js dependencies...');
    
    try {
        console.log('   Running npm install...');
        await execCommand('npm install');
        console.log('✅ Node.js dependencies installed successfully');
        return true;
    } catch (error) {
        console.log('❌ Failed to install Node.js dependencies:', error.stderr);
        return false;
    }
}

async function createDirectories() {
    console.log('📁 Creating necessary directories...');
    
    const directories = [
        'minecraft-server',
        'backups',
        'logs'
    ];
    
    for (const dir of directories) {
        const dirPath = path.join(__dirname, '..', dir);
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
            console.log(`   ✅ Created directory: ${dir}`);
        } else {
            console.log(`   ℹ️  Directory already exists: ${dir}`);
        }
    }
    
    return true;
}

async function checkSystemRequirements() {
    console.log('🔍 Checking system requirements...');
    
    const platform = os.platform();
    const arch = os.arch();
    const totalMemory = Math.round(os.totalmem() / (1024 * 1024 * 1024));
    
    console.log(`   Platform: ${platform}`);
    console.log(`   Architecture: ${arch}`);
    console.log(`   Total Memory: ${totalMemory} GB`);
    
    if (totalMemory < 2) {
        console.log('   ⚠️  Warning: Less than 2GB RAM detected');
        console.log('   Minecraft servers typically require at least 2GB RAM');
    } else {
        console.log('   ✅ Sufficient memory available');
    }
    
    return true;
}

async function checkFirewall() {
    console.log('🔍 Checking firewall configuration...');
    
    if (isWindows) {
        console.log('🪟 Windows Firewall:');
        console.log('   Please ensure the following ports are open:');
        console.log('   - Port 3000 (Web Interface)');
        console.log('   - Port 25565 (Minecraft Server - default)');
        console.log('   You may need to configure Windows Firewall manually');
    } else if (isLinux) {
        console.log('🐧 Linux Firewall:');
        
        const hasUfw = await checkCommand('ufw', ['--version']);
        const hasFirewalld = await checkCommand('firewall-cmd', ['--version']);
        
        if (hasUfw) {
            console.log('   UFW detected. To open ports, run:');
            console.log('   sudo ufw allow 3000');
            console.log('   sudo ufw allow 25565');
        } else if (hasFirewalld) {
            console.log('   firewalld detected. To open ports, run:');
            console.log('   sudo firewall-cmd --permanent --add-port=3000/tcp');
            console.log('   sudo firewall-cmd --permanent --add-port=25565/tcp');
            console.log('   sudo firewall-cmd --reload');
        } else {
            console.log('   No common firewall detected');
            console.log('   Please ensure ports 3000 and 25565 are open');
        }
    }
    
    return true;
}

async function createStartupScripts() {
    console.log('📝 Creating startup scripts...');
    
    if (isWindows) {
        const batchScript = `@echo off
echo Starting Minecraft Server Wrapper...
cd /d "%~dp0"
node server.js
pause`;
        
        fs.writeFileSync(path.join(__dirname, '..', 'start.bat'), batchScript);
        console.log('   ✅ Created start.bat');
        
        const serviceScript = `@echo off
echo Installing Minecraft Server Wrapper as Windows Service...
echo This requires administrative privileges.
echo.
echo Please run this script as Administrator to install the service.
echo.
pause

REM Install as Windows Service using nssm (Node.js Service Manager)
REM Download nssm from https://nssm.cc/download
REM nssm install MinecraftServerWrapper "%CD%\\node.exe" "%CD%\\server.js"
REM nssm set MinecraftServerWrapper AppDirectory "%CD%"
REM nssm start MinecraftServerWrapper`;
        
        fs.writeFileSync(path.join(__dirname, '..', 'install-service.bat'), serviceScript);
        console.log('   ✅ Created install-service.bat');
    } else {
        const bashScript = `#!/bin/bash
echo "Starting Minecraft Server Wrapper..."
cd "$(dirname "$0")"
node server.js`;
        
        fs.writeFileSync(path.join(__dirname, '..', 'start.sh'), bashScript);
        fs.chmodSync(path.join(__dirname, '..', 'start.sh'), '755');
        console.log('   ✅ Created start.sh');
        
        const systemdService = `[Unit]
Description=SproutSMP Wrapper
After=network.target

[Service]
Type=simple
User=${process.env.USER || 'root'}
WorkingDirectory=${path.join(__dirname, '..')}
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target`;
        
        fs.writeFileSync(path.join(__dirname, '..', 'sproutsmpwrapper.service'), systemdService);
        console.log('   ✅ Created sproutsmpwrapper.service');
        console.log('   To install as systemd service:');
        console.log('   sudo cp sproutsmpwrapper.service /etc/systemd/system/');
        console.log('   sudo systemctl enable sproutsmpwrapper');
        console.log('   sudo systemctl start sproutsmpwrapper');
    }
    
    return true;
}

async function main() {
    console.log('Starting dependency check and installation...\n');
    
    let allGood = true;
    
    // Check system requirements
    await checkSystemRequirements();
    console.log();
    
    // Check Node.js
    const nodeOk = await checkNode();
    if (!nodeOk) {
        console.log('Please install Node.js 16+ from https://nodejs.org/');
        allGood = false;
    }
    console.log();
    
    // Check npm
    const npmOk = await checkNpm();
    if (!npmOk && nodeOk) {
        console.log('npm should be included with Node.js installation');
        allGood = false;
    }
    console.log();
    
    // Install Node.js dependencies
    if (nodeOk && npmOk) {
        const depsOk = await installNodeDependencies();
        if (!depsOk) {
            allGood = false;
        }
        console.log();
    }
    
    // Check Java
    const javaOk = await checkJava();
    if (!javaOk) {
        const installed = await installJava();
        if (!installed) {
            allGood = false;
        }
    }
    console.log();
    
    // Create directories
    await createDirectories();
    console.log();
    
    // Check firewall
    await checkFirewall();
    console.log();
    
    // Create startup scripts
    await createStartupScripts();
    console.log();
    
    // Final summary
    console.log('='.repeat(50));
    if (allGood) {
        console.log('🎉 Installation completed successfully!');
        console.log();
        console.log('Next steps:');
        console.log('1. Place your Minecraft server.jar in the minecraft-server directory');
        console.log('2. Run the server wrapper:');
        if (isWindows) {
            console.log('   - Double-click start.bat, or');
            console.log('   - Run: node server.js');
        } else {
            console.log('   - Run: ./start.sh, or');
            console.log('   - Run: node server.js');
        }
        console.log('3. Open http://localhost:3000 in your browser');
        console.log('4. Login with username: admin, password: admin123');
        console.log('5. Configure your server settings and start your Minecraft server!');
    } else {
        console.log('⚠️  Installation completed with warnings');
        console.log('Please resolve the issues above before running the server wrapper');
    }
    console.log('='.repeat(50));
}

// Run the installer
main().catch(console.error);