import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged, signInWithCustomToken, signInAnonymously } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { 
  Camera, CheckCircle, Circle, Trash2, 
  FileText, ArrowLeft, BarChart3, Filter, Printer, Building2, LogOut, Settings,
  Pencil, ArrowUpRight, Circle as CircleIcon, Undo, Check, X
} from 'lucide-react';
import './App.css'; // Importação do arquivo de estilos

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

// Caminhos das coleções de dados no Firebase para Produção
const collectionPath = 'checklists';
const partnersPath = 'partners';

// --- 2. DEFINIÇÃO DE PERFIS ---
const EMAILS_GERENCIA = [
  'seu.email@hotel.com',
  'gerente@hotel.com',
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

  const [view, setView] = useState('dashboard'); 
  const [selectedProject, setSelectedProject] = useState(null);
  const [selectedStage, setSelectedStage] = useState(null);
  const [selectedLocation, setSelectedLocation] = useState(null);
  
  const [items, setItems] = useState([]);
  const [partners, setPartners] = useState([]);
  
  // Estados do formulário de Novo/Edição de Item
  const [editingItem, setEditingItem] = useState(null);
  const [returnToGlobal, setReturnToGlobal] = useState(false);
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

  // Configuração
  const [partnerEmail, setPartnerEmail] = useState('');
  const [partnerProject, setPartnerProject] = useState('');

  // Filtros Dashboard e Lista
  const [dashboardProject, setDashboardProject] = useState('all'); 
  const [statusFilter, setStatusFilter] = useState('all'); 
  const [disciplineFilter, setDisciplineFilter] = useState('all');
  const [locationFilter, setLocationFilter] = useState('all');
  const [sortBy, setSortBy] = useState('date');

  const [fullScreenImage, setFullScreenImage] = useState(null);

  // Monitora Autenticação e Carrega Dados
  useEffect(() => {
    let unsubscribeSnap = null;
    let unsubscribePartners = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (loggedUser) => {
      setUser(loggedUser);
      setLoadingAuth(false);

      if (loggedUser) {
        const userEmail = loggedUser.email || '';
        if (EMAILS_GERENCIA.includes(userEmail.toLowerCase())) {
          setRole('manager');
        } else {
          setRole('partner');
        }

        const qItems = collection(db, collectionPath);
        unsubscribeSnap = onSnapshot(qItems, (snapshot) => {
          const dadosFirebase = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          dadosFirebase.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
          setItems(dadosFirebase);
        });

        const qPartners = collection(db, partnersPath);
        unsubscribePartners = onSnapshot(qPartners, (snapshot) => {
          const dadosPartners = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setPartners(dadosPartners);
        });

      } else {
        if (unsubscribeSnap) unsubscribeSnap();
        if (unsubscribePartners) unsubscribePartners();
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeSnap) unsubscribeSnap();
      if (unsubscribePartners) unsubscribePartners();
    };
  }, []);

  // --- FUNÇÕES DE AÇÃO ---
  const handleLogin = async (e) => {
    e.preventDefault();
    try { await signInWithEmailAndPassword(auth, loginEmail, loginPassword); } 
    catch (error) { alert("Erro ao entrar. Verifique credenciais."); }
  };

  const handlePhotoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
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
          setPhoto(resizedBase64); setOriginalPhoto(resizedBase64);
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    }
  };

  const saveItem = async () => {
    if (!photo || !description || !discipline) return;
    try {
      if (editingItem) {
        await updateDoc(doc(db, collectionPath, editingItem.id), { photoUrl: photo, description, discipline });
      } else {
        await addDoc(collection(db, collectionPath), { 
          projectId: selectedProject.id, stageId: selectedStage.id, locationId: selectedLocation,
          photoUrl: photo, description, discipline, partnerFixed: false, managerApproved: false,
          createdAt: new Date().toISOString(), authorEmail: user?.email || 'usuario' 
        });
      }
      
      if (returnToGlobal) { setView('list'); setSelectedProject(null); setSelectedStage(null); setSelectedLocation(null); } 
      else { setView('list'); }
      
      setPhoto(null); setOriginalPhoto(null); setDescription(''); setDiscipline(''); setEditingItem(null);
    } catch (e) { console.error("Erro ao salvar:", e); }
  };

  const handleEditItem = (item) => {
    setEditingItem(item);
    setPhoto(item.photoUrl);
    setOriginalPhoto(item.photoUrl);
    setDescription(item.description);
    setDiscipline(item.discipline);
    
    // Configura os contextos de obra de onde esse item veio para preencher o form corretamente
    setReturnToGlobal(selectedLocation === null);
    setSelectedProject(INITIAL_PROJECTS.find(p => p.id === item.projectId));
    setSelectedStage(STAGES[item.projectId]?.find(s => s.id === item.stageId));
    setSelectedLocation(item.locationId);
    
    setView('form');
  };

  const toggleStatus = async (item, field) => {
    if (field === 'managerApproved' && role !== 'manager') return;
    try { await updateDoc(doc(db, collectionPath, item.id), { [field]: !item[field] }); } 
    catch (e) { console.error("Erro ao atualizar:", e); }
  };

  const deleteItem = async (id) => {
    if (role !== 'manager') return;
    if(window.confirm("Tem certeza que deseja apagar este item?")) {
      try { await deleteDoc(doc(db, collectionPath, id)); } 
      catch (e) { console.error("Erro ao remover:", e); }
    }
  };

  const handleAddPartner = async () => {
    if(!partnerEmail || !partnerProject) return;
    try { await addDoc(collection(db, partnersPath), { email: partnerEmail.toLowerCase(), projectId: partnerProject }); setPartnerEmail(''); setPartnerProject(''); } 
    catch (e) { console.error("Erro ao vincular parceiro:", e); }
  };

  const handleDeletePartner = async (id) => {
    if(window.confirm("Remover acesso deste parceiro?")) {
      try { await deleteDoc(doc(db, partnersPath, id)); } catch (e) { console.error("Erro:", e); }
    }
  };

  // --- EDITOR DE IMAGEM ---
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
    if (canvasRef.current) { setPhoto(canvasRef.current.toDataURL('image/jpeg', 0.8)); setIsEditingPhoto(false); }
  };

  // --- TELA DE LOGIN ---
  if (loadingAuth) return <div className="loading-screen">Carregando VistoriaPRO...</div>;

  if (!user) {
    return (
      <div className="login-container fade-in">
        <div className="login-card">
          <Building2 size={48} className="login-icon" />
          <h1 className="login-title">Vistoria<span>PRO</span></h1>
          <p className="login-subtitle">Gestão de Checklists de Obras</p>
          <form className="login-form" onSubmit={handleLogin}>
            <input type="email" placeholder="E-mail" className="login-input" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} required />
            <input type="password" placeholder="Senha" className="login-input" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} required />
            <button type="submit" className="btn-primary">Entrar no Sistema</button>
          </form>
        </div>
      </div>
    );
  }

  // --- RENDERS DAS PÁGINAS ---
  const renderDashboard = () => {
    // Parceiros só enxergam dados das obras deles
    let dashboardSource = items;
    if (role === 'partner') {
       const myProjectIds = partners.filter(p => p.email === user.email).map(p => p.projectId);
       dashboardSource = items.filter(i => myProjectIds.includes(i.projectId));
    }

    const dashboardItems = dashboardProject === 'all' ? dashboardSource : dashboardSource.filter(i => i.projectId === dashboardProject);
    const total = dashboardItems.length;
    const completed = dashboardItems.filter(i => i.managerApproved).length;
    const pending = total - completed;
    const partnerFixed = dashboardItems.filter(i => i.partnerFixed && !i.managerApproved).length;
    const progress = total === 0 ? 0 : Math.round((completed / total) * 100);

    const discCount = dashboardItems.reduce((acc, curr) => { acc[curr.discipline] = (acc[curr.discipline] || 0) + 1; return acc; }, {});
    const topDisciplines = Object.entries(discCount).sort((a, b) => b[1] - a[1]).slice(0, 4);

    const availableProjects = role === 'manager' 
      ? INITIAL_PROJECTS 
      : INITIAL_PROJECTS.filter(p => partners.some(partner => partner.email === user.email && partner.projectId === p.id));

    return (
      <div className="page-container fade-in">
        <h2 className="section-title mb-0">Resumo Geral</h2>
        <select className="form-input" value={dashboardProject} onChange={(e) => setDashboardProject(e.target.value)}>
          <option value="all">Todas as Obras Permitidas</option>
          {availableProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <div className="stats-grid">
          <div className="stat-card"><span className="stat-value">{total}</span><span className="stat-label">Total de Itens</span></div>
          <div className="stat-card"><span className="stat-value text-green">{progress}%</span><span className="stat-label">Concluído</span></div>
          <div className="stat-card"><span className="stat-value text-orange">{partnerFixed}</span><span className="stat-label">Aguardando Avaliação</span></div>
          <div className="stat-card"><span className="stat-value text-red">{pending - partnerFixed}</span><span className="stat-label">Pendentes</span></div>
        </div>
        <div className="chart-card">
          <h3 className="chart-title"><BarChart3 size={20} /> Disciplinas Mais Recorrentes</h3>
          {topDisciplines.length === 0 ? (<p className="text-muted">Nenhum dado registado ainda.</p>) : (
            <div className="chart-list">
              {topDisciplines.map(([disc, count], idx) => (
                <div key={idx} className="chart-row">
                  <div className="chart-row-header"><span>{disc}</span><span className="text-muted">{count} itens ({Math.round((count/total)*100)}%)</span></div>
                  <div className="progress-bar-bg"><div className="progress-bar-fill" style={{ width: `${(count/total)*100}%` }}></div></div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderProjects = () => {
    return (
      <div className="page-container fade-in">
        <h2 className="section-title">Selecione a Obra</h2>
        <div className="list-group">
          {INITIAL_PROJECTS.map(proj => (
            <button key={proj.id} onClick={() => { setSelectedProject(proj); setView('stages'); }} className="list-item">
              <Building2 size={24} className="icon-blue" />
              <span className="list-text">{proj.name}</span>
            </button>
          ))}
        </div>
      </div>
    );
  };

  const renderStages = () => {
    const stages = STAGES[selectedProject?.id] || [];
    return (
      <div className="page-container fade-in">
        <h2 className="section-title center">Etapas de {selectedProject?.name}</h2>
        <div className="list-group">
          {stages.map(stage => (
            <button key={stage.id} onClick={() => { setSelectedStage(stage); setView('locations'); }} className="list-item"><span className="list-text">{stage.name}</span></button>
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
            const locItems = items.filter(i => i.projectId === selectedProject.id && i.stageId === selectedStage.id && i.locationId === loc);
            const pending = locItems.filter(i => !i.managerApproved).length;
            return (
              <button key={idx} onClick={() => { setSelectedLocation(loc); setView('list'); }} className="location-card">
                <span className="location-name">{loc}</span>{pending > 0 && <span className="badge-alert">{pending}</span>}
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
        <h2 className="section-title">{editingItem ? 'Editar Não Conformidade' : 'Nova Não Conformidade'}</h2>
        <p className="breadcrumb">{selectedProject?.name} &gt; {selectedLocation}</p>

        <div style={{display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '8px'}}>
          <div className="photo-upload-area" style={{marginBottom: 0}}>
            {photo ? (<img src={photo} alt="Preview" className="photo-preview" />) : (<div className="photo-placeholder"><Camera size={48} /><span>Toque para capturar imagem</span></div>)}
            {!photo && <input type="file" accept="image/*" capture="environment" onChange={handlePhotoUpload} className="photo-input" />}
          </div>
          
          {photo && (
            <div style={{display: 'flex', gap: '8px'}}>
              <button onClick={() => setIsEditingPhoto(true)} className="btn-outline" style={{flex: 1}}><Pencil size={18}/> Marcar Foto</button>
              <div style={{position: 'relative', width: '44px'}}>
                 <button className="btn-outline" style={{width: '100%', padding: '0', height: '100%', borderColor: '#ef4444', color: '#ef4444'}}><Trash2 size={18}/></button>
                 <input type="file" accept="image/*" capture="environment" onChange={handlePhotoUpload} className="photo-input" />
              </div>
            </div>
          )}
        </div>

        <div className="form-group" style={{marginBottom: '16px'}}>
          <label style={{display: 'block', fontSize: '14px', fontWeight: 'bold', color: '#334155', marginBottom: '6px'}}>Descrição do Problema</label>
          <textarea className="form-input" value={description} onChange={e => setDescription(e.target.value)} rows="3" placeholder="Descreva a não conformidade..."></textarea>
        </div>
        <div className="form-group" style={{marginBottom: '20px'}}>
          <label style={{display: 'block', fontSize: '14px', fontWeight: 'bold', color: '#334155', marginBottom: '6px'}}>Disciplina</label>
          <select className="form-input" value={discipline} onChange={e => setDiscipline(e.target.value)}>
            <option value="">Selecione...</option>{DISCIPLINES.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <button onClick={saveItem} className="btn-primary">Salvar Registro</button>
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
    let filteredItems = items;
    const isObrasTab = selectedLocation != null;

    // Limita visão dos parceiros apenas às obras permitidas
    if (role === 'partner') {
       const myProjectIds = partners.filter(p => p.email === user.email).map(p => p.projectId);
       filteredItems = filteredItems.filter(i => myProjectIds.includes(i.projectId));
    }

    if (isObrasTab) {
      filteredItems = filteredItems.filter(i => i.projectId === selectedProject?.id && i.stageId === selectedStage?.id && i.locationId === selectedLocation);
    } else if (selectedProject) {
      filteredItems = filteredItems.filter(i => i.projectId === selectedProject.id);
    }

    const availableLocations = Array.from(new Set(filteredItems.map(i => i.locationId))).filter(Boolean).sort();

    if (statusFilter === 'pending') filteredItems = filteredItems.filter(i => !i.managerApproved);
    if (statusFilter === 'completed') filteredItems = filteredItems.filter(i => i.managerApproved);
    if (disciplineFilter !== 'all') filteredItems = filteredItems.filter(i => i.discipline === disciplineFilter);
    if (locationFilter !== 'all') filteredItems = filteredItems.filter(i => i.locationId === locationFilter);

    filteredItems.sort((a, b) => {
      if (sortBy === 'discipline') return a.discipline.localeCompare(b.discipline);
      if (sortBy === 'location') return (a.locationId || '').localeCompare(b.locationId || '');
      return new Date(b.createdAt) - new Date(a.createdAt); 
    });

    return (
      <div className="page-container fade-in">
        <div className="hide-print" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px'}}>
          <h2 className="section-title mb-0">{isObrasTab ? `Itens - ${selectedLocation}` : 'Checklists'}</h2>
          
          {/* Somente exibe gerar PDF na aba de Checklists globais */}
          {!isObrasTab && (
            <button onClick={() => window.print()} className="btn-secondary"><Printer size={16}/> PDF</button>
          )}
        </div>

        <div className="filter-panel hide-print">
          <div className="filter-title"><Filter size={16} /> Filtros Rápidos e Ordenação</div>
          <div className="filter-inputs" style={{ flexWrap: 'wrap' }}>
            {!isObrasTab && (
              <select value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)}>
                <option value="all">Todos os Locais</option>
                {availableLocations.map(loc => <option key={loc} value={loc}>{loc}</option>)}
              </select>
            )}
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">Todos Status</option>
              <option value="pending">Em Andamento</option>
              <option value="completed">Concluídos</option>
            </select>
            <select value={disciplineFilter} onChange={(e) => setDisciplineFilter(e.target.value)}>
              <option value="all">Disciplinas</option>
              {DISCIPLINES.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="date">Ordem: Mais Recentes</option>
              <option value="discipline">Ordem: Disciplina</option>
              <option value="location">Ordem: Local</option>
            </select>
          </div>
        </div>

        <div className="checklist">
          {filteredItems.length === 0 ? (
            <div className="empty-state">Nenhum item encontrado.</div>
          ) : (
            filteredItems.map(item => (
              <div key={item.id} className={`checklist-item ${item.managerApproved ? 'approved' : ''}`}>
                <div className="item-thumbnail" onClick={() => item.photoUrl && setFullScreenImage(item.photoUrl)}>
                  {item.photoUrl ? <img src={item.photoUrl} alt="Vistoria" /> : <Camera color="#cbd5e1"/>}
                </div>
                <div className="item-content">
                  
                  <div className="item-header">
                    <span className="tag-discipline">{item.discipline}</span>
                    
                    {/* Botões de Ação de Edição/Exclusão do Item - Apenas para Gerente */}
                    {role === 'manager' && (
                      <div style={{display: 'flex', gap: '12px'}}>
                        <button onClick={() => handleEditItem(item)} className="btn-delete hide-print" style={{color: '#3b82f6'}} title="Editar item">
                          <Pencil size={18} />
                        </button>
                        <button onClick={() => deleteItem(item.id)} className="btn-delete hide-print" title="Excluir item">
                          <Trash2 size={18} />
                        </button>
                      </div>
                    )}
                  </div>
                  
                  <p className="item-desc">{item.description}</p>
                  
                  {/* Incluir o texto Local: antes do local se for a aba Checklists */}
                  {!isObrasTab && <p className="item-loc"><strong>Local:</strong> {item.locationId}</p>}
                  
                  {/* Botões de OK Final / Corrigido SOMENTE na aba de Checklists */}
                  {!isObrasTab && (
                    <div className="item-actions">
                      <button 
                        onClick={() => toggleStatus(item, 'partnerFixed')} disabled={item.managerApproved}
                        className={`check-btn ${item.partnerFixed ? 'checked-partner' : ''}`}
                      >
                        {item.partnerFixed ? <CheckCircle size={18} className="hide-print"/> : <Circle size={18} className="hide-print"/>}
                        <span className="hide-print">Corrigido</span>
                      </button>
                      <button 
                        onClick={() => toggleStatus(item, 'managerApproved')} disabled={role === 'partner'}
                        className={`check-btn ${item.managerApproved ? 'checked-manager' : ''} ${role === 'partner' ? 'disabled' : ''}`}
                      >
                        {item.managerApproved ? <CheckCircle size={18} className="hide-print"/> : <Circle size={18} className="hide-print"/>}
                        <span className="hide-print">OK Final</span>
                      </button>
                    </div>
                  )}

                </div>
              </div>
            ))
          )}
        </div>

        {/* FAB PARA CRIAR ITEM - Apenas Gerente e se estiver dentro de uma Obra (Local Específico) */}
        {isObrasTab && role === 'manager' && (
           <button onClick={() => { setEditingItem(null); setPhoto(null); setOriginalPhoto(null); setDescription(''); setDiscipline(''); setView('form'); }} className="fab-btn hide-print">
             <Camera size={20} /> Nova Vistoria
           </button>
        )}
      </div>
    );
  };

  const renderSettings = () => (
    <div className="page-container fade-in">
      <h2 className="section-title">Gestão de Acessos</h2>
      
      <div className="settings-card">
        <h3 style={{fontSize: '15px', fontWeight: 'bold', color: '#1e293b', marginBottom: '12px'}}>Adicionar E-mail de Parceiro</h3>
        <input type="email" placeholder="E-mail do fornecedor" className="form-input" style={{marginBottom: '10px'}} value={partnerEmail} onChange={e => setPartnerEmail(e.target.value)} />
        <select className="form-input" style={{marginBottom: '16px'}} value={partnerProject} onChange={e => setPartnerProject(e.target.value)}>
          <option value="">Selecione a Obra para liberar acesso...</option>
          {INITIAL_PROJECTS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <button className="btn-primary" onClick={handleAddPartner}>Vincular Parceiro</button>
      </div>

      <h3 style={{fontSize: '16px', fontWeight: 'bold', marginTop: '12px', marginBottom: '8px', color: '#1e293b'}}>Parceiros Vinculados</h3>
      <div className="list-group">
        {partners.map(p => (
          <div key={p.id} className="list-item" style={{display: 'flex', justifyContent: 'space-between'}}>
            <div>
              <div style={{fontWeight: 'bold', fontSize: '14px', color: '#1e3a8a'}}>{p.email}</div>
              <div style={{fontSize: '12px', color: '#64748b'}}>{INITIAL_PROJECTS.find(proj => proj.id === p.projectId)?.name}</div>
            </div>
            <button onClick={() => handleDeletePartner(p.id)} className="btn-delete"><Trash2 size={20}/></button>
          </div>
        ))}
        {partners.length === 0 && <p className="text-muted" style={{textAlign: 'center', padding: '20px 0'}}>Nenhum parceiro vinculado.</p>}
      </div>
    </div>
  );

  const handleBack = () => {
    if (view === 'form') { 
      if (returnToGlobal) { setView('list'); setSelectedProject(null); setSelectedLocation(null); } 
      else { setView('list'); }
      setPhoto(null); setOriginalPhoto(null); setEditingItem(null);
    }
    else if (view === 'list' && selectedLocation) { setSelectedLocation(null); setView('locations'); }
    else if (view === 'list' && !selectedLocation) setView('projects');
    else if (view === 'locations') { setSelectedStage(null); setView('stages'); }
    else if (view === 'stages') { setSelectedProject(null); setView('projects'); }
  };

  return (
    <div className="app-layout">
      {isEditingPhoto && renderPhotoEditor()}

      {fullScreenImage && (
        <div className="editor-overlay fade-in" style={{zIndex: 10000}} onClick={() => setFullScreenImage(null)}>
           <div className="editor-header">
             <span style={{fontWeight: 'bold'}}>Foto da Vistoria</span>
             <button onClick={() => setFullScreenImage(null)} className="editor-header-btn">Fechar <X size={20}/></button>
           </div>
           <div className="editor-canvas-container" style={{padding: '20px'}}>
             <img src={fullScreenImage} style={{maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: '8px'}} alt="Ampliada" />
           </div>
        </div>
      )}

      <header className="app-header hide-print">
        <div className="header-left">
          {view !== 'dashboard' && view !== 'projects' && (
            <button onClick={handleBack} className="back-btn"><ArrowLeft size={24} /></button>
          )}
          <h1 className="app-title">Vistoria<span>PRO</span></h1>
        </div>
        
        <div className="header-right">
          <div className="user-info">
            <span className="user-email">{user.email ? user.email.split('@')[0] : ''}</span>
            <span className={`user-badge ${role === 'manager' ? 'badge-manager' : 'badge-partner'}`}>
              {role === 'manager' ? 'Gerente' : 'Parceiro'}
            </span>
          </div>
          <button onClick={() => signOut(auth)} className="btn-logout" title="Sair do sistema"><LogOut size={20}/></button>
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
        
        {/* Menu OBRAS visível apenas para Gerentes */}
        {role === 'manager' && (
          <button onClick={() => { setView('projects'); setSelectedProject(null); setSelectedStage(null); setSelectedLocation(null); }} className={['projects','stages','locations'].includes(view) ? 'active' : ''}>
            <Building2 size={24} /><span>Obras</span>
          </button>
        )}

        <button onClick={() => { setView('list'); setSelectedProject(null); setSelectedStage(null); setSelectedLocation(null); }} className={view === 'list' && !selectedLocation ? 'active' : ''}>
          <FileText size={24} /><span>Checklists</span>
        </button>
        
        {/* Menu CONFIG visível apenas para Gerentes */}
        {role === 'manager' && (
          <button onClick={() => { setView('settings'); setSelectedProject(null); setSelectedStage(null); setSelectedLocation(null); }} className={view === 'settings' ? 'active' : ''}>
            <Settings size={24} /><span>Config</span>
          </button>
        )}
      </nav>
    </div>
  );
}