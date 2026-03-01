import express from "express";
import { createServer as createViteServer } from "vite";
import { WebSocketServer, WebSocket } from "ws";
import { readFileSync, writeFileSync, readdirSync, lstatSync, existsSync, mkdirSync, createWriteStream } from "fs";
import { join, relative } from "path";
import stream from "stream";

function generateBuildScript(project: string) {
  console.log(`[DEBUG] generateBuildScript called for project: ${project}`);
  // Try finding project in root or native_mac_dev
  let projectRoot = join(process.cwd(), "native_mac_dev", project);
  if (!existsSync(projectRoot)) {
    projectRoot = join(process.cwd(), project);
  }

  if (!existsSync(projectRoot)) {
    console.error(`[DEBUG] ❌ Project root not found: ${projectRoot}`);
    return;
  }

  // Let's assume it's a swift project if Package.swift exists
  const isSwift = existsSync(join(projectRoot, "Package.swift"));
  console.log(`[DEBUG] isSwift for ${project}: ${isSwift}, path: ${join(projectRoot, "Package.swift")}`);
  if (!isSwift) return;

  let config = {
    appName: project,
    fullTitle: project,
    bundleId: `com.native.${project.toLowerCase()}`,
    binName: ""
  };

  const configPath = join(projectRoot, 'app-config.json');
  if (existsSync(configPath)) {
    try {
      const userConfig = JSON.parse(readFileSync(configPath, 'utf8'));
      config = { ...config, ...userConfig };
    } catch (e) { }
  }

  if (!config.binName) {
    try {
      const packageSwift = readFileSync(join(projectRoot, 'Package.swift'), 'utf8');
      const match = packageSwift.match(/name:\s*"([^"]+)"/);
      if (match) config.binName = match[1];
    } catch (e) { }
  }

  const BIN_NAME = config.binName || config.appName;
  const APP_NAME = config.appName;
  const FULL_TITLE = config.fullTitle;

  const shellScript = `#!/usr/bin/env bash
set -e

echo "🚀 Starting Swift Build for ${BIN_NAME} (Release)..."
swift build -c release

echo "📦 Creating App Bundle Structure for ${APP_NAME}.app..."
BUILD_DIR="build"
APP_DIR="$BUILD_DIR/${APP_NAME}.app"
CONTENTS_DIR="$APP_DIR/Contents"
MACOS_DIR="$CONTENTS_DIR/MacOS"
RESOURCES_DIR="$CONTENTS_DIR/Resources"

rm -rf "$BUILD_DIR"
mkdir -p "$MACOS_DIR" "$RESOURCES_DIR"

echo "🔍 Searching for binary: ${BIN_NAME}..."
# First, try to get the path directly from Swift
SPM_BIN_PATH=$(swift build -c release --show-bin-path 2>/dev/null || echo "")
echo "📂 SPM Suggestion: $SPM_BIN_PATH"

# Robust, case-insensitive binary detection across the whole .build folder (excluding debug symbols and derived data)
BINARY_SOURCE=$(find .build -type f -iname "${BIN_NAME}" 2>/dev/null | grep -i -v "\.dSYM" | grep -v "derived-data" | head -n 1)

if [ -z "$BINARY_SOURCE" ] && [ -n "$SPM_BIN_PATH" ] && [ -d "$SPM_BIN_PATH" ]; then
    BINARY_SOURCE=$(find "$SPM_BIN_PATH" -type f -iname "${BIN_NAME}" 2>/dev/null | head -n 1)
fi

if [ -z "$BINARY_SOURCE" ]; then
    echo "❌ Error: Binary ${BIN_NAME} not found anywhere in .build/"
    echo "📂 Directory structure of .build (Depth 4):"
    find .build -maxdepth 4 -not -path '*/.*' 2>/dev/null || echo "Could not list .build"
    exit 1
fi

echo "✅ Found binary at: $BINARY_SOURCE"

echo "📂 Assembling App Bundle..."
cp "$BINARY_SOURCE" "$MACOS_DIR/${APP_NAME}"

# Copy Resources/Bundles
echo "📦 Copying Resources..."
find "$SPM_BIN_PATH" -name "*.bundle" -type d -exec cp -R {} "$RESOURCES_DIR/" \\; 2>/dev/null || true

ICON_SOURCE="Resources/AppIcon.png"
if [ -f "$ICON_SOURCE" ]; then
    echo "🎨 Generating App Icons..."
    ICONSET_DIR="Resources/AppIcon.iconset"
    mkdir -p "$ICONSET_DIR"
    for SIZE in 16 32 64 128 256 512 1024; do
        HALF_SIZE=$((SIZE/2))
        if [ $SIZE -le 512 ]; then sips -z $SIZE $SIZE "$ICON_SOURCE" --out "$ICONSET_DIR/icon_\${SIZE}x\${SIZE}.png" >/dev/null 2>&1 || true; fi
        if [ $SIZE -ge 32 ]; then sips -z $SIZE $SIZE "$ICON_SOURCE" --out "$ICONSET_DIR/icon_\${HALF_SIZE}x\${HALF_SIZE}@2x.png" >/dev/null 2>&1 || true; fi
    done
    iconutil -c icns "$ICONSET_DIR" -o "$RESOURCES_DIR/AppIcon.icns" || true
    rm -rf "$ICONSET_DIR"
fi

echo "📄 Creating Info.plist..."
cat << 'EOF_PLIST' > "$CONTENTS_DIR/Info.plist"
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key>
    <string>${APP_NAME}</string>
    <key>CFBundleIdentifier</key>
    <string>${config.bundleId}</string>
    <key>CFBundleName</key>
    <string>${FULL_TITLE}</string>
    <key>CFBundleDisplayName</key>
    <string>${FULL_TITLE}</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleShortVersionString</key>
    <string>1.0</string>
    <key>CFBundleIconFile</key>
    <string>AppIcon</string>
    <key>LSMinimumSystemVersion</key>
    <string>13.0</string>
    <key>NSHighResolutionCapable</key>
    <true/>
</dict>
</plist>
EOF_PLIST

echo "APPL????" > "$CONTENTS_DIR/PkgInfo"

echo "🚀 Opening the App..."
# Check if the app bundle exists before opening
if [ -d "$PWD/$APP_DIR" ]; then
    open "$PWD/$APP_DIR" || true
else
    echo "⚠️ Warning: Application bundle not found at $PWD/$APP_DIR"
fi

echo "🗜 Compressing App Bundle..."
cd "$BUILD_DIR"
if [ -d "${APP_NAME}.app" ]; then
    zip -q -r "${APP_NAME}.zip" "${APP_NAME}.app"
    ZIP_PATH="$PWD/${APP_NAME}.zip"
    echo "✅ Packaging Complete: $PWD/${APP_NAME}.app"
    echo "📦 ZIP_READY: $ZIP_PATH"
else
    echo "❌ Error: Packaging failed, ${APP_NAME}.app does not exist in build directory."
fi
`;

  const outputPath = join(projectRoot, '.auto_package.sh');
  writeFileSync(outputPath, shellScript);
  console.log(`[DEBUG] ✅ Generated .auto_package.sh at ${outputPath}`);
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  const downloadsDir = join(process.cwd(), ".gemini", "downloads");
  if (!existsSync(downloadsDir)) mkdirSync(downloadsDir, { recursive: true });
  const activeDownloads = new Map<string, stream.Writable>();

  // API Routes
  app.get("/api/projects", (req, res) => {
    const rootPath = process.cwd();
    const nativePath = join(rootPath, "native_mac_dev");

    // Find directories in root (excluding known non-project folders)
    const rootProjects = readdirSync(rootPath).filter(f =>
      lstatSync(join(rootPath, f)).isDirectory() &&
      !['node_modules', '.git', 'src', '.gemini', '.system_generated', 'public', 'build', 'dist'].includes(f) &&
      (existsSync(join(rootPath, f, 'Package.swift')) || existsSync(join(rootPath, f, 'package.json')))
    );

    // Find directories in src/native_mac_dev
    let srcProjects: string[] = [];
    if (existsSync(nativePath)) {
      srcProjects = readdirSync(nativePath).filter(f =>
        lstatSync(join(nativePath, f)).isDirectory()
      );
    }

    const projects = Array.from(new Set([...rootProjects, ...srcProjects]));
    res.json({ projects });
  });

  app.get("/api/download/:project", (req, res) => {
    const project = req.params.project;
    const zipPath = join(downloadsDir, `${project}.zip`);
    if (existsSync(zipPath)) {
      res.download(zipPath, `${project}.zip`);
    } else {
      res.status(404).json({ error: "Download not found or not yet built." });
    }
  });

  app.get("/api/files/:project", (req, res) => {
    const project = req.params.project;
    let projectPath = join(process.cwd(), "native_mac_dev", project);
    if (!existsSync(projectPath)) projectPath = join(process.cwd(), project);

    if (!existsSync(projectPath)) return res.json({ files: [] });

    // Ensure the build script exists for this project *before* sending file list
    generateBuildScript(project);

    const getFiles = (dir: string): any[] => {
      return readdirSync(dir).flatMap(file => {
        const path = join(dir, file);
        if (lstatSync(path).isDirectory()) {
          if (file === 'node_modules' || file === '.build' || file === '.git' || file === 'build') return [];
          return getFiles(path);
        }
        return [{
          name: file,
          path: relative(projectPath, path), // Relative to project root
          projectRelativePath: relative(process.cwd(), path), // Relative to overall workspace
          size: lstatSync(path).size,
          mtime: lstatSync(path).mtime
        }];
      });
    };
    res.json({ files: getFiles(projectPath) });
  });

  // Vite middleware
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  // Fallback for SPA components (Must be after API and Vite middlewares)
  app.use(async (req, res, next) => {
    if (req.method !== 'GET' || req.headers.accept?.indexOf('text/html') === -1) {
      return next();
    }
    const url = req.originalUrl;
    try {
      const template = readFileSync(join(process.cwd(), "index.html"), "utf-8");
      const html = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).send(html);
    } catch (e: any) {
      vite.ssrFixStacktrace(e);
      res.status(500).end(e.stack);
    }
  });

  // WebSocket Server
  const wss = new WebSocketServer({ server, path: "/ws" });
  let receiverSocket: WebSocket | null = null;

  const broadcastStatus = () => {
    const status = JSON.stringify({
      type: "SYSTEM_STATUS",
      receiverConnected: receiverSocket !== null && receiverSocket.readyState === WebSocket.OPEN
    });
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) client.send(status);
    });
  };

  const broadcastToUI = (msg: string | Buffer) => {
    wss.clients.forEach(client => {
      // Don't send back to the receiver if it's connected as a client
      if (client !== receiverSocket && client.readyState === WebSocket.OPEN) {
        client.send(msg.toString());
      }
    });
  };

  const handleMessage = (ws: WebSocket, data: any, rawMessage: string) => {
    console.log(`📩 Received message: ${data.type}`);

    // Identify as Native Mac VM - Legacy inbound
    if (data.type === "RECEIVER_AUTH") {
      console.log("✅ Native Mac VM Authenticated (Inbound)");
      receiverSocket = ws;
      broadcastStatus();
      return;
    }

    // Connect to Native Mac VM - New outbound tunnel
    if (data.type === "CONNECT_MAC") {
      if (receiverSocket) {
        receiverSocket.close();
        receiverSocket = null;
      }
      console.log("📡 Attempting outbound connection to Native Mac VM:", data.url);

      try {
        // Normalize URL: localtunnel gives https, but we need wss/ws for WebSocket client in Node
        let targetUrl = data.url.replace('https://', 'wss://').replace('http://', 'ws://');
        if (!targetUrl.startsWith('ws')) targetUrl = 'ws://' + targetUrl;

        console.log(`🔗 Connecting to: ${targetUrl} (with bypass headers)`);

        const tunnelWs = new WebSocket(targetUrl, {
          headers: {
            "Bypass-Tunnel-Hint": "true",
            "Bypass-Tunnel-Reminder": "true",
            "User-Agent": "Mozilla/5.0"
          },
          handshakeTimeout: 10000
        });

        tunnelWs.on("open", () => {
          console.log("✅ Native Mac VM Authenticated (Outbound Tunnel)");
          receiverSocket = tunnelWs;
          broadcastStatus();

          // Send auth success so Mac knows we connected
          tunnelWs.send(JSON.stringify({ type: "RECEIVER_AUTH_SUCCESS" }));
        });

        tunnelWs.on("message", (macMsg) => {
          const messageStr = macMsg.toString();
          try {
            const macData = JSON.parse(messageStr);
            handleMessage(tunnelWs, macData, messageStr);
          } catch (e) {
            broadcastToUI(messageStr);
          }
        });

        tunnelWs.on("close", () => {
          console.log("❌ Native Mac VM Disconnected (Outbound Tunnel)");
          if (receiverSocket === tunnelWs) {
            receiverSocket = null;
            broadcastStatus();
            // Clean up any dangling streams
            for (const [proj, stream] of activeDownloads.entries()) {
              stream.end();
              activeDownloads.delete(proj);
              console.log(`🧹 Cleaned up dangling stream for ${proj} due to tunnel disconnect.`);
            }
          }
        });

        tunnelWs.on("error", (err) => {
          console.error("❌ Tunnel Error:", err.message);
          ws.send(JSON.stringify({ type: "BUILD_ERROR", message: `Tunnel connection failed: ${err.message}` }));
        });
      } catch (e: any) {
        ws.send(JSON.stringify({ type: "BUILD_ERROR", message: `Invalid tunnel URL: ${e.message}` }));
      }
      return;
    }

    if (data.type === "REQUEST_SYNC_ALL") {
      console.log("📥 Received REQUEST_SYNC_ALL from UI");
      if (receiverSocket && receiverSocket.readyState === WebSocket.OPEN) {
        console.log("🔄 Starting Smart Sync (Manifest Comparison)...");
        sendSyncManifest(receiverSocket);
      } else {
        console.error("❌ Cannot sync: receiver not connected.");
        ws.send(JSON.stringify({ type: "BUILD_ERROR", message: "Receiver not connected for sync." }));
      }
      return;
    }

    if (data.type === "REQUEST_FILES") {
      const paths: string[] = data.paths || [];
      console.log(`📡 Sending ${paths.length} requested files to receiver...`);
      paths.forEach(p => {
        try {
          const fullPath = join(process.cwd(), p);
          if (existsSync(fullPath)) {
            const content = readFileSync(fullPath, "utf-8");
            receiverSocket?.send(JSON.stringify({
              type: "FILE_UPDATE",
              path: p,
              content: content
            }));
          }
        } catch (e) { }
      });
      receiverSocket?.send(JSON.stringify({ type: "SYNC_COMPLETE", count: paths.length }));
      return;
    }

    if (data.type === "SCREEN_FRAME" || data.type === "BUILD_SUCCESS" || data.type === "BUILD_ERROR" || data.type === "BUILD_LOG" || data.type === "ZIP_READY") {
      broadcastToUI(rawMessage);
      return;
    }

    if (data.type === "RECEIVE_ZIP_START") {
      const zipPath = join(downloadsDir, `${data.project}.zip`);
      console.log(`📥 Starting to receive ZIP for ${data.project}...`);
      const wsStream = createWriteStream(zipPath);
      activeDownloads.set(data.project, wsStream);
      broadcastToUI(JSON.stringify({ type: 'BUILD_LOG', message: `📥 Receiving ZIP stream for ${data.project}...` }));
      return;
    }

    if (data.type === "RECEIVE_ZIP_CHUNK") {
      const wsStream = activeDownloads.get(data.project);
      if (wsStream && data.chunk) {
        wsStream.write(Buffer.from(data.chunk, 'base64'));
      }
      return;
    }

    if (data.type === "RECEIVE_ZIP_COMPLETE") {
      console.log(`✅ ZIP completely received for ${data.project}`);
      const wsStream = activeDownloads.get(data.project);
      if (wsStream) {
        wsStream.end();
        activeDownloads.delete(data.project);
      }
      ws.send(JSON.stringify({ type: 'BUILD_LOG', message: `✅ Package downloaded to sync server: ${data.project}.zip` }));
      broadcastToUI(JSON.stringify({ type: 'ZIP_READY', project: data.project }));
      return;
    }

    if (data.type === "REQUEST_BUILD") {
      if (data.project) {
        generateBuildScript(data.project);

        // Find where the script was actually created
        let scriptPath = join(process.cwd(), "native_mac_dev", data.project, ".auto_package.sh");
        if (!existsSync(scriptPath)) scriptPath = join(process.cwd(), data.project, ".auto_package.sh");

        if (existsSync(scriptPath)) {
          console.log(`📡 Sending updated .auto_package.sh to receiver: ${scriptPath}`);
          const content = readFileSync(scriptPath, "utf-8");
          if (receiverSocket && receiverSocket.readyState === WebSocket.OPEN) {
            receiverSocket.send(JSON.stringify({
              type: "FILE_UPDATE",
              path: relative(process.cwd(), scriptPath),
              content: content
            }));
          }
        }
      }

      // Wait a small delay to ensure FILE_UPDATE is parsed by receiver before REQUEST_BUILD
      setTimeout(() => {
        if (receiverSocket && receiverSocket.readyState === WebSocket.OPEN) {
          receiverSocket.send(rawMessage);
        }
      }, 300);
      return;
    }
  };

  wss.on("connection", (ws) => {
    console.log("New Client Connected");

    ws.on("message", (message) => {
      const messageStr = message.toString();
      try {
        const data = JSON.parse(messageStr);
        handleMessage(ws, data, messageStr);
      } catch (e) {
        console.error("JSON Parse Error:", e);
      }
    });

    ws.on("close", () => {
      if (ws === receiverSocket) {
        console.log("❌ Native Mac VM Disconnected");
        receiverSocket = null;
        broadcastStatus();
        // Clean up any dangling streams
        for (const [proj, stream] of activeDownloads.entries()) {
          stream.end();
          activeDownloads.delete(proj);
          console.log(`🧹 Cleaned up dangling stream for ${proj} due to socket close.`);
        }
      }
    });

    // Send initial status
    broadcastStatus();
  });

  function sendSyncManifest(ws: WebSocket) {
    const getManifest = (dir: string): any[] => {
      const items: any[] = [];
      if (!existsSync(dir)) return [];
      const list = readdirSync(dir, { withFileTypes: true });
      for (const entry of list) {
        const res = join(dir, entry.name);
        if (entry.name === ".build" || entry.name === "build" || entry.name === "node_modules" || entry.name === ".git" || entry.name === ".DS_Store") continue;

        try {
          const stats = lstatSync(res);
          if (entry.isDirectory()) {
            items.push(...getManifest(res));
          } else {
            items.push({
              path: relative(process.cwd(), res),
              size: stats.size,
              mtime: stats.mtimeMs
            });
          }
        } catch (e) { }
      }
      return items;
    };

    try {
      const manifest: any[] = [];
      const nativeDevPath = join(process.cwd(), "native_mac_dev");

      // 1. native_mac_dev 폴더 스캔
      if (existsSync(nativeDevPath)) {
        const nativeFolders = readdirSync(nativeDevPath, { withFileTypes: true }).filter(f => f.isDirectory());
        nativeFolders.forEach(f => {
          if (existsSync(join(nativeDevPath, f.name, 'Package.swift'))) {
            generateBuildScript(f.name); // Ensure script exists before manifesting
          }
        });
        manifest.push(...getManifest(nativeDevPath));
        console.log(`🔍 [Sync] Scanned native_mac_dev. Found ${manifest.length} items.`);
      }

      // 2. root 에 있는 단일 프로젝트들도 스캔
      const rootFolders = readdirSync(process.cwd(), { withFileTypes: true }).filter(f =>
        f.isDirectory() &&
        !['node_modules', '.git', 'src', '.gemini', '.system_generated', 'public', 'build', 'dist', 'native_mac_dev'].includes(f.name)
      );

      rootFolders.forEach(f => {
        if (existsSync(join(process.cwd(), f.name, 'Package.swift')) || existsSync(join(process.cwd(), f.name, 'package.json'))) {
          generateBuildScript(f.name); // Ensure script exists before manifesting
          manifest.push(...getManifest(join(process.cwd(), f.name)));
        }
      });

      ws.send(JSON.stringify({
        type: "SYNC_MANIFEST",
        manifest: manifest
      }));
      console.log(`✅ Sent manifest with ${manifest.length} items.`);
    } catch (err) {
      console.error("Manifest Error:", err);
    }
  }
}

startServer();
