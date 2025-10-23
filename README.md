# Minecraft Server Management Web Interface

A cross-platform web-based management interface for Minecraft servers, compatible with both Ubuntu and Windows operating systems. Features a clean, user-friendly interface with real-time monitoring, file management, and comprehensive server control.

## 🚀 Features

### 🎮 Server Management
- **Start/Stop/Restart Controls**: Full server lifecycle management with status verification
- **Force Kill Option**: Emergency termination for unresponsive servers
- **Real-time Status Monitoring**: Live server status updates
- **Interactive Console**: Command input with history and real-time output

### 📊 Performance Monitoring
- **System Statistics**: CPU, Memory, Disk I/O, and Network monitoring
- **Real-time Graphs**: Visual performance data with Chart.js
- **Resource Usage Tracking**: Monitor server resource consumption
- **Uptime Monitoring**: Track server availability and performance

### 📁 File Management
- **Secure File Browser**: Navigate server files safely
- **Multi-file Operations**: Upload, download, rename, and delete files
- **Text Editor**: Edit configuration files directly in the browser
- **Directory Navigation**: Breadcrumb navigation with folder structure
- **Batch Operations**: Multi-select for efficient file management

### ⚙️ Configuration Management
- **Server Settings**: Customize startup parameters and JVM arguments
- **Memory Allocation**: Slider-based memory configuration (1MB - 32GB)
- **Aikar's Flags**: Toggle performance optimization flags
- **Configuration Backup**: Automatic backup and restore functionality
- **Version Control**: Track configuration changes with history

### 🔒 Security Features
- **Authentication System**: Secure login with session management
- **Rate Limiting**: Protection against brute force attacks
- **File Type Validation**: Secure file upload restrictions
- **Process Isolation**: Proper server process management
- **CORS Protection**: Cross-origin request security

## 📋 System Requirements

### Minimum Requirements
- **Operating System**: Windows 10+ or Ubuntu 18.04+
- **Memory**: 2GB RAM (4GB+ recommended)
- **Storage**: 1GB free space
- **Network**: Internet connection for initial setup

### Software Dependencies
- **Node.js**: Version 16.0.0 or higher
- **Java**: JDK/JRE 8 or higher (17+ recommended for modern Minecraft versions)
- **npm**: Included with Node.js installation

## 🛠️ Installation

### Automated Installation

1. **Clone or download the project**:
   ```bash
   git clone <repository-url>
   cd MyServerWrapper
   ```

2. **Run the automated installer**:
   ```bash
   node scripts/install-deps.js
   ```

   The installer will:
   - Check system requirements
   - Verify Node.js and Java installations
   - Install Node.js dependencies
   - Create necessary directories
   - Generate startup scripts
   - Provide firewall configuration guidance

### Manual Installation

#### Windows

1. **Install Node.js**:
   - Download from [nodejs.org](https://nodejs.org/)
   - Choose LTS version (16.0.0+)
   - Run installer with default settings

2. **Install Java**:
   - Download from [Oracle](https://www.oracle.com/java/technologies/downloads/) or [Adoptium](https://adoptium.net/)
   - Install JDK 17+ for best compatibility
   - Verify installation: `java -version`

3. **Install project dependencies**:
   ```cmd
   npm install
   ```

4. **Configure Windows Firewall**:
   - Open Windows Defender Firewall
   - Allow ports 3000 (web interface) and 25565 (Minecraft server)

#### Ubuntu/Linux

1. **Update system packages**:
   ```bash
   sudo apt update
   sudo apt upgrade -y
   ```

2. **Install Node.js**:
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```

3. **Install Java**:
   ```bash
   sudo apt install -y openjdk-17-jdk
   ```

4. **Install project dependencies**:
   ```bash
   npm install
   ```

5. **Configure firewall (UFW)**:
   ```bash
   sudo ufw allow 3000
   sudo ufw allow 25565
   sudo ufw enable
   ```

## 🚀 Quick Start

### 1. Prepare Minecraft Server

1. **Create server directory**:
   - Place your `server.jar` file in the `minecraft-server` directory
   - Ensure you have accepted the Minecraft EULA

2. **Accept EULA** (if first time):
   - Run the server once to generate `eula.txt`
   - Edit `eula.txt` and set `eula=true`

### 2. Start the Web Interface

#### Windows
```cmd
# Using batch file
start.bat

# Or directly with Node.js
node server.js
```

#### Linux
```bash
# Using shell script
./start.sh

# Or directly with Node.js
node server.js
```

### 3. Access the Interface

1. **Open your browser** and navigate to: `http://localhost:3000`
2. **Login** with default credentials:
   - Username: `admin`
   - Password: `admin123`
3. **Change default password** immediately after first login

### 4. Configure Your Server

1. **Navigate to Configuration tab**
2. **Set server jar filename** (e.g., `server.jar`)
3. **Adjust memory allocation** using the slider
4. **Enable Aikar's flags** for better performance (recommended)
5. **Save configuration**

### 5. Start Your Minecraft Server

1. **Go to Dashboard tab**
2. **Click "Start Server"**
3. **Monitor startup** in the console output
4. **Server will be available** on port 25565 (default)

## 📖 Usage Guide

### Dashboard

The main dashboard provides:
- **Server Status**: Current server state (Stopped/Starting/Running)
- **Quick Actions**: Start, Stop, Restart, Kill buttons
- **System Overview**: CPU, Memory, and uptime information
- **Recent Activity**: Latest server events and status changes

### Console

Interactive server console features:
- **Command Input**: Send commands directly to the server
- **Command History**: Use ↑/↓ arrows to navigate previous commands
- **Real-time Output**: Live server log display
- **Auto-scroll**: Automatically follows new output
- **Clear Function**: Clear console display (logs are preserved)

### File Manager

Comprehensive file management:
- **Navigation**: Click folders to navigate, use breadcrumbs to go back
- **Upload Files**: Drag & drop or click to upload multiple files
- **Download Files**: Click download icon to save files locally
- **Edit Files**: Click edit icon to modify text files in-browser
- **Delete Files**: Select files and use delete button (with confirmation)
- **Create Folders**: Use the "New Folder" button

### Performance Monitoring

Real-time system monitoring:
- **CPU Usage**: Live CPU utilization graph
- **Memory Usage**: RAM consumption tracking
- **Disk I/O**: Read/write operations monitoring
- **Network Traffic**: Data transfer statistics
- **Historical Data**: Performance trends over time

### Configuration

Server configuration management:
- **Basic Settings**: Server jar, memory allocation, startup parameters
- **Advanced Options**: Custom JVM arguments and server arguments
- **Performance Flags**: Aikar's flags for optimized performance
- **Backup/Restore**: Save and restore configuration presets
- **Version History**: Track configuration changes

## 🔧 Advanced Configuration

### Custom Server Arguments

Add custom arguments in the Configuration tab:

**JVM Arguments** (performance tuning):
```
-XX:+UseG1GC
-XX:MaxGCPauseMillis=200
-XX:+UnlockExperimentalVMOptions
```

**Server Arguments** (Minecraft-specific):
```
--port 25565
--max-players 20
--difficulty normal
```

### Environment Variables

Configure the web interface using environment variables:

```bash
# Server configuration
PORT=3000                    # Web interface port
SESSION_SECRET=your-secret   # Session encryption key
UPLOAD_MAX_SIZE=100mb       # Maximum file upload size

# Security settings
RATE_LIMIT_WINDOW=900000    # Rate limit window (15 minutes)
RATE_LIMIT_MAX=100          # Maximum requests per window

# Minecraft server settings
MC_SERVER_DIR=./minecraft-server  # Server directory path
MC_SERVER_JAR=server.jar         # Server jar filename
```

### Service Installation

#### Windows Service

1. **Install NSSM** (Non-Sucking Service Manager):
   - Download from [nssm.cc](https://nssm.cc/download)
   - Extract to a folder in your PATH

2. **Install service**:
   ```cmd
   nssm install MinecraftWrapper "C:\path\to\node.exe" "C:\path\to\server.js"
   nssm set MinecraftWrapper AppDirectory "C:\path\to\project"
   nssm start MinecraftWrapper
   ```

#### Linux Systemd Service

1. **Copy service file**:
   ```bash
   sudo cp minecraft-wrapper.service /etc/systemd/system/
   ```

2. **Enable and start service**:
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable minecraft-wrapper
   sudo systemctl start minecraft-wrapper
   ```

3. **Check service status**:
   ```bash
   sudo systemctl status minecraft-wrapper
   ```

## 🔒 Security Considerations

### Authentication

- **Change default credentials** immediately after installation
- **Use strong passwords** with mixed case, numbers, and symbols
- **Enable HTTPS** in production environments
- **Regular password updates** for enhanced security

### Network Security

- **Firewall Configuration**: Only open necessary ports
- **Reverse Proxy**: Use nginx/Apache for HTTPS termination
- **VPN Access**: Consider VPN for remote administration
- **IP Whitelisting**: Restrict access to trusted IP addresses

### File Security

- **Upload Restrictions**: Only allow necessary file types
- **Path Validation**: Prevent directory traversal attacks
- **File Permissions**: Ensure proper file system permissions
- **Regular Backups**: Maintain regular configuration and world backups

## 🐛 Troubleshooting

### Common Issues

#### Server Won't Start

**Symptoms**: Server fails to start, error in console
**Solutions**:
1. Verify Java installation: `java -version`
2. Check server jar file exists in minecraft-server directory
3. Ensure EULA is accepted (`eula=true` in eula.txt)
4. Verify sufficient memory allocation
5. Check server logs for specific error messages

#### Web Interface Not Accessible

**Symptoms**: Cannot connect to http://localhost:3000
**Solutions**:
1. Verify Node.js server is running
2. Check firewall settings (port 3000)
3. Ensure no other service is using port 3000
4. Check server logs for startup errors
5. Try accessing via IP address instead of localhost

#### File Upload Fails

**Symptoms**: Files cannot be uploaded through web interface
**Solutions**:
1. Check file size limits (default 100MB)
2. Verify file type restrictions
3. Ensure sufficient disk space
4. Check directory permissions
5. Review server logs for upload errors

#### Performance Issues

**Symptoms**: Slow server response, high resource usage
**Solutions**:
1. Increase memory allocation for Minecraft server
2. Enable Aikar's flags for better performance
3. Monitor system resources in Performance tab
4. Close unnecessary applications
5. Consider upgrading hardware

### Log Files

**Web Interface Logs**:
- Location: `logs/` directory
- Files: `minecraft-server-YYYY-MM-DD.log`

**Minecraft Server Logs**:
- Location: `minecraft-server/logs/` directory
- Files: `latest.log`, `debug.log`

**System Logs**:
- Windows: Event Viewer → Application Logs
- Linux: `/var/log/syslog` or `journalctl -u minecraft-wrapper`

### Getting Help

1. **Check logs** for specific error messages
2. **Review documentation** for configuration options
3. **Search issues** in the project repository
4. **Create detailed bug reports** with:
   - Operating system and version
   - Node.js and Java versions
   - Error messages and logs
   - Steps to reproduce the issue

## 📚 API Reference

### REST Endpoints

#### Authentication
- `POST /api/login` - User login
- `POST /api/logout` - User logout
- `GET /api/status` - Authentication status

#### Server Control
- `GET /api/server/status` - Get server status
- `POST /api/server/start` - Start server
- `POST /api/server/stop` - Stop server gracefully
- `POST /api/server/restart` - Restart server
- `POST /api/server/kill` - Force kill server
- `POST /api/server/command` - Send command to server

#### System Information
- `GET /api/system/stats` - Get system statistics
- `GET /api/system/performance` - Get performance data

#### File Management
- `GET /api/files` - List files in directory
- `POST /api/files/upload` - Upload files
- `GET /api/files/download/:path` - Download file
- `DELETE /api/files/:path` - Delete file

#### Configuration
- `GET /api/config` - Get server configuration
- `POST /api/config` - Update server configuration

### WebSocket Events

#### Client → Server
- `console-command` - Send command to server console
- `request-stats` - Request system statistics update

#### Server → Client
- `console-output` - Server console output
- `server-status` - Server status change
- `system-stats` - System statistics update
- `error` - Error message

## 🤝 Contributing

We welcome contributions to improve the Minecraft Server Management Web Interface!

### Development Setup

1. **Fork the repository**
2. **Clone your fork**:
   ```bash
   git clone https://github.com/yourusername/minecraft-server-wrapper.git
   ```
3. **Install dependencies**:
   ```bash
   npm install
   ```
4. **Start development server**:
   ```bash
   npm run dev
   ```

### Code Style

- Use **ESLint** for JavaScript linting
- Follow **Prettier** formatting rules
- Write **clear, descriptive comments**
- Use **meaningful variable names**
- Follow **existing code patterns**

### Pull Request Process

1. **Create feature branch**: `git checkout -b feature/your-feature`
2. **Make changes** with clear, atomic commits
3. **Test thoroughly** on both Windows and Linux
4. **Update documentation** if needed
5. **Submit pull request** with detailed description

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Aikar** for the optimized JVM flags
- **Chart.js** for performance visualization
- **Express.js** community for the robust web framework
- **Node.js** team for the runtime environment
- **Minecraft** community for inspiration and feedback

## 📞 Support

For support and questions:

1. **Documentation**: Check this README and inline code comments
2. **Issues**: Create detailed issue reports on GitHub
3. **Discussions**: Use GitHub Discussions for questions and ideas
4. **Community**: Join the Minecraft server administration community

---

**Happy server management!** 🎮✨