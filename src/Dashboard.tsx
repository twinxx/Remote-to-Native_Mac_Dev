import React from 'react';
import { RefreshCw, Play, Monitor, Download, FolderGit2, Activity, Terminal, XCircle } from 'lucide-react';

export const Dashboard = ({
  syncStatus, buildStatus, lastSyncTime, remoteScreen, logs,
  isStreaming, isReceiverConnected, isZipReady, projects, selectedProject,
  setSelectedProject, projectFiles, handleSyncAll, setLogs, setView,
  macSocket, setMacSocket, setIsReceiverConnected, setRemoteScreen, setIsStreaming, setBuildStatus, setIsZipReady
}: any) => {
  console.log("Dashboard Rendering with props:", { projects, isReceiverConnected, buildStatus });
  const [tunnelUrl, setTunnelUrl] = React.useState('ws://localhost:8080');

  const handleConnectMac = () => {
    if (!tunnelUrl) return;

    // We already have a socket to the Clooud Server in macSocket (renamed from serverSocket in App.tsx)
    if (macSocket && macSocket.readyState === WebSocket.OPEN) {
      console.log("Sending CONNECT_MAC to cloud server for URL:", tunnelUrl);
      macSocket.send(JSON.stringify({
        type: 'CONNECT_MAC',
        url: tunnelUrl.replace('https', 'wss').replace('http', 'ws')
      }));
    } else {
      setLogs((prev: any) => [{ time: new Date().toLocaleTimeString(), msg: 'Not connected to Cloud Server.', type: 'error' }, ...prev].slice(0, 50));
    }
  };

  return (
    <div className="h-screen w-screen bg-[#0a0a0a] text-slate-300 font-sans flex flex-col overflow-hidden">
      {/* Top Navigation / Status Bar */}
      <header className="h-14 border-b border-white/10 bg-[#111] flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-indigo-400 font-bold">
            <Activity className="w-5 h-5" />
            <span>Mission Control Workspace</span>
          </div>
          <div className="h-4 w-px bg-white/20" />
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Target Project:</span>
            <select
              value={selectedProject || ''}
              onChange={(e) => setSelectedProject(e.target.value)}
              className="bg-black border border-white/10 rounded px-2 py-1 text-xs text-white outline-none focus:border-indigo-500"
            >
              {projects.map((p: string) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="wss://your-mac.loca.lt"
                value={tunnelUrl}
                onChange={(e) => setTunnelUrl(e.target.value)}
                className="bg-black border border-white/10 rounded px-2 py-1 text-xs text-white outline-none focus:border-indigo-500 w-48"
              />
              <button
                onClick={handleConnectMac}
                className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-bold transition-colors"
              >
                Connect Mac
              </button>
            </div>
            <span className="text-[9px] text-slate-500">
              * If using localtunnel, open the URL in a browser first to bypass the warning.
            </span>
          </div>
          <div className="h-4 w-px bg-white/20" />
          <div className="flex items-center gap-4 text-xs font-mono">
            <div className="flex items-center gap-1.5">
              <div className={`w - 2 h - 2 rounded - full ${isReceiverConnected ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-red-500'} `} />
              <span className={isReceiverConnected ? 'text-emerald-400' : 'text-red-400'}>
                {isReceiverConnected ? 'VM CONNECTED' : 'VM OFFLINE'}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className={`w - 2 h - 2 rounded - full ${buildStatus === 'success' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : buildStatus === 'error' ? 'bg-red-500' : 'bg-slate-500'} `} />
              <span className="text-slate-400">BUILD: {buildStatus.toUpperCase()}</span>
            </div>
          </div>
          <div className="h-4 w-px bg-white/20" />
          <button onClick={() => setView('landing')} className="text-xs px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded border border-white/10 transition-colors">
            Show Intro Page
          </button>
        </div>
      </header>

      {/* Main Workspace */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar: Files & Artifacts */}
        <aside className="w-64 border-r border-white/10 bg-[#0f0f0f] flex flex-col shrink-0">
          <div className="p-3 border-b border-white/10 flex justify-between items-center bg-[#141414]">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Synced Files</span>
            <button onClick={handleSyncAll} className="text-indigo-400 hover:text-indigo-300 transition-colors" title="Force Sync All">
              <RefreshCw className={`w - 4 h - 4 ${syncStatus === 'syncing' ? 'animate-spin' : ''} `} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-0.5 scrollbar-thin scrollbar-thumb-white/10">
            {projectFiles.map((f: any, i: number) => (
              <div key={i} className="flex items-center gap-2 text-xs text-slate-400 p-1.5 hover:bg-white/5 rounded cursor-default transition-colors">
                <FolderGit2 className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <span className="truncate">{f.name}</span>
              </div>
            ))}
            {projectFiles.length === 0 && (
              <div className="text-xs text-slate-600 p-4 text-center italic">No files synced yet.</div>
            )}
          </div>

          {/* Artifacts Section */}
          <div className="p-4 border-t border-white/10 bg-[#141414]">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 block">Artifacts & Actions</span>
            <button
              disabled={!isZipReady}
              onClick={() => {
                if (isZipReady && selectedProject) {
                  window.open(`/api/download/${selectedProject}`, '_blank');
                }
              }}
              className={`w-full py-2 px-3 rounded flex items-center justify-center gap-2 text-xs font-bold transition-all ${isZipReady
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30'
                  : 'bg-white/5 text-slate-600 border border-white/5 cursor-not-allowed'
                }`}
            >
              <Download className="w-4 h-4" />
              Download .zip
            </button>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <button
                onClick={() => {
                  if (macSocket && macSocket.readyState === WebSocket.OPEN) {
                    setBuildStatus('idle');
                    setIsZipReady(false);
                    macSocket.send(JSON.stringify({ type: 'REQUEST_BUILD', project: selectedProject }));
                  } else {
                    setLogs((prev: any) => [{ time: new Date().toLocaleTimeString(), msg: 'Cannot build: Not connected to Mac Server', type: 'error' }, ...prev].slice(0, 50));
                  }
                }}
                className="w-full py-2 px-3 rounded flex items-center justify-center gap-2 text-xs font-bold transition-all bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30"
              >
                <Play className="w-4 h-4" />
                Force Rebuild
              </button>

              <button
                onClick={() => {
                  if (macSocket && macSocket.readyState === WebSocket.OPEN) {
                    macSocket.send(JSON.stringify({ type: 'REQUEST_KILL_APP', project: selectedProject }));
                    setLogs((prev: any) => [{ time: new Date().toLocaleTimeString(), msg: `🛑 Sent kill request for ${selectedProject}...`, type: 'info' }, ...prev].slice(0, 50));
                  } else {
                    setLogs((prev: any) => [{ time: new Date().toLocaleTimeString(), msg: 'Cannot kill app: Not connected to Mac Server', type: 'error' }, ...prev].slice(0, 50));
                  }
                }}
                className="w-full py-2 px-3 rounded flex items-center justify-center gap-2 text-xs font-bold transition-all bg-rose-500/20 text-rose-400 border border-rose-500/30 hover:bg-rose-500/30"
              >
                <XCircle className="w-4 h-4" />
                Stop App
              </button>
            </div>
          </div>
        </aside>

        {/* Center/Right: Viewport & Terminal */}
        <main className="flex-1 flex flex-col min-w-0 bg-black relative">
          {/* Viewport */}
          <div className="flex-1 relative flex items-center justify-center p-4 overflow-hidden">
            {remoteScreen ? (
              <img src={remoteScreen} alt="Remote Screen" className="max-w-full max-h-full object-contain rounded-lg border border-white/10 shadow-2xl" referrerPolicy="no-referrer" />
            ) : (
              <div className="flex flex-col items-center text-slate-600">
                <Monitor className="w-16 h-16 mb-4 opacity-20" />
                <p className="font-mono text-sm">Waiting for Video Stream...</p>
                <p className="text-[10px] mt-2">Start \`local-receiver.js\` on your Mac</p>
              </div>
            )}

            {/* Viewport Overlay Stats */}
            <div className="absolute top-4 right-4 flex gap-2">
              <div className="bg-black/60 backdrop-blur px-2 py-1 rounded border border-white/10 text-[10px] font-mono text-emerald-400 flex items-center gap-1.5">
                <div className={`w - 1.5 h - 1.5 rounded - full ${isStreaming ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'} `} />
                {isStreaming ? 'LIVE STREAM' : 'OFFLINE'}
              </div>
            </div>
          </div>

          {/* Terminal */}
          <div className="h-72 border-t border-white/10 bg-[#050505] flex flex-col shrink-0">
            <div className="flex items-center justify-between px-4 py-2 border-b border-white/5 bg-[#0a0a0a]">
              <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
                <Terminal className="w-4 h-4" />
                <span>Build Terminal Output</span>
              </div>
              <button onClick={() => setLogs([])} className="text-[10px] text-slate-500 hover:text-slate-300 uppercase tracking-wider transition-colors">
                Clear Logs
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 font-mono text-[11px] space-y-1.5 scrollbar-thin scrollbar-thumb-white/10">
              {logs.length === 0 ? (
                <div className="text-slate-600 italic h-full flex items-center justify-center">No logs yet. Waiting for build trigger...</div>
              ) : (
                logs.map((log: any, i: number) => (
                  <div key={i} className="flex gap-3 hover:bg-white/[0.02] px-1 rounded transition-colors">
                    <span className="text-slate-600 shrink-0">[{log.time}]</span>
                    <span className={`${log.type === 'error' ? 'text-red-400' :
                      log.type === 'success' ? 'text-emerald-400' : 'text-slate-300'
                      } break-all whitespace - pre - wrap`}>
                      {log.msg}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};
