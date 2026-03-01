import React, { useState } from 'react';
import { motion, AnimatePresence, useScroll, useSpring } from 'motion/react';
import { Dashboard } from './Dashboard';
import {
  Code2, ArrowRight, Zap, PenTool, CheckCircle2,
  Monitor, Smartphone, Server, Layers, PlayCircle,
  Laptop, AlertTriangle, Terminal, ChevronDown,
  Sparkles, Network, Cpu, Share2, Box, Globe,
  Activity, Command, Database, ShieldCheck, Download, XCircle
} from 'lucide-react';
import { RECEIVER_SCRIPT } from './receiverScript';


const App: React.FC = () => {
  const [view, setView] = useState<'landing' | 'dashboard'>('dashboard');
  const [activeTab, setActiveTab] = useState<'architecture' | 'roadmap' | 'code' | 'remote' | 'monitor'>('monitor');
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'done'>('idle');
  const [buildStatus, setBuildStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [remoteScreen, setRemoteScreen] = useState<string | null>(null);
  const [logs, setLogs] = useState<{ time: string, msg: string, type: 'info' | 'error' | 'success' }[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isReceiverConnected, setIsReceiverConnected] = useState(false);
  const [isZipReady, setIsZipReady] = useState(false);
  const prevConnectedRef = React.useRef(false);

  React.useEffect(() => {
    if (isReceiverConnected && !prevConnectedRef.current) {
      // Auto-sync on connect
      handleSyncAll();
    }
    prevConnectedRef.current = isReceiverConnected;
  }, [isReceiverConnected]);
  const [projects, setProjects] = useState<string[]>([]);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [projectFiles, setProjectFiles] = useState<any[]>([]);
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 100, damping: 30 });

  const roadmap = [
    {
      title: "Phase 1: Zero-Setup Vibe Coding",
      status: "ready",
      tasks: ["개발 환경 없는 기기(iPad, Web) 지원", "AI Studio / 안티그래비티 / VS Code 연동", "프론트엔드 기반 코드 에디터 UI"]
    },
    {
      title: "Phase 2: 단일 중앙 빌드 서버 구축",
      status: "ready",
      tasks: ["UTM macOS 가상 머신 세팅", "Swift PM / Xcode CLI 자동화", "다이나믹 .app 패키징 엔진"]
    },
    {
      title: "Phase 3: 실시간 동기화 & 스트리밍",
      status: "ready",
      tasks: ["WebSocket 기반 초고속 파일 동기화", "빌드 로그 실시간 터널링", "WebRTC 화면 캡처 송출"]
    },
    {
      title: "Phase 4: 리버스 컨트롤 & 배포",
      status: "in-progress",
      tasks: ["원격 화면 마우스/키보드 제어", "패키징된 앱 클라우드 다운로드", "멀티 프로젝트 격리 환경"]
    }
  ];

  const [serverSocket, setServerSocket] = useState<WebSocket | null>(null);
  const serverSocketRef = React.useRef<WebSocket | null>(null);

  React.useEffect(() => {
    const fetchProjects = async () => {
      try {
        const res = await fetch('/api/projects');
        const data = await res.json();
        setProjects(data.projects);
        if (data.projects.length > 0 && !selectedProject) {
          setSelectedProject(data.projects[0]);
        }
      } catch (e) { }
    };
    fetchProjects();
  }, []);

  React.useEffect(() => {
    if (!selectedProject) return;
    const fetchFiles = async () => {
      try {
        const res = await fetch(`/api/files/${selectedProject}`);
        const data = await res.json();
        setProjectFiles(data.files);
      } catch (e) { }
    };
    fetchFiles();
  }, [selectedProject, lastSyncTime]);

  React.useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);

    ws.onopen = () => {
      console.log("Connected to Cloud Server");
      serverSocketRef.current = ws;
      setServerSocket(ws);
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'SYSTEM_STATUS') {
        setIsReceiverConnected(data.receiverConnected);
      }
      if (data.type === 'SCREEN_FRAME') {
        setRemoteScreen(`data:image/jpeg;base64,${data.data}`);
        setIsStreaming(true);
      }
      if (data.type === 'BUILD_SUCCESS') {
        setBuildStatus('success');
        setLogs((prev: any) => [{ time: new Date().toLocaleTimeString(), msg: 'Build Succeeded! Assembling and receiving ZIP...', type: 'success' }, ...prev].slice(0, 50));
      }
      if (data.type === 'ZIP_READY') {
        setIsZipReady(true);
        setLogs((prev: any) => [{ time: new Date().toLocaleTimeString(), msg: '📦 ZIP is fully downloaded and ready!', type: 'success' }, ...prev].slice(0, 50));
      }
      if (data.type === 'BUILD_ERROR') {
        setBuildStatus('error');
        setLogs((prev: any) => [{ time: new Date().toLocaleTimeString(), msg: `Build Failed: ${data.message}`, type: 'error' }, ...prev].slice(0, 50));
      }
      if (data.type === 'BUILD_LOG') {
        setLogs((prev: any) => [{ time: new Date().toLocaleTimeString(), msg: data.message, type: 'info' }, ...prev].slice(0, 50));
      }
      if (data.type === 'FILE_UPDATE') {
        setLastSyncTime(new Date().toLocaleTimeString());
        setLogs((prev: any) => [{ time: new Date().toLocaleTimeString(), msg: `Live synced file: ${data.path}`, type: 'info' }, ...prev].slice(0, 50));
      }
    };

    ws.onclose = () => {
      console.log("Cloud Server disconnected");
      setServerSocket(null);
      serverSocketRef.current = null;
    };

    return () => ws.close();
  }, []);

  const handleSyncAll = () => {
    if (serverSocket && serverSocket.readyState === WebSocket.OPEN) {
      setSyncStatus('syncing');
      serverSocket.send(JSON.stringify({ type: 'REQUEST_SYNC_ALL' }));
      // Notice: we don't handle sync results here; we handle them in the main onmessage!
      // But we can set syncStatus to 'done' when SYSTEM_STATUS or similar arrives or after some time.
      setTimeout(() => setSyncStatus('idle'), 3000); // Temporary
    } else {
      setLogs((prev: any) => [{ time: new Date().toLocaleTimeString(), msg: 'No Cloud Server connection.', type: 'error' }, ...prev].slice(0, 50));
    }
  };

  if (view === 'dashboard') {
    return <Dashboard
      syncStatus={syncStatus}
      buildStatus={buildStatus}
      lastSyncTime={lastSyncTime}
      remoteScreen={remoteScreen}
      logs={logs}
      isStreaming={isStreaming}
      isReceiverConnected={isReceiverConnected}
      isZipReady={isZipReady}
      projects={projects}
      selectedProject={selectedProject}
      setSelectedProject={setSelectedProject}
      projectFiles={projectFiles}
      handleSyncAll={handleSyncAll}
      setLogs={setLogs}
      setView={setView}
      macSocket={serverSocket}
      setMacSocket={() => { }} // Not needed anymore
      setIsReceiverConnected={setIsReceiverConnected}
      setRemoteScreen={setRemoteScreen}
      setIsStreaming={setIsStreaming}
      setBuildStatus={setBuildStatus}
      setIsZipReady={setIsZipReady}
    />;
  }

  return (
    <div className="min-h-screen bg-[#020203] text-slate-300 font-sans selection:bg-indigo-500/30 relative overflow-hidden">
      {/* Progress Bar */}
      <motion.div className="fixed top-0 left-0 right-0 h-1 bg-indigo-500 z-[100] origin-left" style={{ scaleX }} />

      {/* Grid Background */}
      <div className="fixed inset-0 z-0 opacity-20 pointer-events-none"
        style={{ backgroundImage: 'radial-gradient(#1e293b 1px, transparent 1px)', backgroundSize: '32px 32px' }} />

      <div className="relative z-10 flex flex-col min-h-screen">
        {/* Header */}
        <header className="border-b border-white/5 bg-black/40 backdrop-blur-xl sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="bg-indigo-600 p-2.5 rounded-xl shadow-lg shadow-indigo-500/20">
                <Share2 className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="font-display font-bold text-xl text-white tracking-tight">Remote-to-Native Mac DevTool</h1>
                <p className="text-[10px] text-slate-500 font-mono uppercase tracking-widest">Project Mission Control</p>
              </div>
            </div>
            <div className="hidden md:flex items-center gap-6">
              <nav className="flex items-center gap-1 bg-white/5 p-1 rounded-lg border border-white/10">
                {(['architecture', 'roadmap', 'code', 'remote', 'monitor'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-4 py-1.5 rounded-md text-xs font-medium transition-all ${activeTab === tab ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                  >
                    {tab.toUpperCase()}
                  </button>
                ))}
              </nav>
              <div className="h-8 w-px bg-white/10" />
              <button onClick={() => setView('dashboard')} className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md text-xs font-bold transition-colors shadow-lg shadow-emerald-500/20">
                OPEN WORKSPACE
              </button>
            </div>
          </div>
        </header>

        <main className="flex-grow max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-12">

          {/* Project Hero */}
          <section className="mb-20">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-3xl"
            >
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[10px] font-bold uppercase tracking-tighter mb-6">
                <Sparkles className="w-3 h-3" /> New Project Initiated
              </div>
              <h2 className="text-4xl md:text-6xl font-display font-extrabold text-white mb-6 leading-[1.1]">
                어디서든 <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-emerald-400">AI 바이브 코딩</span>,<br />
                빌드는 단일 개발 서버에서.
              </h2>
              <p className="text-lg text-slate-400 font-light leading-relaxed">
                개발 환경이 전혀 구축되지 않은 기기(웹 브라우저, 안티그래비티, VS Code 등)에서 AI와 함께 코드를 작성하세요.
                작성된 코드는 중앙 개발 서버(로컬 Mac)로 실시간 전송되어 자동으로 빌드되고 패키징됩니다.
              </p>
            </motion.div>
          </section>

          {/* Dynamic Content Based on Tab */}
          <AnimatePresence mode="wait">
            {activeTab === 'architecture' && (
              <motion.div
                key="arch"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="grid grid-cols-1 lg:grid-cols-3 gap-6"
              >
                {/* Architecture Card 1 */}
                <div className="lg:col-span-2 bg-white/[0.02] border border-white/10 rounded-3xl p-8 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-12 opacity-5 group-hover:opacity-10 transition-opacity">
                    <Network className="w-64 h-64 text-indigo-500" />
                  </div>
                  <h3 className="text-xl font-display font-bold text-white mb-8 flex items-center gap-2">
                    <Layers className="w-5 h-5 text-indigo-400" /> System Architecture
                  </h3>

                  <div className="flex flex-col md:flex-row items-center justify-between gap-8 relative z-10">
                    <div className="w-full md:w-40 p-6 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-center relative">
                      <div className="absolute -top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-indigo-600 text-[8px] font-bold rounded text-white whitespace-nowrap">VIBE CODING</div>
                      <Globe className="w-8 h-8 text-indigo-400 mx-auto mb-3" />
                      <p className="text-xs font-bold text-white">Any Editor</p>
                      <p className="text-[10px] text-slate-500 mt-1">AI Studio / VS Code</p>
                    </div>

                    <div className="flex flex-col items-center gap-2">
                      <ArrowRight className="hidden md:block w-6 h-6 text-indigo-500" />
                      <span className="text-[8px] font-bold text-indigo-500/50">FILE SYNC</span>
                    </div>

                    <div className="w-full md:w-48 p-6 rounded-2xl bg-white/5 border border-white/10 text-center relative">
                      <div className="absolute -top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-indigo-600 text-[8px] font-bold rounded text-white">SYNC SERVER</div>
                      <Server className="w-8 h-8 text-slate-400 mx-auto mb-3" />
                      <p className="text-xs font-bold text-white">Express Proxy</p>
                      <p className="text-[10px] text-slate-500 mt-1">WebSocket / Chokidar</p>

                      {/* Monitoring Points */}
                      <div className="absolute -right-2 top-1/2 -translate-y-1/2 flex flex-col gap-1">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" title="Server Active" />
                      </div>

                      {/* Reverse Path Indicator */}
                      <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center">
                        <div className="w-px h-6 bg-emerald-500/30 dashed" />
                        <div className="text-[8px] text-emerald-400 font-bold">SCREEN STREAM</div>
                      </div>
                    </div>

                    <div className="flex flex-col items-center gap-2">
                      <ArrowRight className="hidden md:block w-6 h-6 text-emerald-500 rotate-180" />
                      <span className="text-[8px] font-bold text-emerald-500/50">BUILD & VIEW</span>
                    </div>

                    <div className="w-full md:w-40 p-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-center relative">
                      <div className="absolute -top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-emerald-600 text-[8px] font-bold rounded text-white whitespace-nowrap">BUILD SERVER</div>
                      <Box className="w-8 h-8 text-emerald-400 mx-auto mb-3" />
                      <p className="text-xs font-bold text-white">Mac VM (UTM)</p>
                      <p className="text-[10px] text-slate-500 mt-1">Native Build & Package</p>

                      {/* Monitoring Points */}
                      <div className="absolute -left-2 top-1/2 -translate-y-1/2 flex flex-col gap-1">
                        <div className={`w-2 h-2 rounded-full ${isReceiverConnected ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-red-500'}`} title="Receiver Connection" />
                        <div className={`w-2 h-2 rounded-full ${buildStatus === 'success' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : buildStatus === 'error' ? 'bg-red-500' : 'bg-slate-600'}`} title="Build Status" />
                      </div>
                    </div>
                  </div>

                  <div className="mt-12 p-6 rounded-2xl bg-black/40 border border-white/5 text-sm text-slate-400 leading-relaxed">
                    <p>
                      <strong>동작 원리:</strong> 현재의 로컬 환경(웹 브라우저나 가벼운 IDE 등)에서 바이브 코딩으로 코드를 작성합니다.
                      작성된 코드는 WebSocket 미들웨어를 거쳐, 원격지에 있는 네이티브 개발 서버(Mac VM)로 즉시 동기화됩니다. 무거운 Xcode 빌드와 .app 패키징은 원격지에서 대신 수행되며 그 결과 화면과 로그를 지금의 로컬 화면으로 스트리밍합니다.
                    </p>
                  </div>
                </div>

                {/* Sidebar Info */}
                <div className="space-y-6">
                  <div className="bg-white/[0.02] border border-white/10 rounded-3xl p-6">
                    <h4 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                      <Cpu className="w-4 h-4 text-slate-400" /> VM Specifications
                    </h4>
                    <ul className="space-y-3 text-xs text-slate-500 font-mono">
                      <li className="flex justify-between border-b border-white/5 pb-2">
                        <span>Hypervisor</span>
                        <span className="text-slate-300">Apple Virtualization</span>
                      </li>
                      <li className="flex justify-between border-b border-white/5 pb-2">
                        <span>CPU Cores</span>
                        <span className="text-slate-300">4 Cores (Recommended)</span>
                      </li>
                      <li className="flex justify-between border-b border-white/5 pb-2">
                        <span>Memory</span>
                        <span className="text-slate-300">8GB+ RAM</span>
                      </li>
                      <li className="flex justify-between">
                        <span>Display</span>
                        <span className="text-slate-300">GPU Accelerated</span>
                      </li>
                    </ul>
                  </div>
                  <div className="bg-indigo-600/10 border border-indigo-500/20 rounded-3xl p-6">
                    <h4 className="text-sm font-bold text-indigo-300 mb-2 flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4" /> Security Note
                    </h4>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      클라우드와 로컬을 연결할 때는 반드시 Tailscale과 같은 WireGuard 기반 VPN을 사용하여 암호화된 터널을 구축해야 합니다.
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'roadmap' && (
              <motion.div
                key="roadmap"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                {roadmap.map((phase, i) => (
                  <div key={i} className="bg-white/[0.02] border border-white/10 rounded-2xl p-6 flex flex-col md:flex-row gap-6 items-start">
                    <div className="shrink-0 w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center font-display font-bold text-indigo-400">
                      0{i + 1}
                    </div>
                    <div className="flex-grow">
                      <div className="flex items-center gap-3 mb-4">
                        <h3 className="text-lg font-bold text-white">{phase.title}</h3>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${phase.status === 'ready' ? 'bg-emerald-500/10 text-emerald-400' : phase.status === 'in-progress' ? 'bg-indigo-500/10 text-indigo-400 animate-pulse' : 'bg-slate-800 text-slate-500'}`}>
                          {phase.status}
                        </span>
                      </div>
                      <div className="grid md:grid-cols-3 gap-3">
                        {phase.tasks.map((task, j) => (
                          <div key={j} className="flex items-center gap-2 text-xs text-slate-400 bg-black/20 p-3 rounded-lg border border-white/5">
                            <CheckCircle2 className={`w-3 h-3 ${phase.status === 'ready' ? 'text-emerald-500' : 'text-slate-600'}`} />
                            {task}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </motion.div>
            )}

            {activeTab === 'code' && (
              <motion.div
                key="code"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                <div className="rounded-2xl overflow-hidden border border-white/10 bg-[#0d0d0d]">
                  <div className="flex items-center px-4 py-3 border-b border-white/5 bg-white/[0.02] justify-between">
                    <div className="flex items-center gap-2 text-xs text-slate-500 font-mono">
                      <Terminal className="w-3 h-3" /> local-receiver.js (With Auto-Tunnel)
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest animate-pulse">Auto-Tunneling Enabled</div>
                      <button
                        onClick={() => {
                          const blob = new Blob([RECEIVER_SCRIPT], { type: 'text/javascript' });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = 'local-receiver.js';
                          document.body.appendChild(a);
                          a.click();
                          document.body.removeChild(a);
                          URL.revokeObjectURL(url);
                        }}
                        className="flex items-center gap-1.5 px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-bold transition-colors shadow-lg shadow-indigo-500/20"
                      >
                        <Download className="w-3 h-3" />
                        Download
                      </button>
                    </div>
                  </div>
                  <div className="p-6 font-mono text-xs text-slate-400 overflow-x-auto max-h-[400px] scrollbar-thin scrollbar-thumb-white/10">
                    <pre className="text-indigo-300">{RECEIVER_SCRIPT}</pre>
                  </div>
                </div>

                <div className="p-6 rounded-2xl bg-indigo-600/10 border border-indigo-500/20">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-sm font-bold text-indigo-300">사용 방법</h4>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={handleSyncAll}
                      disabled={syncStatus === 'syncing'}
                      className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${syncStatus === 'syncing' ? 'bg-slate-700 text-slate-400' :
                        syncStatus === 'done' ? 'bg-emerald-600 text-white' : 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
                        }`}
                    >
                      <Zap className={`w-3 h-3 ${syncStatus === 'syncing' ? 'animate-spin' : ''}`} />
                      {syncStatus === 'syncing' ? '동기화 중...' : syncStatus === 'done' ? '동기화 완료!' : '전체 파일 강제 동기화'}
                    </motion.button>
                  </div>
                  <ol className="text-xs text-slate-400 space-y-2 list-decimal pl-4 leading-relaxed">
                    <li>상단의 <b>Download</b> 버튼을 눌러 <code>local-receiver.js</code> 파일을 받으세요. (이 버전은 <b>Auto-Tunneling</b> 기능이 포함되어 있습니다.)</li>
                    <li>맥의 프로젝트 폴더(새 폴더인 경우 <code>npm init -y && npm i ws</code> 실행 필요)로 파일을 옮긴 뒤, 터미널에서 <code>node local-receiver.js</code>를 실행하세요.</li>
                    <li>실행 즉시 터미널에 <b>텍스트로 된 외부 접속 URL</b>(https://...)이 출력됩니다.</li>
                    <li>그 주소를 브라우저에서 한 번 열어 [Click to Continue]를 누른 뒤, 대시보드의 [Connect Mac] 주소창에 넣으면 끝!</li>
                  </ol>
                </div>
              </motion.div>
            )}

            {activeTab === 'remote' && (
              <motion.div
                key="remote"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                <div className="bg-white/[0.02] border border-white/10 rounded-3xl p-8 relative overflow-hidden">
                  <div className="flex items-center justify-between mb-8">
                    <h3 className="text-xl font-display font-bold text-white flex items-center gap-2">
                      <Monitor className="w-5 h-5 text-indigo-400" /> Remote Viewport
                    </h3>
                    <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold ${isStreaming ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                      }`}>
                      <div className={`w-1.5 h-1.5 rounded-full ${isStreaming ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                      {isStreaming ? 'LIVE STREAMING' : 'OFFLINE'}
                    </div>
                    {buildStatus !== 'idle' && (
                      <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold ${buildStatus === 'success' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                        }`}>
                        {buildStatus === 'success' ? 'BUILD SUCCESS' : 'BUILD FAILED'}
                      </div>
                    )}
                  </div>

                  {/* Remote Screen */}
                  <div className="aspect-video bg-black rounded-2xl border border-white/5 flex items-center justify-center relative group overflow-hidden">
                    {remoteScreen ? (
                      <img src={remoteScreen} alt="Remote Screen" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                    ) : (
                      <>
                        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent opacity-50" />
                        <div className="text-center relative z-10">
                          <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4 border border-white/10">
                            <PlayCircle className="w-8 h-8 text-slate-600" />
                          </div>
                          <p className="text-sm text-slate-500 font-mono">Waiting for Remote Stream...</p>
                          <p className="text-[10px] text-slate-600 mt-2">Connect your UTM macOS to start streaming</p>
                        </div>
                      </>
                    )}

                    {/* UI Overlay Simulation */}
                    <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="flex items-center gap-2 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10 text-[10px] font-mono">
                        <span className="text-slate-400">FPS:</span> <span className="text-emerald-400">0</span>
                        <span className="ml-2 text-slate-400">LATENCY:</span> <span className="text-emerald-400">0ms</span>
                      </div>
                      <button className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold transition-colors">
                        RECONNECT
                      </button>
                    </div>
                  </div>

                  <div className="mt-8 grid md:grid-cols-2 gap-6">
                    <div className="p-6 rounded-2xl bg-white/5 border border-white/10">
                      <h4 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                        <Zap className="w-4 h-4 text-amber-400" /> How it works
                      </h4>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        원격 맥(Native Mac)에서 실행 중인 앱의 화면을 실시간으로 캡처하여 WebRTC 프로토콜을 통해 당신의 로컬 프리뷰로 전송합니다.
                        이를 통해 원격지 접속 없이도 네이티브 앱의 UI와 인터랙션을 즉시 당신의 화면에서 확인할 수 있습니다.
                      </p>
                    </div>
                    <div className="p-6 rounded-2xl bg-white/5 border border-white/10">
                      <h4 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                        <Command className="w-4 h-4 text-indigo-400" /> Control Protocol
                      </h4>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        프리뷰 창에서의 마우스 클릭과 키보드 입력은 역방향(Reverse)으로 원격 맥에 전달되어,
                        마치 그 가상 머신을 내 눈앞에서 직접 제어하는 것과 같은 경험을 제공합니다.
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
            {activeTab === 'monitor' && (
              <motion.div
                key="monitor"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                {/* System Status Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-white/[0.02] border border-white/10 rounded-3xl p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-sm font-bold text-white flex items-center gap-2">
                        <Globe className="w-4 h-4 text-indigo-400" /> Local Sync Server
                      </h4>
                      <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[8px] font-bold uppercase">ACTIVE</span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                        <span>Uptime</span>
                        <span className="text-slate-300">99.9%</span>
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                        <span>Sync Port</span>
                        <span className="text-slate-300">3000 (WS)</span>
                      </div>
                      <button
                        disabled={!isZipReady}
                        onClick={() => {
                          if (isZipReady && selectedProject) {
                            window.open(`/api/download/${selectedProject}`, '_blank');
                          }
                        }}
                        className={`w-full mt-4 py-2 rounded-xl border text-[10px] font-bold transition-all flex items-center justify-center gap-1.5 ${isZipReady
                          ? 'bg-emerald-500/20 hover:bg-emerald-500/30 border-emerald-500/30 text-emerald-400'
                          : 'bg-white/5 border-white/5 text-slate-600 cursor-not-allowed'
                          }`}
                      >
                        <Download className="w-3.5 h-3.5" />
                        DOWNLOAD .ZIP
                      </button>
                    </div>
                  </div>

                  <div className="bg-white/[0.02] border border-white/10 rounded-3xl p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-sm font-bold text-white flex items-center gap-2">
                        <Laptop className="w-4 h-4 text-emerald-400" /> Native Mac Receiver
                      </h4>
                      <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase ${isReceiverConnected ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                        {isReceiverConnected ? 'CONNECTED' : 'DISCONNECTED'}
                      </span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                        <span>Last Sync</span>
                        <span className="text-slate-300">{lastSyncTime || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                        <span>OS</span>
                        <span className="text-slate-300">macOS (UTM)</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white/[0.02] border border-white/10 rounded-3xl p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-sm font-bold text-white flex items-center gap-2">
                        <Box className="w-4 h-4 text-indigo-400" /> Native Mac App
                      </h4>
                      <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase ${buildStatus === 'success' ? 'bg-emerald-500/10 text-emerald-400' : buildStatus === 'error' ? 'bg-red-500/10 text-red-400' : 'bg-slate-800 text-slate-500'}`}>
                        {buildStatus === 'success' ? 'BUILD OK' : buildStatus === 'error' ? 'BUILD FAIL' : 'IDLE'}
                      </span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                        <span>Framework</span>
                        <span className="text-slate-300">SwiftUI</span>
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                        <span>Build Tool</span>
                        <span className="text-slate-300">Swift PM</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 mt-4">
                        <button
                          onClick={() => {
                            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
                            const ws = new WebSocket(`${protocol}//${window.location.host}`);
                            ws.onopen = () => {
                              ws.send(JSON.stringify({ type: 'REQUEST_BUILD', project: selectedProject }));
                              ws.close();
                            };
                          }}
                          className="w-full py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-[10px] font-bold text-slate-300 transition-all flex items-center justify-center gap-1.5"
                        >
                          <PlayCircle className="w-3.5 h-3.5" />
                          FORCE REBUILD
                        </button>
                        <button
                          onClick={() => {
                            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
                            const ws = new WebSocket(`${protocol}//${window.location.host}`);
                            ws.onopen = () => {
                              ws.send(JSON.stringify({ type: 'REQUEST_KILL_APP', project: selectedProject }));
                              ws.close();
                            };
                          }}
                          className="w-full py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-[10px] font-bold text-rose-400 transition-all flex items-center justify-center gap-1.5"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          STOP APP
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Real-time Build Logs */}
                <div className="bg-[#0a0a0c] border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
                  <div className="px-6 py-4 border-b border-white/5 bg-white/[0.02] flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Terminal className="w-4 h-4 text-indigo-400" />
                      <h4 className="text-sm font-bold text-white">Live Build Logs</h4>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setLogs([])}
                        className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-[10px] text-slate-400 transition-colors mr-2"
                      >
                        CLEAR
                      </button>
                      <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-[10px] text-slate-500 font-mono uppercase">Streaming</span>
                    </div>
                  </div>
                  <div className="h-64 overflow-y-auto p-6 font-mono text-[11px] space-y-2 scrollbar-thin scrollbar-thumb-white/10">
                    {logs.length === 0 ? (
                      <div className="h-full flex items-center justify-center text-slate-600 italic">
                        No logs yet. Modify a file to trigger a build.
                      </div>
                    ) : (
                      logs.map((log, i) => (
                        <div key={i} className="flex gap-4 border-l-2 border-white/5 pl-4 py-1 hover:bg-white/[0.02] transition-colors">
                          <span className="text-slate-600 shrink-0">[{log.time}]</span>
                          <span className={`${log.type === 'error' ? 'text-red-400' :
                            log.type === 'success' ? 'text-emerald-400' : 'text-slate-300'
                            }`}>
                            {log.msg}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* File Sync Status Table */}
                <div className="bg-white/[0.02] border border-white/10 rounded-3xl overflow-hidden">
                  <div className="px-6 py-4 border-b border-white/5 bg-white/[0.01] flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <h4 className="text-sm font-bold text-white">Project File Sync Status</h4>
                      <select
                        value={selectedProject || ''}
                        onChange={(e) => setSelectedProject(e.target.value)}
                        className="bg-white/5 border border-white/10 rounded-lg text-[10px] px-2 py-1 text-slate-300 outline-none focus:border-indigo-500"
                      >
                        {projects.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono">Total: {projectFiles.length} Files</div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs font-mono">
                      <thead>
                        <tr className="text-slate-500 border-b border-white/5">
                          <th className="px-6 py-3 font-medium uppercase tracking-wider">File Name</th>
                          <th className="px-6 py-3 font-medium uppercase tracking-wider">Size</th>
                          <th className="px-6 py-3 font-medium uppercase tracking-wider">Sync Status</th>
                          <th className="px-6 py-3 font-medium uppercase tracking-wider">Last Sync</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {projectFiles.map((file, i) => (
                          <tr key={i} className="hover:bg-white/[0.01] transition-colors">
                            <td className="px-6 py-4 text-slate-200">{file.name}</td>
                            <td className="px-6 py-4 text-slate-400">{(file.size / 1024).toFixed(1)} KB</td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2 text-emerald-400">
                                <CheckCircle2 className="w-3 h-3" />
                                Synced
                              </div>
                            </td>
                            <td className="px-6 py-4 text-slate-500">{new Date(file.mtime).toLocaleTimeString()}</td>
                          </tr>
                        ))}
                        {projectFiles.length === 0 && (
                          <tr>
                            <td colSpan={4} className="px-6 py-8 text-center text-slate-600 italic">No files found in this project.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Troubleshooting / Note */}
          <section className="mt-20">
            <div className="p-8 rounded-3xl bg-amber-500/5 border border-amber-500/10">
              <div className="flex items-center gap-3 mb-4 text-amber-500">
                <AlertTriangle className="w-5 h-5" />
                <h4 className="font-bold">중요: 외부 네트워크와의 터널링 설정</h4>
              </div>
              <p className="text-sm text-slate-400 leading-relaxed">
                현재 로컬에서 구동 중인 이 서버(Sync Server)와 다른 네트워크 상에 위치한 원격 Mac VM을 서로 연결하기 위해서는 터널링이 필수적입니다.
                Mac 환경 또는 현재의 로컬 환경 중 한 곳을 Ngrok이나 Tailscale Funnel 등을 활용하여 퍼블릭하게 노출시켜야 WebSocket 통신이 성사됩니다.
              </p>
            </div>
          </section>

        </main>

        {/* Footer */}
        <footer className="border-t border-white/5 bg-black/40 py-12 mt-auto">
          <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center space-x-3 opacity-50">
              <Share2 className="w-5 h-5" />
              <span className="font-display font-bold text-lg">Remote-to-Native</span>
            </div>
            <div className="text-slate-600 text-[10px] font-mono uppercase tracking-widest">
              © 2026 MISSION CONTROL. ALL SYSTEMS GO.
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default App;