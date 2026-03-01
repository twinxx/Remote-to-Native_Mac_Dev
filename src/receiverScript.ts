/**
 * Cloud-to-Native Mac Streamer: Local Receiver (Server Mode with Auto-Tunneling)
 */
export const RECEIVER_SCRIPT = `
// 📦 의존성 자동 설치 로직
try {
  require.resolve('ws');
} catch (e) {
  const { execSync } = require('child_process');
  console.log("📦 'ws' 라이브러리가 없습니다. 자동 설치를 시작합니다...");
  try {
    execSync('npm init -y', { stdio: 'inherit' });
    execSync('npm install ws', { stdio: 'inherit' });
    console.log("✅ 'ws' 설치 완료!");
  } catch (err) {
    console.error("❌ 자동 설치 실패. 수동으로 'npm install ws'를 실행해 주세요.");
    process.exit(1);
  }
}

const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const { exec, execSync } = require('child_process');

const PORT = 8080;
const wss = new WebSocket.Server({ port: PORT });

console.log("\\n🚀 Mac Receiver Server is starting on port " + PORT);
console.log("🛠 Current Directory: " + __dirname);

// 자동 터널링 기능 (localtunnel)
function startTunnel() {
  console.log("📡 Opening public tunnel (via npx localtunnel)...");
  
  // npx -y 를 사용하여 승인 프롬프트를 건너뜁니다.
  const lt = exec('npx -y localtunnel --port ' + PORT);

  lt.stdout.on('data', (data) => {
    const rawData = data.toString();
    // 🔍 URL 추출 (더 유연하게)
    const urlMatch = rawData.match(/https?:\/\/[^\s]+/);
    if (urlMatch) {
      printSuccessBox(urlMatch[0]);
    } else {
      console.log("LT: " + rawData.trim());
    }
  });

  lt.stderr.on('data', (data) => {
    const rawData = data.toString();
    // 🔍 stderr에서도 URL이 나올 수 있음
    const urlMatch = rawData.match(/https?:\/\/[^\s]+/);
    if (urlMatch) {
      printSuccessBox(urlMatch[0]);
    } else {
      console.log("LT [log]: " + rawData.trim());
    }
  });

  lt.on('close', (code) => {
    console.log("📡 Tunnel process exited with code " + code);
    console.log("📡 Retrying in 5 seconds...");
    setTimeout(startTunnel, 5000);
  });
}

function printSuccessBox(url) {
  console.log("\\n" + "=".repeat(60));
  console.log("🌐 EXTERNAL ACCESS URL FOUND!");
  console.log("🔗 URL: " + url);
  console.log("💡 브라우저에서 위 주소를 열고 'Click to Continue'를 누르세요.");
  console.log("=".repeat(60) + "\\n");
}

startTunnel();

let activeConnections = 0;
let screenInterval = null;

wss.on('connection', (ws) => {
  console.log('📡 UI/서버와 연결되었습니다.');
  activeConnections++;
  
  if (activeConnections === 1 && !screenInterval) {
    screenInterval = setInterval(() => {
      try {
        const tmpPath = '/tmp/ai-studio-screen.jpg';
        execSync('screencapture -x -C -t jpg ' + tmpPath);
        const img = fs.readFileSync(tmpPath);
        const payload = JSON.stringify({
          type: 'SCREEN_FRAME',
          data: img.toString('base64')
        });
        
        // Broadcast to all connected UI clients
        wss.clients.forEach(client => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(payload);
          }
        });
      } catch (e) {}
    }, 400); // 400ms 간격(2.5 FPS)으로 완화하여 CPU/메모리 및 송신 부하 대폭 감소
  }

  ws.on('message', (data) => {
    try {
      const payload = JSON.parse(data);
      if (payload.type === 'FILE_UPDATE') {
        const fullPath = path.join(__dirname, payload.path);
        const dir = path.dirname(fullPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(fullPath, payload.content);
        console.log('✅ 파일 동기화:', payload.path);
        
        if (payload.path.endsWith('.auto_package.sh')) {
           triggerBuild(payload.path, null, ws);
        }
      }
      
      if (payload.type === 'SYNC_MANIFEST') {
        const manifest = payload.manifest || [];
        console.log('📋 SYNC_MANIFEST 수신: ' + manifest.length + '개 항목');
        const toRequest = [];
        
        manifest.forEach(item => {
          const fullPath = path.join(__dirname, item.path);
          let needsUpdate = false;
          
          if (!fs.existsSync(fullPath)) {
            needsUpdate = true;
          } else {
            const stats = fs.statSync(fullPath);
            // 소수점 mtime 정밀도 문제 방지를 위해 Math.abs 비교 (1초 이내 오차 허용 또는 mtimeMs 직접 비교)
            // Node stats.mtimeMs와 서버의 mtimeMs 비교
            if (stats.size !== item.size || Math.abs(stats.mtimeMs - item.mtime) > 100) {
              needsUpdate = true;
            }
          }
          
          if (needsUpdate) toRequest.push(item.path);
        });

        // Save the project name context for auto-building later
        ws.lastSyncProject = payload.project || null;
        
        if (toRequest.length > 0) {
          console.log('🔄 ' + toRequest.length + '개 파일 업데이트 필요. 요청 중...');
          ws.send(JSON.stringify({
            type: 'REQUEST_FILES',
            paths: toRequest
          }));
        } else {
          console.log('✅ 모든 파일이 최신 상태입니다.');
          ws.send(JSON.stringify({ type: 'BUILD_LOG', message: '✅ All files are up to date.' }));
          
          // If no files needed updating, we might still want to trigger a build if requested
          if (ws.lastSyncProject) {
              console.log('🚀 [Auto-Build] 동기화할 파일이 없습니다. 즉시 빌드를 시작합니다: ' + ws.lastSyncProject);
              let projectPath = path.join(__dirname, 'native_mac_dev', ws.lastSyncProject);
              if (!fs.existsSync(projectPath)) projectPath = path.join(__dirname, ws.lastSyncProject);
              triggerBuild(null, projectPath, ws);
              ws.lastSyncProject = null;
          }
        }
      }

      if (payload.type === 'SYNC_COMPLETE') {
         console.log('✅ [Auto-Build] ' + payload.count + '개 파일 동기화 완료!');
         if (ws.lastSyncProject) {
             console.log('🚀 [Auto-Build] 동기화 완료 후 자동 빌드를 시작합니다: ' + ws.lastSyncProject);
             let projectPath = path.join(__dirname, 'native_mac_dev', ws.lastSyncProject);
             if (!fs.existsSync(projectPath)) projectPath = path.join(__dirname, ws.lastSyncProject);
             triggerBuild(null, projectPath, ws);
             ws.lastSyncProject = null;
         }
      }
      
      if (payload.type === 'REQUEST_BUILD') {
        process.stdout.write('🛠 빌드 요청 수신: ' + payload.project + '\\n');
        let projectPath = path.join(__dirname, 'native_mac_dev', payload.project);
        if (!fs.existsSync(projectPath)) projectPath = path.join(__dirname, payload.project);
        
        triggerBuild(null, projectPath, ws);
      }
      
      if (payload.type === 'REQUEST_KILL_APP') {
        const appName = payload.project;
        if (appName) {
          process.stdout.write('🛑 앱 강제 종료 요청 수신: ' + appName + '\\n');
          exec('pkill -i -f "' + appName + '"', (error) => {
             // pkill returns error if no process found, we don't care.
             ws.send(JSON.stringify({ type: 'BUILD_LOG', message: '🛑 Sent kill signal to ' + appName + ' (or related processes).' }));
          });
        }
      }
    } catch (e) {}
  });

  ws.on('close', () => {
    console.log('📡 연결이 끊어졌습니다.');
    activeConnections--;
    if (activeConnections <= 0) {
      activeConnections = 0;
      if (screenInterval) {
        clearInterval(screenInterval);
        screenInterval = null;
      }
    }
  });
});

function triggerBuild(filePath, forcedRoot, ws) {
  let projectRoot = forcedRoot;
  if (!projectRoot && filePath) {
    let currentDir = path.dirname(path.join(__dirname, filePath));
    while (currentDir !== path.dirname(__dirname)) {
      if (fs.existsSync(path.join(currentDir, 'Package.swift')) || fs.existsSync(path.join(currentDir, 'package.json'))) {
        projectRoot = currentDir;
        break;
      }
      const parent = path.dirname(currentDir);
      if (parent === currentDir) break;
      currentDir = parent;
    }
  }

  if (projectRoot) {
    const autoBuildScript = path.join(projectRoot, '.auto_package.sh');
    const customBuildScript = path.join(projectRoot, 'build.sh');
    let scriptToRun = fs.existsSync(customBuildScript) ? customBuildScript : (fs.existsSync(autoBuildScript) ? autoBuildScript : null);

    if (scriptToRun) {
      console.log('⚙️ 빌드 실행 중:', scriptToRun);
      ws.send(JSON.stringify({ type: 'BUILD_LOG', message: '🤖 Executing ' + path.basename(scriptToRun) }));
      try { fs.chmodSync(scriptToRun, '755'); } catch (e) {}
      
      const child = exec('bash "' + scriptToRun + '"', { cwd: projectRoot });
      let zipPath = null;
      child.stdout.on('data', (d) => {
        const msg = d.toString();
        ws.send(JSON.stringify({ type: 'BUILD_LOG', message: msg }));
        const match = msg.match(/📦 ZIP_READY:\s*(.+)/);
        if (match) zipPath = match[1].trim();
      });
      child.stderr.on('data', (d) => ws.send(JSON.stringify({ type: 'BUILD_LOG', message: d.toString() })));
      child.on('close', (code) => {
        if (code === 0) {
          ws.send(JSON.stringify({ type: 'BUILD_SUCCESS' }));
          if (zipPath && fs.existsSync(zipPath)) {
            const projectName = path.basename(projectRoot);
            ws.send(JSON.stringify({ type: 'RECEIVE_ZIP_START', project: projectName }));
            const stats = fs.statSync(zipPath);
            let readBytes = 0;
            const CHUNK_SIZE = 1024 * 512; // 512 KB
            const stream = fs.createReadStream(zipPath, { highWaterMark: CHUNK_SIZE });
            stream.on('data', (chunk) => {
               ws.send(JSON.stringify({ type: 'RECEIVE_ZIP_CHUNK', project: projectName, chunk: chunk.toString('base64') }));
               readBytes += chunk.length;
               process.stdout.write('\\r📦 Uploading ZIP: ' + Math.round((readBytes/stats.size)*100) + '%');
            });
            stream.on('end', () => {
               console.log('\\n✅ Upload complete!');
               ws.send(JSON.stringify({ type: 'RECEIVE_ZIP_COMPLETE', project: projectName }));
            });
          }
        } else {
          ws.send(JSON.stringify({ type: 'BUILD_ERROR', message: 'Exit code ' + code }));
        }
      });
    }
  }
}
`;
