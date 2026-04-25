const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = 3000;
const DB_FILE = path.join(__dirname, 'database.json');
const BACKUP_DIR = path.join(__dirname, 'backups');

// 1. ENSURE BACKUP DIRECTORY EXISTS
if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR);
}

// 2. AUTO-BACKUP ON STARTUP
function performStartupBackup() {
    if (fs.existsSync(DB_FILE)) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupPath = path.join(BACKUP_DIR, `backup_${timestamp}.json`);
        fs.copyFileSync(DB_FILE, backupPath);
        console.log(`🛡️  Startup Backup Created: ${backupPath}`);
        
        // Keep only last 10 backups
        const files = fs.readdirSync(BACKUP_DIR).sort();
        if (files.length > 10) {
            fs.unlinkSync(path.join(BACKUP_DIR, files[0]));
        }
    }
}

app.use(cors());
app.use(express.json({ limit: '100mb' })); // Large limit for massive inventories
app.use(express.static(__dirname));

// Health Check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', database: fs.existsSync(DB_FILE) });
});

// Load data
app.get('/api/load', (req, res) => {
    if (!fs.existsSync(DB_FILE)) {
        return res.json({}); // Return empty if file doesn't exist yet
    }
    fs.readFile(DB_FILE, 'utf8', (err, data) => {
        if (err) {
            console.error('❌ Error reading database file:', err);
            return res.status(500).json({ error: 'Failed to read database' });
        }
        try {
            res.json(JSON.parse(data || '{}'));
        } catch (e) {
            console.error('❌ Database file is corrupted! Restoring from latest backup recommended.');
            res.status(500).json({ error: 'Database corruption detected' });
        }
    });
});

// Save data
app.post('/api/save', (req, res) => {
    const data = req.body;
    // Atomic Write: Write to temp file then rename it to avoid data loss on crash
    const TEMP_FILE = DB_FILE + '.tmp';
    fs.writeFile(TEMP_FILE, JSON.stringify(data, null, 2), 'utf8', (err) => {
        if (err) {
            console.error('❌ Error writing temp file:', err);
            return res.status(500).json({ error: 'Failed to save database' });
        }
        fs.rename(TEMP_FILE, DB_FILE, (err) => {
            if (err) {
                console.error('❌ Error renaming temp file:', err);
                return res.status(500).json({ error: 'Failed to finalize save' });
            }
            console.log(`[${new Date().toLocaleTimeString()}] 💾 Database auto-saved.`);
            res.json({ success: true });
        });
    });
});

app.listen(PORT, () => {
    performStartupBackup();
    console.log(`\n🚀 DOTSYSTEM 100% OFFLINE ENGINE ACTIVE`);
    console.log(`📡 Local API: http://localhost:${PORT}`);
    console.log(`📂 Database: ${DB_FILE}`);
    console.log(`🛡️  Auto-Backups: ${BACKUP_DIR}`);
    console.log(`🛑 KEEP THIS CONSOLE OPEN TO SAVE DATA.\n`);
});
