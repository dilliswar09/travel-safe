import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, onSnapshot, query, where, updateDoc, doc, addDoc, serverTimestamp, deleteDoc, getDocs } from 'firebase/firestore';
import { Alert, UserProfile, Geofence, Location, CommunityReport } from '../types';
import Map from './Map';
import { 
  ShieldAlert, Users, Map as MapIcon, AlertTriangle, CheckCircle2, 
  Search, Filter, Download, BarChart3, Settings, LogOut, 
  Activity, ShieldCheck, Clock, UserMinus, Plus, Trash2, 
  TrendingUp, MapPin, Database, Zap, ArrowUpRight, ArrowDownRight, 
  Menu, X, Bell, LayoutDashboard, FileText, HelpCircle, Info, MessageSquare,
  Sun, Heart
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, PieChart, Pie, Cell, AreaChart, Area 
} from 'recharts';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';

export default function AdminDashboard({ user }: { user: UserProfile }) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [tourists, setTourists] = useState<UserProfile[]>([]);
  const [geofences, setGeofences] = useState<Geofence[]>([]);
  const [communityReports, setCommunityReports] = useState<CommunityReport[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'alerts' | 'tourists' | 'geofences' | 'analytics' | 'ledger' | 'community'>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddGeofence, setShowAddGeofence] = useState(false);
  const [newGeofence, setNewGeofence] = useState<Partial<Geofence>>({ 
    name: '', 
    type: 'TOURIST_SPOT', 
    radius: 500, 
    riskScore: 10,
    center: { latitude: 28.6139, longitude: 77.2090 } 
  });
  const [ledger, setLedger] = useState<any[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  useEffect(() => {
    const unsubAlerts = onSnapshot(collection(db, 'alerts'), (s) => setAlerts(s.docs.map(d => ({ id: d.id, ...d.data() } as Alert))), (err) => handleFirestoreError(err, OperationType.LIST, 'alerts'));
    const unsubTourists = onSnapshot(query(collection(db, 'users'), where('role', '==', 'tourist')), (s) => setTourists(s.docs.map(d => ({ ...d.data() } as unknown as UserProfile))), (err) => handleFirestoreError(err, OperationType.LIST, 'users'));
    const unsubGf = onSnapshot(collection(db, 'geofences'), (s) => setGeofences(s.docs.map(d => ({ id: d.id, ...d.data() } as Geofence))), (err) => handleFirestoreError(err, OperationType.LIST, 'geofences'));
    const unsubLedger = onSnapshot(collection(db, 'ledger'), (s) => setLedger(s.docs.map(d => ({ id: d.id, ...d.data() }))), (err) => handleFirestoreError(err, OperationType.LIST, 'ledger'));
    const unsubCommunity = onSnapshot(collection(db, 'community_reports'), (s) => setCommunityReports(s.docs.map(d => ({ id: d.id, ...d.data() } as CommunityReport))), (err) => handleFirestoreError(err, OperationType.LIST, 'community_reports'));
    
    return () => { unsubAlerts(); unsubTourists(); unsubGf(); unsubLedger(); unsubCommunity(); };
  }, []);

  const resolveAlert = async (alertId: string) => {
    await updateDoc(doc(db, 'alerts', alertId), { status: 'resolved', resolvedAt: serverTimestamp(), resolvedBy: user.uid });
  };

  const addGeofence = async () => {
    if (!newGeofence.name || !newGeofence.center) return;
    await addDoc(collection(db, 'geofences'), newGeofence);
    setShowAddGeofence(false);
    setNewGeofence({ 
      name: '', 
      type: 'TOURIST_SPOT', 
      radius: 500, 
      riskScore: 10,
      center: { latitude: 28.6139, longitude: 77.2090 } 
    });
  };

  const deleteGeofence = async (id: string) => {
    await deleteDoc(doc(db, 'geofences', id));
  };

  const markAsMissing = async (touristId: string) => {
    await updateDoc(doc(db, 'users', touristId), { status: 'missing', safetyScore: 0 });
    const t = tourists.find(u => u.uid === touristId);
    if (t) {
      await addDoc(collection(db, 'alerts'), {
        userId: touristId,
        userDisplayName: t.displayName,
        type: 'MISSING_PERSON',
        location: t.lastKnownLocation || { latitude: 0, longitude: 0 },
        status: 'active',
        priority: 'critical',
        timestamp: serverTimestamp(),
        details: 'Manually reported as missing by staff.'
      });
    }
  };

  const exportToCSV = () => {
    const headers = ['Timestamp', 'Type', 'User', 'Status', 'Priority', 'Details'];
    const rows = alerts.map(a => [
      a.timestamp instanceof Date ? a.timestamp.toISOString() : (a.timestamp as any)?.toDate?.().toISOString() || 'N/A',
      a.type,
      a.userDisplayName,
      a.status,
      a.priority,
      a.details
    ]);
    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `safety_logs_${new Date().toISOString()}.csv`;
    link.click();
  };

  const alertStats = [
    { name: 'SOS', value: alerts.filter(a => a.type === 'SOS').length },
    { name: 'Geofence', value: alerts.filter(a => a.type.includes('GEOFENCE')).length },
    { name: 'Deviation', value: alerts.filter(a => a.type === 'ROUTE_DEVIATION').length },
    { name: 'Silent', value: alerts.filter(a => a.type === 'SILENT_DISTRESS').length },
  ];

  const COLORS = ['#ef4444', '#3b82f6', '#f59e0b', '#8b5cf6'];

  return (
    <div className="flex h-screen bg-[#F8FAFC] overflow-hidden">
      {/* Sidebar */}
      <motion.aside 
        initial={false}
        animate={{ width: isSidebarOpen ? 280 : 80 }}
        className="bg-slate-900 text-white flex flex-col shrink-0 transition-all duration-300 relative z-50"
      >
        <div className="p-6 flex items-center gap-4 mb-8">
          <div className="w-10 h-10 bg-brand-600 rounded-xl flex items-center justify-center shrink-0">
            <ShieldCheck size={24} className="text-white" />
          </div>
          {isSidebarOpen && <h1 className="text-xl font-black tracking-tighter uppercase">SafeGuard <span className="text-brand-500">Pro</span></h1>}
        </div>

        <nav className="flex-1 px-4 space-y-2">
          <NavItem icon={<LayoutDashboard size={20} />} label="Overview" active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} collapsed={!isSidebarOpen} />
          <NavItem icon={<Bell size={20} />} label="Active Alerts" active={activeTab === 'alerts'} onClick={() => setActiveTab('alerts')} collapsed={!isSidebarOpen} badge={alerts.filter(a => a.status === 'active').length} />
          <NavItem icon={<Users size={20} />} label="Tourists" active={activeTab === 'tourists'} onClick={() => setActiveTab('tourists')} collapsed={!isSidebarOpen} />
          <NavItem icon={<MessageSquare size={20} />} label="Community Reports" active={activeTab === 'community'} onClick={() => setActiveTab('community')} collapsed={!isSidebarOpen} badge={communityReports.length} />
          <NavItem icon={<MapIcon size={20} />} label="Geofences" active={activeTab === 'geofences'} onClick={() => setActiveTab('geofences')} collapsed={!isSidebarOpen} />
          <NavItem icon={<BarChart3 size={20} />} label="Analytics" active={activeTab === 'analytics'} onClick={() => setActiveTab('analytics')} collapsed={!isSidebarOpen} />
          <NavItem icon={<Database size={20} />} label="Blockchain Ledger" active={activeTab === 'ledger'} onClick={() => setActiveTab('ledger')} collapsed={!isSidebarOpen} />
        </nav>

        <div className="p-4 border-t border-slate-800">
          <button onClick={() => auth.signOut()} className="w-full flex items-center gap-4 p-4 rounded-xl hover:bg-red-500/10 text-slate-400 hover:text-red-500 transition-all">
            <LogOut size={20} />
            {isSidebarOpen && <span className="font-bold">Sign Out</span>}
          </button>
        </div>

        <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="absolute -right-4 top-20 w-8 h-8 bg-brand-600 rounded-full flex items-center justify-center shadow-xl hover:scale-110 transition-all">
          {isSidebarOpen ? <X size={16} /> : <Menu size={16} />}
        </button>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto custom-scrollbar p-8">
        <header className="flex justify-between items-center mb-10">
          <div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight capitalize">{activeTab}</h2>
            <p className="text-slate-400 font-medium">Real-time safety monitoring & control</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder="Search..." 
                className="pl-12 pr-6 py-3 bg-white border border-slate-100 rounded-2xl outline-none focus:ring-4 focus:ring-brand-50 shadow-sm w-64 transition-all"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
            <button onClick={exportToCSV} className="btn-ghost bg-white shadow-sm border border-slate-100">
              <Download size={18} />
              <span className="hidden md:inline">Export Logs</span>
            </button>
          </div>
        </header>

        <AnimatePresence mode="wait">
          {activeTab === 'overview' && (
            <motion.div key="overview" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard icon={<ShieldAlert className="text-red-500" />} label="Active Alerts" value={alerts.filter(a => a.status === 'active').length} trend="+12%" positive={false} />
                <StatCard icon={<Users className="text-blue-500" />} label="Live Tourists" value={tourists.length} trend="+5%" positive={true} />
                <StatCard icon={<MessageSquare className="text-brand-500" />} label="Community Reports" value={communityReports.length} trend="+15%" positive={true} />
                <StatCard icon={<Activity className="text-purple-500" />} label="Safety Index" value="94%" trend="+2%" positive={true} />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className="lg:col-span-8 card-premium p-8">
                  <h3 className="text-xl font-black mb-8 flex items-center gap-3">
                    <TrendingUp className="text-brand-600" />
                    Incident Trends
                  </h3>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={alerts.slice(-10).map((a, i) => ({ name: i, value: Math.random() * 100 }))}>
                        <defs>
                          <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" hide />
                        <YAxis hide />
                        <Tooltip />
                        <Area type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={4} fillOpacity={1} fill="url(#colorValue)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="lg:col-span-4 card-premium p-8">
                  <h3 className="text-xl font-black mb-8">Alert Distribution</h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={alertStats} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                          {alertStats.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-3 mt-4">
                    {alertStats.map((s, i) => (
                      <div key={i} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i] }} />
                          <span className="text-xs font-bold text-slate-500">{s.name}</span>
                        </div>
                        <span className="text-xs font-black">{s.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="card-premium p-8">
                <h3 className="text-xl font-black mb-8 flex items-center gap-3">
                  <MapIcon className="text-brand-600" />
                  Live Monitoring Map
                </h3>
                <div className="h-[500px] rounded-4xl overflow-hidden border-4 border-slate-50">
                  <Map 
                    center={{ latitude: 28.6139, longitude: 77.2090 }} 
                    markers={tourists.map(t => ({ position: t.lastKnownLocation || { latitude: 0, longitude: 0 }, label: t.displayName, type: 'user' }))}
                    geofences={geofences}
                  />
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'alerts' && (
            <motion.div key="alerts" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
              <div className="flex gap-4 mb-8">
                <button className="btn-primary">All Alerts</button>
                <button className="btn-ghost">Critical Only</button>
                <button className="btn-ghost">Resolved</button>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {alerts.filter(a => a.userDisplayName.toLowerCase().includes(searchQuery.toLowerCase())).map((alert) => (
                  <div key={alert.id} className={cn(
                    "card-premium p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 transition-all",
                    alert.status === 'resolved' ? "opacity-60 grayscale" : "border-l-8",
                    alert.priority === 'critical' ? "border-l-red-500" : alert.priority === 'high' ? "border-l-orange-500" : "border-l-blue-500"
                  )}>
                    <div className="flex items-center gap-6">
                      <div className={cn(
                        "w-16 h-16 rounded-3xl flex items-center justify-center shadow-lg",
                        alert.priority === 'critical' ? "bg-red-500 text-white shadow-red-200" : "bg-slate-100 text-slate-600"
                      )}>
                        <ShieldAlert size={32} />
                      </div>
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <h4 className="text-lg font-black text-slate-900 uppercase tracking-tight">{alert.type.replace('_', ' ')}</h4>
                          <span className={cn("px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest", alert.priority === 'critical' ? "bg-red-100 text-red-600" : "bg-slate-100 text-slate-500")}>
                            {alert.priority}
                          </span>
                        </div>
                        <p className="text-sm font-medium text-slate-500 mb-2">{alert.details}</p>
                        <div className="flex items-center gap-4 text-xs font-bold text-slate-400">
                          <span className="flex items-center gap-1"><Users size={14} /> {alert.userDisplayName}</span>
                          <span className="flex items-center gap-1"><Clock size={14} /> {alert.timestamp instanceof Date ? alert.timestamp.toLocaleTimeString() : (alert.timestamp as any)?.toDate?.().toLocaleTimeString() || 'N/A'}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-3 w-full md:w-auto">
                      {alert.status === 'active' && (
                        <button onClick={() => resolveAlert(alert.id!)} className="btn-accent flex-1 md:flex-none">
                          <CheckCircle2 size={18} />
                          Resolve
                        </button>
                      )}
                      <button className="btn-ghost flex-1 md:flex-none">
                        <MapPin size={18} />
                        Locate
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {activeTab === 'tourists' && (
            <motion.div key="tourists" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {tourists.filter(t => t.displayName.toLowerCase().includes(searchQuery.toLowerCase())).map((tourist) => (
                <div key={tourist.uid} className="card-premium p-8 group">
                  <div className="flex justify-between items-start mb-6">
                    <div className="w-16 h-16 bg-slate-100 rounded-3xl flex items-center justify-center text-slate-400 group-hover:bg-brand-50 group-hover:text-brand-600 transition-all duration-500">
                      <Users size={32} />
                    </div>
                    <div className={cn("px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest", tourist.status === 'missing' ? "bg-red-100 text-red-600" : "bg-green-100 text-green-600")}>
                      {tourist.status || 'Active'}
                    </div>
                  </div>
                  <h4 className="text-xl font-black text-slate-900 mb-1">{tourist.displayName}</h4>
                  <p className="text-xs font-medium text-slate-400 mb-6">{tourist.email}</p>
                  
                  <div className="space-y-4 mb-8">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Safety Score</span>
                      <span className={cn("font-black", tourist.safetyScore > 70 ? "text-green-500" : "text-red-500")}>{tourist.safetyScore}%</span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${tourist.safetyScore}%` }} className={cn("h-full", tourist.safetyScore > 70 ? "bg-green-500" : "bg-red-500")} />
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button onClick={() => markAsMissing(tourist.uid)} className="btn-danger flex-1 text-xs py-3">REPORT MISSING</button>
                    <button className="btn-ghost w-12 h-12 p-0"><Info size={20} /></button>
                  </div>
                </div>
              ))}
            </motion.div>
          )}

          {activeTab === 'geofences' && (
            <motion.div key="geofences" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-8">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-black">Managed Zones</h3>
                <button onClick={() => setShowAddGeofence(true)} className="btn-accent">
                  <Plus size={18} />
                  New Geofence
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {geofences.map((gf) => (
                  <div key={gf.id} className="card-premium p-8 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-slate-50 rounded-full -mr-16 -mt-16 group-hover:bg-brand-50 transition-all duration-500" />
                    <div className="relative z-10">
                      <div className="flex justify-between items-start mb-6">
                        <div className="w-14 h-14 bg-white shadow-sm rounded-2xl flex items-center justify-center text-brand-600">
                          <MapPin size={24} />
                        </div>
                        <button onClick={() => deleteGeofence(gf.id!)} className="p-2 text-red-300 hover:text-red-500 transition-all"><Trash2 size={20} /></button>
                      </div>
                      <h4 className="text-xl font-black text-slate-900 mb-2">{gf.name}</h4>
                      <div className="flex flex-wrap gap-2 mb-6">
                        <span className="px-3 py-1 bg-slate-100 rounded-full text-[10px] font-black uppercase tracking-widest text-slate-500">{gf.type}</span>
                        <span className="px-3 py-1 bg-brand-50 rounded-full text-[10px] font-black uppercase tracking-widest text-brand-600">{gf.radius}m Radius</span>
                      </div>
                      <div className="flex items-center justify-between text-xs font-bold text-slate-400">
                        <span>Risk Score</span>
                        <span className="text-slate-900">{gf.riskScore}/100</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {activeTab === 'community' && (
            <motion.div key="community" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {communityReports.filter(r => r.userDisplayName.toLowerCase().includes(searchQuery.toLowerCase())).map((report) => (
                  <div key={report.id} className="card-premium p-8 group relative overflow-hidden">
                    <div className={cn(
                      "absolute top-0 left-0 w-2 h-full",
                      report.type === 'UNSAFE' ? "bg-red-500" : "bg-green-500"
                    )} />
                    <div className="flex justify-between items-start mb-6">
                      <div className={cn(
                        "w-14 h-14 rounded-2xl flex items-center justify-center shadow-sm",
                        report.type === 'SAFE' ? "bg-green-50 text-green-600" :
                        report.type === 'UNSAFE' ? "bg-red-50 text-red-600" :
                        report.type === 'CROWDED' ? "bg-blue-50 text-blue-600" :
                        report.type === 'WELL_LIT' ? "bg-yellow-50 text-yellow-600" :
                        "bg-pink-50 text-pink-600"
                      )}>
                        {report.type === 'SAFE' ? <ShieldCheck size={24} /> :
                         report.type === 'UNSAFE' ? <AlertTriangle size={24} /> :
                         report.type === 'CROWDED' ? <Users size={24} /> :
                         report.type === 'WELL_LIT' ? <Sun size={24} /> :
                         <Heart size={24} />}
                      </div>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        {report.timestamp instanceof Date ? report.timestamp.toLocaleTimeString() : (report.timestamp as any)?.toDate?.().toLocaleTimeString() || 'N/A'}
                      </span>
                    </div>
                    <h4 className="text-xl font-black text-slate-900 mb-2 uppercase tracking-tight">{report.type.replace('_', ' ')}</h4>
                    <p className="text-sm font-medium text-slate-500 mb-6 leading-relaxed">"{report.comment || 'No additional comments provided.'}"</p>
                    <div className="flex items-center justify-between pt-6 border-t border-slate-50">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400">
                          <Users size={14} />
                        </div>
                        <span className="text-xs font-bold text-slate-900">{report.userDisplayName}</span>
                      </div>
                      <button className="text-brand-600 hover:text-brand-700 transition-all">
                        <MapPin size={18} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {activeTab === 'ledger' && (
            <motion.div key="ledger" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="card-premium p-0 overflow-hidden">
              <div className="p-8 border-b border-slate-100 flex justify-between items-center">
                <h3 className="text-xl font-black flex items-center gap-3">
                  <Database className="text-brand-600" />
                  Blockchain Audit Trail
                </h3>
                <span className="px-4 py-2 bg-green-50 text-green-600 text-xs font-black rounded-full uppercase tracking-widest">Tamper-Proof Ledger</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    <tr>
                      <th className="px-8 py-4">Timestamp</th>
                      <th className="px-8 py-4">Action</th>
                      <th className="px-8 py-4">Data Hash</th>
                      <th className="px-8 py-4">Previous Hash</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {ledger.map((entry, i) => (
                      <tr key={i} className="hover:bg-slate-50/50 transition-all">
                        <td className="px-8 py-6 text-xs font-bold text-slate-500">
                          {entry.timestamp instanceof Date ? entry.timestamp.toLocaleString() : (entry.timestamp as any)?.toDate?.().toLocaleString() || 'N/A'}
                        </td>
                        <td className="px-8 py-6">
                          <span className="px-3 py-1 bg-brand-50 text-brand-600 text-[10px] font-black rounded-full uppercase tracking-widest">{entry.action}</span>
                        </td>
                        <td className="px-8 py-6 font-mono text-[10px] text-slate-400">{entry.dataHash.substring(0, 24)}...</td>
                        <td className="px-8 py-6 font-mono text-[10px] text-slate-400">{entry.previousHash.substring(0, 24)}...</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Add Geofence Modal */}
      <AnimatePresence>
        {showAddGeofence && (
          <div className="fixed inset-0 z-[5000] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowAddGeofence(false)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }} className="relative w-full max-w-lg bg-white rounded-5xl shadow-2xl p-10">
              <h3 className="text-2xl font-black mb-8 tracking-tight">Create Safety Zone</h3>
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Zone Name</label>
                  <input type="text" className="input-premium" value={newGeofence.name} onChange={e => setNewGeofence({...newGeofence, name: e.target.value})} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Type</label>
                    <select className="input-premium" value={newGeofence.type} onChange={e => setNewGeofence({...newGeofence, type: e.target.value as any})}>
                      <option value="TOURIST_SPOT">Tourist Spot</option>
                      <option value="HIGH_RISK">High Risk</option>
                      <option value="HELP_CENTER">Help Center</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Radius (m)</label>
                    <input type="number" className="input-premium" value={newGeofence.radius} onChange={e => setNewGeofence({...newGeofence, radius: Number(e.target.value)})} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Latitude</label>
                    <input type="number" className="input-premium" value={newGeofence.center?.latitude} onChange={e => setNewGeofence({...newGeofence, center: { ...newGeofence.center!, latitude: Number(e.target.value) }})} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Longitude</label>
                    <input type="number" className="input-premium" value={newGeofence.center?.longitude} onChange={e => setNewGeofence({...newGeofence, center: { ...newGeofence.center!, longitude: Number(e.target.value) }})} />
                  </div>
                </div>
                <div className="flex gap-4 pt-4">
                  <button onClick={() => setShowAddGeofence(false)} className="btn-ghost flex-1">Cancel</button>
                  <button onClick={addGeofence} className="btn-accent flex-1">Create Zone</button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function NavItem({ icon, label, active, onClick, collapsed, badge }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void, collapsed: boolean, badge?: number }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-4 p-4 rounded-2xl transition-all relative group",
        active ? "bg-brand-600 text-white shadow-lg shadow-brand-900/50" : "text-slate-400 hover:bg-slate-800 hover:text-white"
      )}
    >
      <div className={cn("shrink-0 transition-transform duration-300", active && "scale-110")}>{icon}</div>
      {!collapsed && <span className="font-bold whitespace-nowrap">{label}</span>}
      {badge ? (
        <span className={cn(
          "absolute right-4 px-2 py-0.5 rounded-lg text-[10px] font-black",
          active ? "bg-white text-brand-600" : "bg-red-500 text-white"
        )}>
          {badge}
        </span>
      ) : null}
      {collapsed && (
        <div className="absolute left-20 px-4 py-2 bg-slate-800 text-white text-xs font-bold rounded-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-all translate-x-[-10px] group-hover:translate-x-0 whitespace-nowrap z-[100]">
          {label}
        </div>
      )}
    </button>
  );
}

function StatCard({ icon, label, value, trend, positive }: { icon: React.ReactNode, label: string, value: string | number, trend: string, positive: boolean }) {
  return (
    <div className="card-premium p-8">
      <div className="flex justify-between items-start mb-6">
        <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center shadow-inner">
          {icon}
        </div>
        <div className={cn(
          "flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-black",
          positive ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"
        )}>
          {positive ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
          {trend}
        </div>
      </div>
      <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
      <h3 className="text-3xl font-black text-slate-900 tracking-tighter">{value}</h3>
    </div>
  );
}
