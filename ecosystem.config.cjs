const fs = require("fs");
const path = require("path");

function readPortFromEnvFile() {
  try {
    const envPath = path.join(__dirname, ".env");
    if (!fs.existsSync(envPath)) return "3100";
    const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
    for (const line of lines) {
      const match = /^DOCMATCH_PORT\s*=\s*["']?(\d+)["']?/.exec(line.trim());
      if (match && match[1]) return match[1];
    }
  } catch {
    // Fallback to default port
  }
  return "3100";
}

const port = process.env.DOCMATCH_PORT || readPortFromEnvFile();

module.exports = {
  apps: [
    {
      name: "docmatch",
      cwd: __dirname,
      script: path.join(__dirname, "node_modules", "next", "dist", "bin", "next"),
      args: `start -H 127.0.0.1 -p ${port}`,
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production",
        PORT: port,
        HOSTNAME: "127.0.0.1",
        AUTH_TRUST_HOST: "true",
      },
    },
  ],
};
