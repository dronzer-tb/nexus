"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkDependencies = checkDependencies;
async function checkDependencies(mode) {
    // For Node.js, dependencies are checked at require/import time
    // This is a placeholder for consistency with Python version
    console.log(`Checking dependencies for mode: ${mode}`);
    const requiredPackages = {
        agent: ['systeminformation', 'axios'],
        server: ['express', 'ws', 'bcrypt'],
        both: ['express', 'ws', 'bcrypt', 'systeminformation', 'axios']
    };
    const packages = requiredPackages[mode] || requiredPackages.both;
    const missing = [];
    for (const pkg of packages) {
        try {
            require.resolve(pkg);
        }
        catch {
            missing.push(pkg);
        }
    }
    if (missing.length > 0) {
        console.error(`Missing packages: ${missing.join(', ')}`);
        console.error('Run: npm install');
        process.exit(1);
    }
}
