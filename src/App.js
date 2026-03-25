import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, setDoc } from 'firebase/firestore';
import { 
  Camera, CheckCircle, Circle, Trash2, 
  FileText, ArrowLeft, BarChart3, Filter, Printer, Building2, LogOut, Pencil, Settings, X,
  ArrowUpRight, Circle as CircleIcon, Undo, Check
} from 'lucide-react';
import './App.css';

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

// --- 2. DEFINIÇÃO DE PERFIS ---
const EMAILS_GERENCIA = [
  'pedro.ctr@deville.com.br',
  'stephanie.ctr@deville.com.br',
  'alan.ctr@deville.com.br',
  'raphael.ctr@deville.com.br',
  'jessica.ctr@deville.com.br'
];

// --- 3. DADOS FIXOS DAS OBRAS ---
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
    { id: 'st5', name: 'ETAPA 05 - PAV 6 E 7', locations: ['609', '610', '611', '612', 'Suite 613', '709', '710', '711', '712', 'Corredor Pav. 6', 'Corredor Pav. 7'] },
    { id: 'st6', name: 'ETAPA 06 - PAV 2 E 3', locations: ['209', '210', '211', '212', 'Suite 213', '309', '310', '311', '312', 'Corredor Pav. 2', 'Corredor Pav. 3'] },
    { id: 'st7', name: 'ETAPA 07 - PAV 4', locations: ['409', '410', '411', '412', 'Suite 413', 'Corredor Pav. 4'] },
  ]
};

const DISCIPLINES = ['Civil', 'Pintura', 'Hidráulica', 'Elétrica', 'Manutenção', 'Limpeza', 'Marcenaria', 'Marmoraria', 'EC'];
const EDITOR_COLORS = ['#ef4444', '#eab308', '#3b82f6', '#000000', '#ffffff']; 

// --- 4. COMPONENTE PRINCIPAL ---
export default function App() {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState('partner');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loadingAuth, setLoadingAuth] = useState(true);

  const [projectAccess, setProjectAccess] = useState({});
  const [view, setView] = useState('dashboard'); 
  const [selectedProject, setSelectedProject] = useState(null);
  const [selectedStage, setSelectedStage] = useState(null);
  const [selectedLocation, setSelectedLocation] = useState(null);
  
  const [dashboardProject, setDashboardProject] = useState('all');
  const [configProject, setConfigProject] = useState(null);
  const [newPartnerEmail, setNewPartnerEmail] = useState('');

  const [items, setItems] = useState([]);
  const [editingItemId, setEditingItemId] = useState(null);
  const [photo, setPhoto] = useState(null);
  const [originalPhoto, setOriginalPhoto] = useState(null);
  const [description, setDescription] = useState('');
  const [discipline, setDiscipline] = useState('');

  // Estados do Editor de Imagens (Canvas)
  const [isEditingPhoto, setIsEditingPhoto] = useState(false);
  const [drawTool, setDrawTool] = useState('pencil');
  const [drawColor, setDrawColor] = useState(EDITOR_COLORS[0]);
  const canvasRef = useRef(null);
  const snapshotRef = useRef(null);
  const isDrawingRef = useRef(false);
  const startPosRef = useRef({ x: 0, y: 0 });

  const [statusFilter, setStatusFilter] = useState('all'); 
  const [disciplineFilter, setDisciplineFilter] = useState('all');
  const [sortOrder, setSortOrder] = useState('recent'); 

  useEffect(() => {
    let unsubscribeSnap = null;
    let unsubscribeAccess = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoadingAuth(false);

      if (currentUser) {
        if (EMAILS_GERENCIA.includes(currentUser.email.toLowerCase())) {
          setRole('manager');
        } else {
          setRole('partner');
        }

        const q = collection(db, collectionPath);
        unsubscribeSnap = onSnapshot(q, (snapshot) => {
          const dadosFirebase = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setItems(dadosFirebase);
        });

        const qAccess = collection(db, 'project_access');
        unsubscribeAccess = onSnapshot(qAccess, (snapshot) => {
          const accessMap = {};
          snapshot.docs.forEach(doc => { accessMap[doc.id] = doc.data().authorizedEmails || []; });
          setProjectAccess(accessMap);
        });
      } else {
        if (unsubscribeSnap) unsubscribeSnap();
        if (unsubscribeAccess) unsubscribeAccess();
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeSnap) unsubscribeSnap();
      if (unsubscribeAccess) unsubscribeAccess();
    };
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
    } catch (error) {
      alert("Erro ao entrar. Verifique as credenciais.");
    }
  };

  const handleLogout = () => signOut(auth);

  const visibleProjects = role === 'manager' 
    ? INITIAL_PROJECTS 
    : INITIAL_PROJECTS.filter(p => (projectAccess[p.id] || []).includes(user?.email.toLowerCase()));

  const visibleItems = items.filter(i => visibleProjects.some(p => p.id === i.projectId));

  const handlePhotoUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onloadend = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1200; const MAX_HEIGHT = 1200;
        let width = img.width; let height = img.height;

        if (width > height) { if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; } } 
        else { if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; } }

        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        const resizedBase64 = canvas.toDataURL('image/jpeg', 0.8);
        setPhoto(resizedBase64);
        setOriginalPhoto(resizedBase64);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  };

  // --- FUNÇÕES DO EDITOR DE IMAGEM ---
  useEffect(() => {
    if (isEditingPhoto && canvasRef.current && photo) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      const img = new Image();
      img.onload = () => { canvas.width = img.width; canvas.height = img.height; ctx.drawImage(img, 0, 0); };
      img.src = photo;
    }
  }, [isEditingPhoto, photo]); 

  const getCanvasCoordinates = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: (clientX - rect.left) * (canvas.width / rect.width), y: (clientY - rect.top) * (canvas.height / rect.height) };
  };

  const startDrawing = (e) => {
    if (!canvasRef.current) return;
    if(e.cancelable) e.preventDefault(); 
    const { x, y } = getCanvasCoordinates(e);
    startPosRef.current = { x, y }; isDrawingRef.current = true;
    const canvas = canvasRef.current; const ctx = canvas.getContext('2d');
    snapshotRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height);
    ctx.beginPath(); ctx.moveTo(x, y); ctx.strokeStyle = drawColor; ctx.lineWidth = canvas.width * 0.008; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  };

  const draw = (e) => {
    if (!isDrawingRef.current || !canvasRef.current) return;
    if(e.cancelable) e.preventDefault();
    const { x, y } = getCanvasCoordinates(e);
    const canvas = canvasRef.current; const ctx = canvas.getContext('2d');

    if (drawTool === 'pencil') { ctx.lineTo(x, y); ctx.stroke(); } 
    else if (drawTool === 'arrow' || drawTool === 'circle') {
      ctx.putImageData(snapshotRef.current, 0, 0);
      const { x: startX, y: startY } = startPosRef.current;
      ctx.beginPath(); ctx.strokeStyle = drawColor; ctx.lineWidth = canvas.width * 0.008;

      if (drawTool === 'circle') {
        const radius = Math.sqrt(Math.pow(x - startX, 2) + Math.pow(y - startY, 2));
        ctx.arc(startX, startY, radius, 0, 2 * Math.PI); ctx.stroke();
      } else if (drawTool === 'arrow') {
        const headlen = canvas.width * 0.03; const angle = Math.atan2(y - startY, x - startX);
        ctx.moveTo(startX, startY); ctx.lineTo(x, y);
        ctx.lineTo(x - headlen * Math.cos(angle - Math.PI / 6), y - headlen * Math.sin(angle - Math.PI / 6));
        ctx.moveTo(x, y); ctx.lineTo(x - headlen * Math.cos(angle + Math.PI / 6), y - headlen * Math.sin(angle + Math.PI / 6));
        ctx.stroke();
      }
    }
  };

  const stopDrawing = () => { isDrawingRef.current = false; };

  const clearCanvas = () => {
    if (!canvasRef.current || !originalPhoto) return;
    const canvas = canvasRef.current; const ctx = canvas.getContext('2d');
    const img = new Image();
    img.onload = () => { ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.drawImage(img, 0, 0); };
    img.src = originalPhoto;
  };

  const saveEditedPhoto = () => {
    if (canvasRef.current) { 
      setPhoto(canvasRef.current.toDataURL('image/jpeg', 0.8)); 
      setIsEditingPhoto(false); 
    }
  };

  // --- FUNÇÕES DE CRUD ---
  const saveItem = async () => {
    if (!photo || !description || !discipline) {
      alert("Preencha todos os campos e anexe uma foto.");
      return;
    }

    try {
      if (editingItemId) {
        await updateDoc(doc(db, collectionPath, editingItemId), {
          photoUrl: photo, description, discipline, updatedAt: new Date().toISOString()
        });
      } else {
        await addDoc(collection(db, collectionPath), { 
          projectId: selectedProject.id, stageId: selectedStage.id, locationId: selectedLocation,
          photoUrl: photo, description, discipline, partnerFixed: false, managerApproved: false,
          createdAt: new Date().toISOString(), authorEmail: user.email
        });
      }
      setView('list');
      setPhoto(null); setOriginalPhoto(null); setDescription(''); setDiscipline(''); setEditingItemId(null);
    } catch (e) {
      alert("Erro ao guardar item.");
    }
  };

  const handleEdit = (item) => {
    if (role !== 'manager') return;
    setSelectedProject(INITIAL_PROJECTS.find(p => p.id === item.projectId));
    setSelectedStage(STAGES[item.projectId]?.find(s => s.id === item.stageId));
    setSelectedLocation(item.locationId);
    setPhoto(item.photoUrl); 
    setOriginalPhoto(item.photoUrl);
    setDescription(item.description); 
    setDiscipline(item.discipline);
    setEditingItemId(item.id);
    setView('form');
  };

  const togglePartnerFixed = async (item) => {
    if (item.managerApproved) return;
    try { await updateDoc(doc(db, collectionPath, item.id), { partnerFixed: !item.partnerFixed }); } 
    catch (e) { console.error(e); }
  };

  const toggleManagerApproved = async (item) => {
    if (role !== 'manager') return;
    try { await updateDoc(doc(db, collectionPath, item.id), { managerApproved: !item.managerApproved }); } 
    catch (e) { console.error(e); }
  };

  const deleteItem = async (id) => {
    if (role !== 'manager') return;
    if(window.confirm("Apagar este item permanentemente?")) {
      try { await deleteDoc(doc(db, collectionPath, id)); } 
      catch (e) { console.error(e); }
    }
  };

  if (loadingAuth) return <div className="loading-screen">Carregando...</div>;

  if (!user) {
    return (
      <div className="login-container fade-in">
        <div className="login-card">
          <Building2 size={48} className="login-icon" />
          <h1 className="login-title">Vistoria<span>PRO</span></h1>
          <p className="login-subtitle">Gestão de Checklists de Obras</p>
          <form className="login-form" onSubmit={handleLogin}>
            <input type="email" placeholder="Seu E-mail" className="login-input" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} required />
            <input type="password" placeholder="Sua Senha" className="login-input" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} required />
            <button type="submit" className="btn-primary">Entrar no Sistema</button>
          </form>
        </div>
      </div>
    );
  }

  const renderDashboard = () => {
    const dashboardItems = dashboardProject === 'all' 
      ? visibleItems 
      : visibleItems.filter(i => i.projectId === dashboardProject);

    const total = dashboardItems.length;
    const completed = dashboardItems.filter(i => i.managerApproved).length;
    const pending = total - completed;
    const partnerFixed = dashboardItems.filter(i => i.partnerFixed && !i.managerApproved).length;
    const progress = total === 0 ? 0 : Math.round((completed / total) * 100);

    const discCount = dashboardItems.reduce((acc, curr) => {
      acc[curr.discipline] = (acc[curr.discipline] || 0) + 1;
      return acc;
    }, {});
    const topDisciplines = Object.entries(discCount).sort((a, b) => b[1] - a[1]).slice(0, 4);

    return (
      <div className="page-container fade-in">
        <h2 className="section-title">Resumo Geral</h2>
        <div className="filter-panel hide-print" style={{marginBottom: 8}}>
          <select value={dashboardProject} onChange={(e) => setDashboardProject(e.target.value)} style={{width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1'}}>
            <option value="all">Todas as Minhas Obras</option>
            {visibleProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div className="stats-grid">
          <div className="stat-card"><span className="stat-value">{total}</span><span className="stat-label">Total Itens</span></div>
          <div className="stat-card"><span className="stat-value text-green">{progress}%</span><span className="stat-label">Concluído</span></div>
          <div className="stat-card"><span className="stat-value text-orange">{partnerFixed}</span><span className="stat-label">Aguardando Avaliação</span></div>
          <div className="stat-card"><span className="stat-value text-red">{pending - partnerFixed}</span><span className="stat-label">Pendentes</span></div>
        </div>
        <div className="chart-card">
          <h3 className="chart-title"><BarChart3 size={20} /> Disciplinas Mais Recorrentes</h3>
          {topDisciplines.length === 0 ? <p className="text-muted">Nenhum dado registrado.</p> : (
            <div className="chart-list">
              {topDisciplines.map(([disc, count], idx) => (
                <div key={idx} className="chart-row">
                  <div className="chart-row-header">
                    <span>{disc}</span><span className="text-muted">{count} itens ({Math.round((count/total)*100)}%)</span>
                  </div>
                  <div className="progress-bar-bg"><div className="progress-bar-fill" style={{ width: `${(count/total)*100}%` }}></div></div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderSettings = () => {
    return (
      <div className="page-container fade-in">
        <h2 className="section-title">Configurações de Acesso</h2>
        <p className="text-muted mb-0">Selecione uma obra para adicionar os fornecedores/parceiros autorizados.</p>
        <div className="form-group">
          <select value={configProject?.id || ''} onChange={(e) => setConfigProject(INITIAL_PROJECTS.find(p => p.id === e.target.value))}>
            <option value="">Selecione a Obra...</option>
            {INITIAL_PROJECTS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        {configProject && (
          <div className="settings-card">
            <h3 className="chart-title mb-0">Fornecedores em: {configProject.name}</h3>
            <div style={{display: 'flex', gap: '8px', marginBottom: '16px'}}>
              <input type="email" placeholder="E-mail do fornecedor" className="login-input" style={{flex: 1, padding: '10px'}} value={newPartnerEmail} onChange={(e) => setNewPartnerEmail(e.target.value)} />
              <button className="btn-primary" style={{width: 'auto', marginTop: 0, padding: '0 16px'}} onClick={async () => {
                if(!newPartnerEmail) return;
                const email = newPartnerEmail.toLowerCase().trim();
                const currentList = projectAccess[configProject.id] || [];
                if(!currentList.includes(email)) {
                  await setDoc(doc(db, 'project_access', configProject.id), { authorizedEmails: [...currentList, email] });
                  setNewPartnerEmail('');
                }
              }}>Adicionar</button>
            </div>
            <div className="email-list">
              {(projectAccess[configProject.id] || []).length === 0 ? (
                <p className="text-muted">Nenhum fornecedor configurado.</p>
              ) : (
                (projectAccess[configProject.id] || []).map(email => (
                  <div key={email} className="email-item">
                    <span>{email}</span>
                    <button onClick={async () => {
                      const updated = (projectAccess[configProject.id] || []).filter(e => e !== email);
                      await setDoc(doc(db, 'project_access', configProject.id), { authorizedEmails: updated });
                    }} className="btn-icon text-red" title="Remover"><X size={18}/></button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderProjects = () => (
    <div className="page-container fade-in">
      <h2 className="section-title">Selecione a Obra</h2>
      <div className="list-group">
        {visibleProjects.length === 0 && <p className="text-muted">Você não tem obras atribuídas.</p>}
        {visibleProjects.map(proj => (
          <button key={proj.id} onClick={() => { setSelectedProject(proj); setView('stages'); }} className="list-item">
            <Building2 size={24} className="icon-blue" />
            <span className="list-text">{proj.name}</span>
          </button>
        ))}
      </div>
    </div>
  );

  const renderStages = () => {
    const stages = STAGES[selectedProject?.id] || [];
    return (
      <div className="page-container fade-in">
        <h2 className="section-title center">Etapas - {selectedProject?.name}</h2>
        <div className="list-group">
          {stages.map(stage => (
            <button key={stage.id} onClick={() => { setSelectedStage(stage); setView('locations'); }} className="list-item">
              <span className="list-text">{stage.name}</span>
            </button>
          ))}
        </div>
      </div>
    );
  };

  const renderLocations = () => {
    const locations = selectedStage?.locations || [];
    return (
      <div className="page-container fade-in">
        <h2 className="section-title center">{selectedStage?.name}</h2>
        <div className="grid-locations">
          {locations.map((loc, idx) => {
            const locItems = visibleItems.filter(i => i.projectId === selectedProject.id && i.stageId === selectedStage.id && i.locationId === loc);
            const pending = locItems.filter(i => !i.managerApproved).length;
            return (
              <button key={idx} onClick={() => { setSelectedLocation(loc); setView('list'); }} className="location-card">
                <span className="location-name">{loc}</span>
                {pending > 0 && <span className="badge-alert">{pending}</span>}
              </button>
            )
          })}
        </div>
      </div>
    );
  };

  const renderForm = () => {
    return (
      <div className="page-container fade-in">
        <h2 className="section-title">{editingItemId ? 'Editar Vistoria' : 'Nova Não Conformidade'}</h2>
        <p className="breadcrumb">{selectedProject?.name} &gt; {selectedLocation}</p>
        
        <div className="form-group" style={{marginBottom: '8px'}}>
          <div className="photo-upload-area" style={{marginBottom: 0}}>
            {photo ? (<img src={photo} alt="Preview" className="photo-preview" />) : (<div className="photo-placeholder"><Camera size={48} /><span>Toque para capturar imagem</span></div>)}
            {!photo && <input type="file" accept="image/*" capture="environment" onChange={handlePhotoUpload} className="photo-input" />}
          </div>
          
          {/* Botões do Editor de Imagem (Apenas aparecem após inserir foto) */}
          {photo && (
            <div style={{display: 'flex', gap: '8px', marginTop: '8px'}}>
              <button onClick={() => setIsEditingPhoto(true)} className="btn-outline" style={{flex: 1}}><Pencil size={18}/> Marcar Foto</button>
              <div style={{position: 'relative', width: '44px'}}>
                 <button className="btn-outline" style={{width: '100%', padding: '0', height: '100%', borderColor: '#ef4444', color: '#ef4444'}}><Trash2 size={18}/></button>
                 <input type="file" accept="image/*" capture="environment" onChange={handlePhotoUpload} className="photo-input" />
              </div>
            </div>
          )}
        </div>

        <div className="form-group">
          <label>Descrição do Problema</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)} rows="3" placeholder="Descreva a não conformidade..."></textarea>
        </div>
        <div className="form-group">
          <label>Disciplina</label>
          <select value={discipline} onChange={e => setDiscipline(e.target.value)}>
            <option value="">Selecione...</option>
            {DISCIPLINES.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <button onClick={saveItem} className="btn-primary">{editingItemId ? 'Atualizar Item' : 'Salvar Item'}</button>
      </div>
    );
  };

  const renderPhotoEditor = () => {
    return (
      <div className="editor-overlay fade-in">
        <div className="editor-header">
           <button onClick={() => setIsEditingPhoto(false)} className="editor-header-btn"><X size={20}/> Voltar</button>
           <span style={{fontWeight: 'bold', fontSize: '16px'}}>Marcar Imagem</span>
           <button onClick={saveEditedPhoto} className="editor-header-btn save"><Check size={20}/> Pronto</button>
        </div>
        <div className="editor-canvas-container">
           <canvas ref={canvasRef} className="editor-canvas" onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={stopDrawing} onMouseOut={stopDrawing} onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={stopDrawing} onTouchCancel={stopDrawing} />
        </div>
        <div className="editor-toolbar">
           <div className="editor-tools">
             <button className={`editor-tool-btn ${drawTool === 'pencil' ? 'active' : ''}`} onClick={() => setDrawTool('pencil')}><Pencil size={24}/> Lápis</button>
             <button className={`editor-tool-btn ${drawTool === 'arrow' ? 'active' : ''}`} onClick={() => setDrawTool('arrow')}><ArrowUpRight size={24}/> Seta</button>
             <button className={`editor-tool-btn ${drawTool === 'circle' ? 'active' : ''}`} onClick={() => setDrawTool('circle')}><CircleIcon size={24}/> Círculo</button>
             <div style={{width: '1px', background: '#334155', margin: '0 4px'}}></div>
             <button className="editor-tool-btn" onClick={clearCanvas}><Undo size={24}/> Desfazer</button>
           </div>
           <div className="editor-colors">
             {EDITOR_COLORS.map(color => (<button key={color} className={`editor-color-btn ${drawColor === color ? 'active' : ''}`} style={{backgroundColor: color}} onClick={() => setDrawColor(color)} />))}
           </div>
        </div>
      </div>
    );
  };

  const renderList = () => {
    const isChecklistTab = !selectedLocation; 
    let filteredItems = visibleItems;

    if (!isChecklistTab) {
      filteredItems = visibleItems.filter(i => i.projectId === selectedProject?.id && i.stageId === selectedStage?.id && i.locationId === selectedLocation);
    } else if (selectedProject) {
      filteredItems = visibleItems.filter(i => i.projectId === selectedProject.id);
    }

    if (statusFilter === 'pending') filteredItems = filteredItems.filter(i => !i.managerApproved);
    if (statusFilter === 'completed') filteredItems = filteredItems.filter(i => i.managerApproved);
    if (disciplineFilter !== 'all') filteredItems = filteredItems.filter(i => i.discipline === disciplineFilter);

    filteredItems.sort((a, b) => {
      if (sortOrder === 'discipline') return a.discipline.localeCompare(b.discipline);
      if (sortOrder === 'location') return a.locationId.localeCompare(b.locationId);
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    return (
      <div className="page-container flex-col fade-in">
        <div className="print-header hide-screen">
          <h2>Relatório de Vistoria</h2>
          <h3>Obra: {selectedProject?.name || 'Múltiplas Obras'}</h3>
          {selectedStage && <h4>Etapa: {selectedStage.name}</h4>}
          {selectedLocation && <h4>Local: {selectedLocation}</h4>}
          <hr style={{margin: '10px 0'}}/>
        </div>

        <div className="list-header hide-print">
          <h2 className="section-title mb-0">{!isChecklistTab ? `Itens - ${selectedLocation}` : 'Todos os Itens'}</h2>
          {isChecklistTab && (
            <button onClick={() => window.print()} className="btn-secondary"><Printer size={16}/> PDF</button>
          )}
        </div>

        <div className="filter-panel hide-print">
          <div className="filter-title"><Filter size={16} /> Filtros Rápidos e Ordenação</div>
          <div className="filter-inputs">
            {isChecklistTab && (
              <select value={selectedProject?.id || 'all'} onChange={(e) => {
                  const projId = e.target.value;
                  if (projId === 'all') { setSelectedProject(null); } 
                  else { setSelectedProject(INITIAL_PROJECTS.find(p => p.id === projId)); }
                  setSelectedStage(null); setSelectedLocation(null);
                }}>
                <option value="all">Todas as Minhas Obras</option>
                {visibleProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            )}
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">Todos os Status</option>
              <option value="pending">Em Andamento</option>
              <option value="completed">Concluídos</option>
            </select>
            <select value={disciplineFilter} onChange={(e) => setDisciplineFilter(e.target.value)}>
              <option value="all">Todas as Disciplinas</option>
              {DISCIPLINES.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            {isChecklistTab && (
              <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value)}>
                <option value="recent">Ordem: Mais Recentes</option>
                <option value="discipline">Ordem: Disciplina</option>
                <option value="location">Ordem: Local</option>
              </select>
            )}
          </div>
        </div>

        {/* BOTÃO FIXO "NOVA VISTORIA" LOGO ABAIXO DOS FILTROS */}
        {!isChecklistTab && role === 'manager' && (
          <div className="action-bar-top hide-print">
            <button onClick={() => {
               setEditingItemId(null); setPhoto(null); setOriginalPhoto(null); setDescription(''); setDiscipline(''); setView('form');
            }} className="fab-btn-extended">
              <Camera size={20} />
              <span>Nova Vistoria</span>
            </button>
          </div>
        )}

        <div className="checklist">
          {filteredItems.length === 0 ? (
            <div className="empty-state">Nenhum item encontrado.</div>
          ) : (
            filteredItems.map(item => (
              <div key={item.id} className={`checklist-item ${item.managerApproved ? 'approved' : ''}`}>
                <div className="item-thumbnail">
                  {item.photoUrl ? <img src={item.photoUrl} alt="Vistoria" /> : <Camera color="#cbd5e1"/>}
                </div>
                <div className="item-content">
                  <div className="item-header">
                    <span className="tag-discipline">{item.discipline}</span>
                  </div>
                  <p className="item-desc">{item.description}</p>
                  {isChecklistTab && (
                    <p className="item-loc">
                      <strong>{INITIAL_PROJECTS.find(p => p.id === item.projectId)?.name}</strong><br/>Local: {item.locationId}
                    </p>
                  )}
                  
                  <div className="item-actions">
                    {isChecklistTab && (
                      <>
                        <button onClick={() => togglePartnerFixed(item)} disabled={item.managerApproved} className={`check-btn ${item.partnerFixed ? 'checked-partner' : ''}`}>
                          {item.partnerFixed ? <CheckCircle size={18} className="hide-print"/> : <Circle size={18} className="hide-print"/>}
                          <span className="hide-print">Corrigido</span>
                          <span className="hide-screen">Parceiro: {item.partnerFixed ? '[ X ]' : '[   ]'}</span>
                        </button>
                        <button onClick={() => toggleManagerApproved(item)} disabled={role === 'partner'} className={`check-btn ${item.managerApproved ? 'checked-manager' : ''} ${role === 'partner' ? 'disabled' : ''}`}>
                          {item.managerApproved ? <CheckCircle size={18} className="hide-print"/> : <Circle size={18} className="hide-print"/>}
                          <span className="hide-print">OK Final</span>
                          <span className="hide-screen">Gerente: {item.managerApproved ? '[ X ]' : '[   ]'}</span>
                        </button>
                      </>
                    )}
                    
                    <div className="spacer"></div>

                    {role === 'manager' && (
                      <>
                        <button onClick={() => handleEdit(item)} className="btn-icon text-blue hide-print" title="Editar Vistoria"><Pencil size={18}/></button>
                        <button onClick={() => deleteItem(item.id)} className="btn-icon text-red hide-print" title="Excluir Definitivamente"><Trash2 size={18}/></button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  };

  const handleBack = () => {
    if (view === 'form') { setView('list'); setEditingItemId(null); setPhoto(null); setOriginalPhoto(null); setDescription(''); setDiscipline(''); }
    else if (view === 'list' && selectedLocation) { setSelectedLocation(null); setView('locations'); }
    else if (view === 'list' && !selectedLocation) setView('projects');
    else if (view === 'locations') { setSelectedStage(null); setView('stages'); }
    else if (view === 'stages') { setSelectedProject(null); setView('projects'); }
    else if (view === 'settings') { setView('dashboard'); setConfigProject(null); }
  };

  return (
    <div className="app-layout">
      {isEditingPhoto && renderPhotoEditor()}

      <header className="app-header hide-print">
        <div className="header-left">
          {view !== 'dashboard' && view !== 'projects' && (
            <button onClick={handleBack} className="back-btn"><ArrowLeft size={24} /></button>
          )}
          <h1 className="app-title">Vistoria<span>PRO</span></h1>
        </div>
        <div className="header-right">
          <div className="user-info">
            <span className="user-email">{user.email.split('@')[0]}</span>
            <span className={`user-badge ${role === 'manager' ? 'badge-manager' : 'badge-partner'}`}>
              {role === 'manager' ? 'Gerente' : 'Fornecedor'}
            </span>
          </div>
          <button onClick={handleLogout} className="btn-logout" title="Sair"><LogOut size={20} /></button>
        </div>
      </header>

      <main className="app-main">
        {view === 'dashboard' && renderDashboard()}
        {view === 'projects' && renderProjects()}
        {view === 'stages' && renderStages()}
        {view === 'locations' && renderLocations()}
        {view === 'list' && renderList()}
        {view === 'form' && renderForm()}
        {view === 'settings' && renderSettings()}
      </main>

      <nav className="bottom-nav hide-print">
        <button onClick={() => { setView('dashboard'); setSelectedProject(null); setSelectedStage(null); setSelectedLocation(null); }} className={view === 'dashboard' ? 'active' : ''}>
          <BarChart3 size={24} /><span>Dashboard</span>
        </button>
        {role === 'manager' && (
          <button onClick={() => { setView('projects'); setSelectedProject(null); setSelectedStage(null); setSelectedLocation(null); }} className={['projects','stages','locations'].includes(view) ? 'active' : ''}>
            <Building2 size={24} /><span>Obras</span>
          </button>
        )}
        <button onClick={() => { setView('list'); setSelectedProject(null); setSelectedStage(null); setSelectedLocation(null); }} className={view === 'list' && !selectedLocation ? 'active' : ''}>
          <FileText size={24} /><span>Checklists</span>
        </button>
        {role === 'manager' && (
          <button onClick={() => { setView('settings'); setSelectedProject(null); setSelectedStage(null); setSelectedLocation(null); }} className={view === 'settings' ? 'active' : ''}>
            <Settings size={24} /><span>Config</span>
          </button>
        )}
      </nav>
    </div>
  );
}