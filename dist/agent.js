"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startAgent = startAgent;
const si = __importStar(require("systeminformation"));
const axios_1 = __importDefault(require("axios"));
const os = __importStar(require("os"));
async function collectMetrics() {
    try {
        const [cpu, mem, disk, net, processes] = await Promise.all([
            si.currentLoad(),
            si.mem(),
            si.fsSize(),
            si.networkStats(),
            si.processes()
        ]);
        return {
            hostname: os.hostname(),
            cpu_percent: Math.round(cpu.currentLoad),
            memory: {
                total: mem.total,
                available: mem.available,
                used: mem.used,
                percent: Math.round((mem.used / mem.total) * 100)
            },
            disk: disk.map(d => ({
                fs: d.fs,
                type: d.type,
                size: d.size,
                used: d.used,
                available: d.available,
                use_percent: d.use
            })),
            network: net.map(n => ({
                iface: n.iface,
                rx_bytes: n.rx_bytes,
                tx_bytes: n.tx_bytes
            })),
            processes: processes.list.slice(0, 10).map(p => ({
                pid: p.pid,
                name: p.name,
                cpu: p.cpu,
                mem: p.mem
            }))
        };
    }
    catch (err) {
        console.error('Failed to collect metrics:', err);
        return {
            hostname: os.hostname(),
            cpu_percent: 0,
            memory: {},
            disk: [],
            network: [],
            processes: []
        };
    }
}
async function postWithRetries(url, payload, retries = 3) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const response = await axios_1.default.post(url, payload, { timeout: 5000 });
            console.log(`Agent posted metrics: ${response.status}`);
            return true;
        }
        catch (err) {
            const error = err;
            console.error(`Attempt ${attempt}: Failed to send metrics`, error.message);
            if (attempt < retries) {
                await new Promise(resolve => setTimeout(resolve, attempt * 1500));
            }
        }
    }
    return false;
}
async function startAgent(config) {
    console.log(`Agent mode | Server: ${config.serverUrl}`);
    console.log(`Heartbeat interval: ${config.heartbeatInterval}s`);
    const agentLoop = async () => {
        const metrics = await collectMetrics();
        const payload = {
            api_key: config.apiKey,
            metrics
        };
        const url = `${config.serverUrl}/api/agent/update`;
        const success = await postWithRetries(url, payload, 3);
        if (!success) {
            console.warn('Failed to deliver metrics after retries');
        }
    };
    // Initial send
    await agentLoop();
    // Periodic sends
    setInterval(agentLoop, config.heartbeatInterval * 1000);
}
