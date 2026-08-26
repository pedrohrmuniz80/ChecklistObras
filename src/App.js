import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, setDoc } from 'firebase/firestore';
import { 
  Camera, CheckCircle, Circle, Trash2, FileText, ArrowLeft, BarChart3, 
  Filter, Printer, Building2, LogOut, Pencil, Settings, X, Undo, MousePointer2, PaintBucket
} from 'lucide-react';


// --- 1. CONFIGURAÇÃO DO FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyCpHs7rK8IaU6bLOu9U5atqLe_Zk-PNkkE",
  authDomain: "check-list-obras.firebaseapp.com",
  projectId: "check-list-obras",
  storageBucket: "check-list-obras.firebasestorage.app",
  messagingSenderId: "154186862082",
  appId: "1:154186862082:web:8b12debd3789521894611b"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const collectionPath = 'checklists';

// --- 2. DEFINIÇÃO DE PERFIS E DADOS FIXOS ---
const EMAILS_GERENCIA = [
  'pedro.ctr@deville.com.br', 'stephanie.ctr@deville.com.br',
  'alan.ctr@deville.com.br', 'raphael.ctr@deville.com.br', 'jessica.ctr@deville.com.br'
];

const INITIAL_PROJECTS = [
  { id: 'DCWB-WC', name: 'DCWB - WCs 24 Horas' },
  { id: 'DPOA-APT', name: 'DPOA - Reforma Apartamentos 6º Andar' },
  { id: 'DCGB-WC', name: 'DCGB - WC do Espaço Gourmet' },
  { id: 'DSSA-LOBBY', name: 'DSSA - Reforma Lobby' },
];

const STAGES = {
  'DCWB-WC': [
    { id: 'st3', name: 'ETAPA 03 - PAV 10 E 11', locations: ['1009', '1010', '1011', '1012', 'Suite 1013', '1109', '1110', '1111', '1112', 'Corredor Pav. 10', 'Corredor Pav. 11'] },
    { id: 'st4', name: 'ETAPA 04 - PAV 8 E 9', locations: ['809', '810', '811', '812', 'Suite 813', '909', '910', '911', '912', 'Corredor Pav. 8', 'Corredor Pav. 9'] },
  ]
};

const DISCIPLINES = ['Civil', 'Pintura', 'Hidráulica', 'Elétrica', 'Manutenção', 'Limpeza', 'Marcenaria', 'Marmoraria', 'EC'];
const COLORS = ['#ef4444', '#eab308', '#3b82f6', '#000000', '#ffffff'];

export default function App() {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState('partner');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [view, setView] = useState('dashboard'); 

  const [items, setItems] = useState([]);
  const [projectAccess, setProjectAccess] = useState({});
  const [customProjects, setCustomProjects] = useState([]);
  const [customStages, setCustomStages] = useState([]);
  const [customLocations, setCustomLocations] = useState([]);
  
  const [selectedProject, setSelectedProject] = useState(null);
  const [selectedStage, setSelectedStage] = useState(null);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [configProject, setConfigProject] = useState(null);
  const [newPartnerEmail, setNewPartnerEmail] = useState('');
  
  const [statusFilter, setStatusFilter] = useState('all');
  const [disciplineFilter, setDisciplineFilter] = useState('all');

  const [editingId, setEditingId] = useState(null);
  const [photo, setPhoto] = useState(null);
  const [description, setDescription] = useState('');
  const [discipline, setDiscipline] = useState('');
  
  // Estados para o formulário (campos selecionados no modal de edição/inclusão)
  const [formProject, setFormProject] = useState('');
  const [formStage, setFormStage] = useState('');
  const [formLocation, setFormLocation] = useState('');

  const [isMarking, setIsMarking] = useState(false);
  
  const canvasRef = useRef(null);
  const [drawMode, setDrawMode] = useState('pencil');
  const [color, setColor] = useState(COLORS[0]);
  const [drawingHistory, setDrawingHistory] = useState([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [currentCanvasState, setCurrentCanvasState] = useState(null);

  useEffect(() => {
    let unsubs = [];
    const unsubscribeAuth = onAuthStateChanged(auth, (loggedUser) => {
      setUser(loggedUser);
      setLoadingAuth(false);
      
      if (loggedUser) {
        setRole(EMAILS_GERENCIA.includes(loggedUser.email.toLowerCase()) ? 'manager' : 'partner');

        unsubs.push(onSnapshot(collection(db, collectionPath), (snap) => {
          setItems(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
        }));

        unsubs.push(onSnapshot(collection(db, 'project_access'), (snap) => {
          const accessMap = {};
          snap.docs.forEach(doc => { accessMap[doc.id] = doc.data().authorizedEmails || []; });
          setProjectAccess(accessMap);
        }));

        unsubs.push(onSnapshot(collection(db, 'custom_projects'), (snap) => {
          setCustomProjects(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }));

        unsubs.push(onSnapshot(collection(db, 'custom_stages'), (snap) => {
          setCustomStages(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }));

        unsubs.push(onSnapshot(collection(db, 'custom_locations'), (snap) => {
          setCustomLocations(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }));
      } else {
        unsubs.forEach(unsub => unsub());
      }
    });
    return () => { unsubscribeAuth(); unsubs.forEach(unsub => unsub()); };
  }, []);

  const ALL_PROJECTS = [...INITIAL_PROJECTS, ...customProjects];
  
  const visibleProjects = role === 'manager' 
    ? ALL_PROJECTS 
    : ALL_PROJECTS.filter(p => (projectAccess[p.id] || []).includes(user?.email.toLowerCase()));

  const handlePhotoUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        if (width > height) { if (width > 800) { height *= 800 / width; width = 800; } } else { if (height > 800) { width *= 800 / height; height = 800; } }
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        setPhoto(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    if (isMarking && canvasRef.current && photo) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      const img = new Image();
      img.onload = () => { canvas.width = img.width; canvas.height = img.height; ctx.drawImage(img, 0, 0); setDrawingHistory([canvas.toDataURL()]); };
      img.src = photo;
    }
  }, [isMarking, photo]);

  const startDrawing = (e) => {
    const canvas = canvasRef.current; const rect = canvas.getBoundingClientRect(); const scaleX = canvas.width / rect.width; const scaleY = canvas.height / rect.height;
    const x = (e.clientX || e.touches[0].clientX - rect.left) * scaleX; const y = (e.clientY || e.touches[0].clientY - rect.top) * scaleY;
    setStartPos({ x, y }); setIsDrawing(true); setCurrentCanvasState(canvas.toDataURL());
    if (drawMode === 'pencil') { const ctx = canvas.getContext('2d'); ctx.beginPath(); ctx.moveTo(x, y); }
  };

  const draw = (e) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current; const ctx = canvas.getContext('2d'); const rect = canvas.getBoundingClientRect(); const scaleX = canvas.width / rect.width; const scaleY = canvas.height / rect.height;
    const x = (e.clientX || e.touches[0].clientX - rect.left) * scaleX; const y = (e.clientY || e.touches[0].clientY - rect.top) * scaleY;
    ctx.lineWidth = 4; ctx.strokeStyle = color; ctx.lineCap = 'round';
    if (drawMode === 'pencil') { ctx.lineTo(x, y); ctx.stroke(); } else {
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.drawImage(img, 0, 0); ctx.beginPath();
        if (drawMode === 'circle') { const radius = Math.sqrt(Math.pow(x - startPos.x, 2) + Math.pow(y - startPos.y, 2)); ctx.arc(startPos.x, startPos.y, radius, 0, 2 * Math.PI); ctx.stroke(); } 
        else if (drawMode === 'arrow') { const headlen = 15; const angle = Math.atan2(y - startPos.y, x - startPos.x); ctx.moveTo(startPos.x, startPos.y); ctx.lineTo(x, y); ctx.lineTo(x - headlen * Math.cos(angle - Math.PI / 6), y - headlen * Math.sin(angle - Math.PI / 6)); ctx.moveTo(x, y); ctx.lineTo(x - headlen * Math.cos(angle + Math.PI / 6), y - headlen * Math.sin(angle + Math.PI / 6)); ctx.stroke(); }
      };
      img.src = currentCanvasState;
    }
  };

  const stopDrawing = () => { if (!isDrawing) return; setIsDrawing(false); setDrawingHistory([...drawingHistory, canvasRef.current.toDataURL()]); };
  const saveMarkedPhoto = () => { setPhoto(canvasRef.current.toDataURL('image/jpeg', 0.8)); setIsMarking(false); };

  const handleNewItem = () => {
    setEditingId(null); setPhoto(null); setDescription(''); setDiscipline('');
    setFormProject(selectedProject?.id || '');
    setFormStage(selectedStage?.id || '');
    setFormLocation(selectedLocation || '');
    setView('form');
  };

  const editItem = (item) => {
    setEditingId(item.id); setPhoto(item.photoUrl); setDescription(item.description); setDiscipline(item.discipline);
    setFormProject(item.projectId !== 'NO_PROJECT' ? item.projectId : '');
    setFormStage(item.stageId !== 'NO_STAGE' ? item.stageId : '');
    setFormLocation(item.locationId !== 'Geral' ? item.locationId : '');
    setView('form');
  };

  const saveItem = async () => {
    if (!photo || !description || !discipline || !formProject || !formStage || !formLocation) return alert("Preencha todos os campos e selecione a obra/etapa/local.");
    try {
      if (editingId) {
        await updateDoc(doc(db, collectionPath, editingId), { 
          photoUrl: photo, description, discipline,
          projectId: formProject, stageId: formStage, locationId: formLocation
        });
      } else {
        await addDoc(collection(db, collectionPath), {
          projectId: formProject, stageId: formStage, locationId: formLocation,
          photoUrl: photo, description, discipline, createdAt: new Date().toISOString(), managerApproved: false, partnerFixed: false, authorEmail: user.email
        });
      }
      setView('list'); 
      setEditingId(null); setPhoto(null); setDescription(''); setDiscipline('');
      setFormProject(''); setFormStage(''); setFormLocation('');
    } catch (e) { alert("Erro ao guardar item: " + e.message); }
  };

  const handleLogin = async (e) => { e.preventDefault(); try { await signInWithEmailAndPassword(auth, loginEmail, loginPassword); } catch (e) { alert("Credenciais inválidas."); } };
  
  if (loadingAuth) return <div className="flex items-center justify-center h-screen font-bold text-slate-500 bg-slate-50">Carregando VistoriaPRO...</div>;
  if (!user) return (
    <div className="flex items-center justify-center min-h-screen bg-slate-100 p-5">
      <div className="bg-white p-10 rounded-2xl shadow-xl w-full max-w-md text-center animate-[fadeIn_0.3s_ease-out_forwards]">
        <div className="text-indigo-600 mb-4 inline-block"><Building2 size={48} /></div>
        <h1 className="text-3xl font-black text-blue-900 tracking-tight">Vistoria<span className="text-indigo-500">PRO</span></h1>
        <p className="text-slate-500 text-sm mb-8">Gestão de Checklists Deville</p>
        <form className="flex flex-col gap-4" onSubmit={handleLogin}>
          <input type="email" placeholder="E-mail" className="p-3 border border-slate-300 rounded-lg text-base outline-none bg-slate-50 focus:border-indigo-600 focus:bg-white focus:ring-2 focus:ring-indigo-100" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} required />
          <input type="password" placeholder="Senha" className="p-3 border border-slate-300 rounded-lg text-base outline-none bg-slate-50 focus:border-indigo-600 focus:bg-white focus:ring-2 focus:ring-indigo-100" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} required />
          <button type="submit" className="w-full bg-indigo-600 text-white rounded-xl font-bold p-4 border-none cursor-pointer transition-transform hover:scale-95 shadow-md mt-2">Entrar no Sistema</button>
        </form>
      </div>
    </div>
  );

  const renderSettings = () => (
    <div className="p-4 flex flex-col gap-5 animate-[fadeIn_0.3s_ease-out_forwards]">
      <h2 className="text-xl font-bold text-slate-800 border-b border-slate-200 pb-2">Configurações de Acesso</h2>
      <p className="text-slate-500 text-sm mb-0">Selecione uma obra para adicionar os fornecedores autorizados.</p>
      <div className="flex flex-col gap-1.5 mt-4">
        <select className="p-3 border border-slate-300 rounded-lg outline-none text-base bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" value={configProject?.id || ''} onChange={(e) => setConfigProject(ALL_PROJECTS.find(p => p.id === e.target.value))}>
          <option value="">Selecione a Obra...</option>
          {ALL_PROJECTS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>
      {configProject && (
        <div className="bg-white p-4 rounded-xl border border-slate-200 mt-2 shadow-sm">
          <h3 className="text-base font-bold mb-4 text-slate-800">Fornecedores: {configProject.name}</h3>
          <div className="flex gap-2 mb-4">
            <input type="email" placeholder="E-mail do fornecedor" className="flex-1 p-2.5 border border-slate-300 rounded-lg outline-none bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" value={newPartnerEmail} onChange={(e) => setNewPartnerEmail(e.target.value)} />
            <button className="bg-indigo-600 text-white px-4 rounded-lg font-bold hover:scale-95 transition-transform" onClick={async () => {
              if(!newPartnerEmail) return;
              const email = newPartnerEmail.toLowerCase().trim();
              const currentList = projectAccess[configProject.id] || [];
              if(!currentList.includes(email)) { await setDoc(doc(db, 'project_access', configProject.id), { authorizedEmails: [...currentList, email] }); setNewPartnerEmail(''); }
            }}>Adicionar</button>
          </div>
          <div className="flex flex-col gap-2">
            {(projectAccess[configProject.id] || []).length === 0 ? <p className="text-slate-400 text-sm">Nenhum fornecedor cadastrado.</p> : 
              (projectAccess[configProject.id] || []).map(email => (
                <div key={email} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-sm font-semibold">{email}</span>
                  <button onClick={async () => await setDoc(doc(db, 'project_access', configProject.id), { authorizedEmails: projectAccess[configProject.id].filter(e => e !== email) })} className="text-red-500 hover:text-red-700 bg-transparent border-none"><X size={18}/></button>
                </div>
              ))
            }
          </div>
        </div>
      )}
    </div>
  );

  const renderList = () => {
    let filteredItems = items;
    
    if (selectedProject) filteredItems = filteredItems.filter(i => i.projectId === selectedProject.id);
    if (selectedStage) filteredItems = filteredItems.filter(i => i.stageId === selectedStage.id);
    if (selectedLocation) filteredItems = filteredItems.filter(i => i.locationId === selectedLocation);
    if (statusFilter === 'pending') filteredItems = filteredItems.filter(i => !i.managerApproved);
    if (statusFilter === 'completed') filteredItems = filteredItems.filter(i => i.managerApproved);
    if (disciplineFilter !== 'all') filteredItems = filteredItems.filter(i => i.discipline === disciplineFilter);

    const availableStages = selectedProject ? [...(STAGES[selectedProject.id] || []), ...customStages.filter(s => s.projectId === selectedProject.id)] : [];

    return (
      <div className="p-4 flex flex-col gap-5 animate-[fadeIn_0.3s_ease-out_forwards]">
        <div className="print:hidden flex justify-between items-center mb-2">
          <h2 className="text-xl font-bold text-slate-800 m-0 border-none pb-0">{selectedLocation ? `Itens: ${selectedLocation}` : 'Checklist Geral'}</h2>
          <button onClick={() => window.print()} className="flex items-center gap-1 bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-lg font-semibold text-sm hover:bg-indigo-100 transition-colors"><Printer size={16}/> PDF</button>
        </div>

        <div className="print:hidden bg-slate-100 p-3 rounded-xl">
          <div className="text-sm font-semibold text-slate-600 flex items-center gap-2 mb-2"><Filter size={16} /> Buscar Vistorias</div>
          <div className="flex flex-col gap-2">
            {!selectedLocation && (
              <div className="flex gap-2">
                <select className="flex-1 p-2 rounded-lg border border-slate-300 text-sm bg-white" value={selectedProject?.id || 'all'} onChange={e => {
                  const p = ALL_PROJECTS.find(x => x.id === e.target.value);
                  setSelectedProject(p || null); setSelectedStage(null); setSelectedLocation(null);
                }}>
                  <option value="all">Todas as Obras</option>
                  {visibleProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>

                <select className="flex-1 p-2 rounded-lg border border-slate-300 text-sm bg-white" value={selectedStage?.id || 'all'} onChange={e => {
                  const s = availableStages.find(x => x.id === e.target.value);
                  setSelectedStage(s || null); setSelectedLocation(null);
                }} disabled={!selectedProject}>
                  <option value="all">Todas as Etapas</option>
                  {availableStages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            )}
            <div className="flex gap-2">
              <select className="flex-1 p-2 rounded-lg border border-slate-300 text-sm bg-white" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                <option value="all">Todos os Status</option>
                <option value="pending">Em Andamento</option>
                <option value="completed">Concluídos</option>
              </select>
              <select className="flex-1 p-2 rounded-lg border border-slate-300 text-sm bg-white" value={disciplineFilter} onChange={e => setDisciplineFilter(e.target.value)}>
                <option value="all">Todas as Disciplinas</option>
                {DISCIPLINES.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4 flex-1">
          {filteredItems.length === 0 ? <p className="text-center text-slate-400 py-10">Nenhum registro encontrado.</p> : 
            filteredItems.map(item => (
              <div key={item.id} className={`flex gap-4 bg-white p-4 rounded-xl border ${item.managerApproved ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200'} shadow-sm break-inside-avoid print:border-none print:border-b print:border-slate-300 print:shadow-none print:py-2`}>
                <div className="w-24 h-24 bg-slate-100 rounded-lg border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                  <img src={item.photoUrl} alt="Vistoria" className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 flex flex-col justify-between">
                  <div className="flex justify-between items-start mb-1">
                    <span className="bg-indigo-100 text-indigo-800 text-xs font-bold py-0.5 px-2 rounded-md">{item.discipline}</span>
                    {role === 'manager' && !item.managerApproved && (
                      <div className="print:hidden flex gap-2">
                        <button onClick={() => editItem(item)} className="text-slate-500 hover:text-indigo-600"><Pencil size={16}/></button>
                        <button onClick={() => window.confirm("Apagar permanentemente?") && deleteDoc(doc(db, collectionPath, item.id))} className="text-red-400 hover:text-red-600"><Trash2 size={16}/></button>
                      </div>
                    )}
                  </div>
                  <p className="text-sm font-medium text-slate-800 leading-snug line-clamp-2 overflow-hidden print:line-clamp-none">{item.description}</p>
                  
                  {!selectedLocation && (
                    <p className="text-[11px] text-slate-500 mt-0.5 mb-2">
                      <strong>Obra:</strong> {ALL_PROJECTS.find(p => p.id === item.projectId)?.name || 'N/A'}<br/>
                      <strong>Local:</strong> {item.locationId}
                    </p>
                  )}

                  <div className="print:hidden flex gap-4 mt-3 pt-3 border-t border-slate-200">
                    <button onClick={() => !item.managerApproved && updateDoc(doc(db, collectionPath, item.id), { partnerFixed: !item.partnerFixed })} disabled={item.managerApproved} className={`flex items-center gap-1.5 text-sm font-semibold transition-colors ${item.managerApproved ? 'opacity-50 cursor-not-allowed' : ''} ${item.partnerFixed ? 'text-amber-600' : 'text-slate-400'}`}>
                      {item.partnerFixed ? <CheckCircle size={16}/> : <Circle size={16}/>} Parceiro
                    </button>
                    <button onClick={() => role === 'manager' && updateDoc(doc(db, collectionPath, item.id), { managerApproved: !item.managerApproved })} disabled={role !== 'manager'} className={`flex items-center gap-1.5 text-sm font-semibold transition-colors ${role !== 'manager' ? 'opacity-50 cursor-not-allowed' : ''} ${item.managerApproved ? 'text-emerald-600' : 'text-slate-400'}`}>
                      {item.managerApproved ? <CheckCircle size={16}/> : <Circle size={16}/>} OK Gerente
                    </button>
                  </div>
                </div>
              </div>
            ))
          }
        </div>
      </div>
    );
  };

  const handleBack = () => {
    if (view === 'form') setView('list');
    else if (view === 'list' && selectedLocation) { setSelectedLocation(null); setView('locations'); }
    else if (view === 'list' && !selectedLocation) setView('projects');
    else if (view === 'locations') { setSelectedStage(null); setView('stages'); }
    else if (view === 'stages') { setSelectedProject(null); setView('projects'); }
    else if (view === 'settings') setView('dashboard');
  };

  return (
    <div className="min-h-screen pb-[80px] bg-slate-50 text-slate-900 font-sans print:pb-0 print:bg-white">
      {/* Editor de Marcação de Fotos */}
      {isMarking && (
        <div className="fixed inset-0 bg-slate-800 z-50 flex flex-col">
          <div className="flex justify-between items-center p-4 bg-slate-900 text-white">
            <button onClick={() => setIsMarking(false)} className="flex items-center gap-1 font-semibold text-sm hover:text-indigo-300"><ArrowLeft size={18}/> Voltar</button>
            <button onClick={saveMarkedPhoto} className="bg-indigo-600 text-white font-bold px-4 py-2 rounded-lg text-sm hover:bg-indigo-500">Salvar Marcação</button>
          </div>
          <div className="flex-1 bg-black flex items-center justify-center overflow-hidden">
            <canvas ref={canvasRef} className="max-w-full max-h-full touch-none" onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={stopDrawing} onMouseOut={stopDrawing} onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={stopDrawing} />
          </div>
          <div className="bg-slate-900 p-4 flex justify-between items-center text-white">
            <div className="flex gap-2">
              <button className={`p-2 rounded-lg ${drawMode === 'pencil' ? 'bg-slate-700' : ''}`} onClick={() => setDrawMode('pencil')}><Pencil size={20}/></button>
              <button className={`p-2 rounded-lg ${drawMode === 'arrow' ? 'bg-slate-700' : ''}`} onClick={() => setDrawMode('arrow')}><MousePointer2 size={20}/></button>
              <button className={`p-2 rounded-lg ${drawMode === 'circle' ? 'bg-slate-700' : ''}`} onClick={() => setDrawMode('circle')}><Circle size={20}/></button>
            </div>
            <div className="flex gap-2">
              {COLORS.map(c => <button key={c} className={`w-8 h-8 rounded-full border-2 ${color === c ? 'border-white' : 'border-transparent'}`} style={{backgroundColor: c}} onClick={() => setColor(c)} />)}
            </div>
            <button onClick={() => {
              if (drawingHistory.length > 1) {
                const newHist = drawingHistory.slice(0, -1); setDrawingHistory(newHist);
                const img = new Image(); img.onload = () => { canvasRef.current.getContext('2d').clearRect(0,0,canvasRef.current.width,canvasRef.current.height); canvasRef.current.getContext('2d').drawImage(img,0,0); }; img.src = newHist[newHist.length-1];
              }
            }} disabled={drawingHistory.length <= 1} className="p-2 rounded-lg disabled:opacity-50"><Undo size={20}/></button>
          </div>
        </div>
      )}

      {/* Header Principal */}
      <header className="print:hidden bg-white border-b border-slate-200 p-4 flex justify-between items-center sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-3">
          {view !== 'dashboard' && view !== 'projects' && !isMarking && <button onClick={handleBack} className="p-1 text-slate-500 rounded-full hover:bg-slate-100 hover:text-slate-900"><ArrowLeft size={20}/></button>}
          <h1 className="text-xl font-black text-blue-900 tracking-tight">Vistoria<span className="text-indigo-500">PRO</span></h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex flex-col items-end">
            <span className="text-xs font-bold text-slate-700">{user.email.split('@')[0]}</span>
            <span className={`text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded ${role === 'manager' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'}`}>{role === 'manager' ? 'Gerente' : 'Parceiro'}</span>
          </div>
          <button onClick={() => signOut(auth)} className="text-red-500 p-1.5 rounded-lg hover:bg-red-50 transition-colors" title="Sair"><LogOut size={20}/></button>
        </div>
      </header>

      {/* Área Principal de Renderização */}
      <main className="max-w-3xl mx-auto">
        {view === 'dashboard' && (
          <div className="p-4 flex flex-col gap-5 animate-[fadeIn_0.3s_ease-out_forwards]">
            <h2 className="text-xl font-bold text-slate-800 border-b border-slate-200 pb-2">Painel de Resumo</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col items-center justify-center shadow-sm">
                <span className="text-3xl font-bold text-slate-800">{items.length}</span>
                <span className="text-xs font-semibold text-slate-500 mt-1 text-center">Total Itens</span>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col items-center justify-center shadow-sm">
                <span className="text-3xl font-bold text-emerald-500">{items.filter(i => i.managerApproved).length}</span>
                <span className="text-xs font-semibold text-slate-500 mt-1 text-center">Concluídos</span>
              </div>
            </div>
          </div>
        )}
        
        {view === 'projects' && (
          <div className="p-4 flex flex-col gap-5 animate-[fadeIn_0.3s_ease-out_forwards]">
            <h2 className="text-xl font-bold text-slate-800 border-b border-slate-200 pb-2">Selecione a Obra</h2>
            <div className="flex flex-col gap-3">
              {visibleProjects.map(p => {
                const isCustom = customProjects.some(cp => cp.id === p.id);
                return (
                  <div key={p.id} className="flex bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm hover:border-indigo-400 transition-colors">
                    <button className="flex-1 flex items-center text-left p-4 bg-transparent" onClick={() => { setSelectedProject(p); setView('stages'); }}>
                      <span className="text-indigo-600 mr-3"><Building2 size={24} /></span> 
                      <span className="text-base font-semibold text-slate-700">{p.name}</span>
                    </button>
                    {isCustom && role === 'manager' && (
                      <button onClick={() => { if(window.confirm(`Excluir permanentemente a obra "${p.name}" e todas as suas permissões?`)) deleteDoc(doc(db, 'custom_projects', p.id)); }} className="px-5 bg-red-50 text-red-500 hover:text-red-600 border-l border-slate-200"><Trash2 size={20}/></button>
                    )}
                  </div>
                );
              })}
              {role === 'manager' && (
                <button className="flex items-center justify-center p-4 rounded-xl border-2 border-dashed border-slate-300 text-slate-500 font-bold hover:bg-slate-100 hover:text-slate-700 transition-colors" onClick={async () => {
                  const name = window.prompt("Nome da nova obra (Ex: DSPO - Fachada):");
                  if (name && name.trim()) await addDoc(collection(db, 'custom_projects'), { name: name.trim() });
                }}>
                  + Adicionar Nova Obra
                </button>
              )}
            </div>
          </div>
        )}

        {view === 'stages' && (
          <div className="p-4 flex flex-col gap-5 animate-[fadeIn_0.3s_ease-out_forwards]">
            <h2 className="text-xl font-bold text-slate-800 border-b border-slate-200 pb-2">{selectedProject.name} - Etapas</h2>
            <div className="flex flex-col gap-3">
              {[...(STAGES[selectedProject?.id] || []), ...customStages.filter(s => s.projectId === selectedProject?.id)].map(s => {
                const isCustom = customStages.some(cs => cs.id === s.id);
                return (
                  <div key={s.id} className="flex bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm hover:border-indigo-400 transition-colors">
                    <button className="flex-1 text-left p-4 font-semibold text-slate-700 bg-transparent" onClick={() => { setSelectedStage(s); setView('locations'); }}>{s.name}</button>
                    {isCustom && role === 'manager' && (
                      <button onClick={() => { if(window.confirm(`Excluir permanentemente a etapa "${s.name}"?`)) deleteDoc(doc(db, 'custom_stages', s.id)); }} className="px-5 bg-red-50 text-red-500 hover:text-red-600 border-l border-slate-200"><Trash2 size={20}/></button>
                    )}
                  </div>
                );
              })}
              {role === 'manager' && (
                <button className="flex items-center justify-center p-4 rounded-xl border-2 border-dashed border-slate-300 text-slate-500 font-bold hover:bg-slate-100 hover:text-slate-700 transition-colors" onClick={async () => {
                  const name = window.prompt("Nome da nova etapa (Ex: Pavimento 1):");
                  if (name && name.trim()) await addDoc(collection(db, 'custom_stages'), { projectId: selectedProject.id, name: name.trim() });
                }}>
                  + Adicionar Nova Etapa
                </button>
              )}
            </div>
          </div>
        )}

        {view === 'locations' && (
          <div className="p-4 flex flex-col gap-5 animate-[fadeIn_0.3s_ease-out_forwards]">
            <h2 className="text-xl font-bold text-slate-800 border-b border-slate-200 pb-2">{selectedStage.name} - Locais</h2>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-3">
              {Array.from(new Set([...(selectedStage?.locations || []), ...customLocations.filter(l => l.stageId === selectedStage?.id).map(l => l.name)])).map(l => (
                <button key={l} className="bg-white p-5 rounded-xl border border-slate-200 font-semibold text-slate-700 text-center shadow-sm hover:bg-indigo-50 transition-colors" onClick={() => { setSelectedLocation(l); setView('list'); }}>{l}</button>
              ))}
              {role === 'manager' && (
                <button className="flex items-center justify-center p-5 rounded-xl border-2 border-dashed border-slate-300 text-slate-500 font-bold hover:bg-slate-100 hover:text-slate-700 transition-colors bg-transparent" onClick={async () => {
                  const name = window.prompt("Nome do novo local (Ex: Quarto 101):");
                  if (name && name.trim()) await addDoc(collection(db, 'custom_locations'), { projectId: selectedProject.id, stageId: selectedStage.id, name: name.trim() });
                }}>
                  + Novo Local
                </button>
              )}
            </div>
          </div>
        )}

        {view === 'list' && renderList()}
        {view === 'settings' && renderSettings()}
        
        {/* Formulário de Novo/Editar Item */}
        {view === 'form' && !isMarking && (() => {
          const availableFormStages = formProject ? [...(STAGES[formProject] || []), ...customStages.filter(s => s.projectId === formProject)] : [];
          const selectedFormStageObj = availableFormStages.find(s => s.id === formStage);
          const availableFormLocations = Array.from(new Set([...(selectedFormStageObj?.locations || []), ...customLocations.filter(l => l.stageId === formStage).map(l => l.name)]));

          return (
            <div className="p-4 flex flex-col gap-5 animate-[fadeIn_0.3s_ease-out_forwards]">
              <h2 className="text-xl font-bold text-slate-800 border-b border-slate-200 pb-2">{editingId ? 'Editar Registro' : 'Novo Registro'}</h2>
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-4">
                
                <div className="flex gap-2 w-full">
                  <div className="flex-1 flex flex-col gap-1.5">
                    <label className="text-sm font-semibold text-slate-700">Obra</label>
                    <select className="p-3 border border-slate-300 rounded-lg outline-none text-base bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" value={formProject} onChange={e => { setFormProject(e.target.value); setFormStage(''); setFormLocation(''); }}>
                      <option value="">Selecione...</option>
                      {ALL_PROJECTS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                  <div className="flex-1 flex flex-col gap-1.5">
                    <label className="text-sm font-semibold text-slate-700">Etapa</label>
                    <select className="p-3 border border-slate-300 rounded-lg outline-none text-base bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" value={formStage} onChange={e => { setFormStage(e.target.value); setFormLocation(''); }} disabled={!formProject}>
                      <option value="">Selecione...</option>
                      {availableFormStages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-semibold text-slate-700">Local / Apartamento</label>
                  <select className="p-3 border border-slate-300 rounded-lg outline-none text-base bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" value={formLocation} onChange={e => setFormLocation(e.target.value)} disabled={!formStage}>
                    <option value="">Selecione o Local...</option>
                    {availableFormLocations.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>

                <div className="mt-2">
                  {photo ? (
                    <div className="relative w-full h-48 bg-black rounded-xl overflow-hidden shadow-inner flex items-center justify-center">
                      <img src={photo} alt="Preview" className="max-w-full max-h-full object-contain" />
                      <button onClick={() => setIsMarking(true)} className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-full font-bold flex items-center gap-2 shadow-lg transition-transform hover:scale-105"><PaintBucket size={16}/> Marcar Foto</button>
                      <button onClick={() => setPhoto(null)} className="absolute top-3 right-3 bg-black/60 text-white p-2 rounded-full hover:bg-black/80 transition-colors"><X size={16}/></button>
                    </div>
                  ) : (
                    <div className="relative w-full aspect-video bg-slate-100 border-2 border-dashed border-slate-300 rounded-xl overflow-hidden flex flex-col items-center justify-center text-slate-400 hover:bg-slate-50 transition-colors">
                      <div className="flex flex-col items-center gap-2 pointer-events-none">
                        <Camera size={48}/>
                        <span className="font-semibold text-sm">Tirar Foto ou Galeria</span>
                      </div>
                      <input type="file" accept="image/*" capture="environment" onChange={handlePhotoUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                    </div>
                  )}
                </div>
                
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-semibold text-slate-700">Descrição</label>
                  <textarea className="p-3 border border-slate-300 rounded-lg outline-none text-base bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 resize-y min-h-[80px]" placeholder="Descreva o problema..." value={description} onChange={e => setDescription(e.target.value)} rows="3" />
                </div>
                
                <div className="flex flex-col gap-1.5 mb-2">
                  <label className="text-sm font-semibold text-slate-700">Disciplina</label>
                  <select className="p-3 border border-slate-300 rounded-lg outline-none text-base bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" value={discipline} onChange={e => setDiscipline(e.target.value)}>
                    <option value="">Selecione...</option>
                    {DISCIPLINES.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                
                <button onClick={saveItem} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold p-4 rounded-xl shadow-md transition-transform active:scale-95 text-base">
                  {editingId ? 'Salvar Alterações' : 'Salvar Vistoria'}
                </button>
              </div>
            </div>
          );
        })()}
      </main>

      {/* Floating Action Button */}
      {view === 'list' && !isMarking && (
         <button className="print:hidden fixed bottom-[90px] left-1/2 -translate-x-1/2 w-auto px-6 h-12 bg-amber-400 text-slate-900 rounded-full flex items-center justify-center gap-2 shadow-lg shadow-amber-400/40 z-20 transition-transform active:translate-y-0.5 font-bold text-[15px] whitespace-nowrap hover:bg-amber-300" onClick={handleNewItem}>
           <Camera size={20}/> Nova Vistoria
         </button>
      )}

      {/* Barra de Navegação Inferior */}
      {!isMarking && (
        <nav className="print:hidden fixed bottom-0 left-0 w-full bg-white border-t border-slate-200 flex justify-around py-3 pb-5 z-20 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
          <button onClick={() => { setView('dashboard'); setSelectedProject(null); setSelectedStage(null); setSelectedLocation(null); }} className={`flex flex-col items-center gap-1 w-20 transition-colors ${view === 'dashboard' ? 'text-indigo-600' : 'text-slate-400'}`}>
            <BarChart3 size={24}/><span className="text-[10px] font-bold uppercase tracking-wider">Status</span>
          </button>
          <button onClick={() => { setView('projects'); setSelectedProject(null); setSelectedStage(null); setSelectedLocation(null); }} className={`flex flex-col items-center gap-1 w-20 transition-colors ${['projects', 'stages', 'locations'].includes(view) ? 'text-indigo-600' : 'text-slate-400'}`}>
            <Building2 size={24}/><span className="text-[10px] font-bold uppercase tracking-wider">Obras</span>
          </button>
          <button onClick={() => { setView('list'); setSelectedProject(null); setSelectedStage(null); setSelectedLocation(null); }} className={`flex flex-col items-center gap-1 w-20 transition-colors ${['list', 'form'].includes(view) ? 'text-indigo-600' : 'text-slate-400'}`}>
            <FileText size={24}/><span className="text-[10px] font-bold uppercase tracking-wider">Checklists</span>
          </button>
          {role === 'manager' && (
            <button onClick={() => { setView('settings'); setSelectedProject(null); setSelectedStage(null); setSelectedLocation(null); }} className={`flex flex-col items-center gap-1 w-20 transition-colors ${view === 'settings' ? 'text-indigo-600' : 'text-slate-400'}`}>
              <Settings size={24}/><span className="text-[10px] font-bold uppercase tracking-wider">Config</span>
            </button>
          )}
        </nav>
      )}
    </div>
  );
}