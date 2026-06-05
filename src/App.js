import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, setDoc } from 'firebase/firestore';
import { 
  Camera, CheckCircle, Circle, AlertCircle, Trash2, 
  FileText, ArrowLeft, BarChart3, Filter, Printer, User, Building2, LogOut, Pencil, Settings, X
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
  'jessica.ctr@deville.com.br',
  'gerente@hotel.com',
  'seu.email@hotel.com'
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
  
  // Novos estados para Etapas e Locais dinâmicos
  const [customStages, setCustomStages] = useState([]);
  const [customLocations, setCustomLocations] = useState([]);
  
  // Estados do formulário (Criar e Editar)
  const [editingId, setEditingId] = useState(null);
  const [photo, setPhoto] = useState(null);
  const [description, setDescription] = useState('');
  const [discipline, setDiscipline] = useState('');

  // Filtros
  const [statusFilter, setStatusFilter] = useState('all');
  const [disciplineFilter, setDisciplineFilter] = useState('all');

  // Monitoramento de Autenticação e Banco de Dados
  useEffect(() => {
    let unsubscribeSnap = null;
    let unsubscribeStages = null;
    let unsubscribeLocs = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (loggedUser) => {
      setUser(loggedUser);
      setLoadingAuth(false);
      
      if (loggedUser) {
        if (loggedUser.email && EMAILS_GERENCIA.includes(loggedUser.email.toLowerCase())) {
          setRole('manager');
        } else {
          setRole('partner');
        }

        const q = collection(db, collectionPath);
        unsubscribeSnap = onSnapshot(q, (snapshot) => {
          const dados = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          dados.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
          setItems(dados);
        });

        // Carregar Etapas personalizadas do Firebase
        const qStages = collection(db, 'custom_stages');
        unsubscribeStages = onSnapshot(qStages, (snapshot) => {
          setCustomStages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        // Carregar Locais/Apartamentos personalizados do Firebase
        const qLocs = collection(db, 'custom_locations');
        unsubscribeLocs = onSnapshot(qLocs, (snapshot) => {
          setCustomLocations(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeSnap) unsubscribeSnap();
      if (unsubscribeStages) unsubscribeStages();
      if (unsubscribeLocs) unsubscribeLocs();
    };
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
    } catch (error) {
      alert("Credenciais inválidas. Verifique o e-mail e a senha.");
    }
  };

  const handleLogout = () => {
    signOut(auth);
  };

  const handlePhotoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setPhoto(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setPhoto(null);
    setDescription('');
    setDiscipline('');
  };

  const editItem = (item) => {
    setEditingId(item.id);
    setPhoto(item.photoUrl);
    setDescription(item.description);
    setDiscipline(item.discipline);
    setView('form');
  };

  const saveItem = async () => {
    if (!photo || !description || !discipline) return;
    try {
      if (editingId) {
        await updateDoc(doc(db, collectionPath, editingId), {
          photoUrl: photo,
          description,
          discipline
        });
      } else {
        await addDoc(collection(db, collectionPath), {
          projectId: selectedProject.id,
          stageId: selectedStage.id,
          locationId: selectedLocation,
          photoUrl: photo,
          description,
          discipline,
          createdAt: new Date().toISOString(),
          managerApproved: false,
          partnerFixed: false,
          authorEmail: user.email
        });
      }
      setView('list');
      resetForm();
    } catch (e) { 
      console.error(e); 
    }
  };

  const toggleStatus = async (item, field) => {
    if (field === 'managerApproved' && role !== 'manager') return;
    try {
      await updateDoc(doc(db, collectionPath, item.id), { [field]: !item[field] });
    } catch (e) { 
      console.error(e); 
    }
  };

  const deleteItem = async (id) => {
    if (role !== 'manager') return;
    if (window.confirm("Deseja mesmo excluir esta vistoria?")) {
      try { 
        await deleteDoc(doc(db, collectionPath, id)); 
      } catch (e) { 
        console.error(e); 
      }
    }
  };

  // --- RENDERS ---
  if (loadingAuth) return <div className="loading-screen">Carregando VistoriaPRO...</div>;

  if (!user) {
    return (
      <div className="login-container">
        <div className="login-card fade-in">
          <div className="login-icon"><Building2 size={48} /></div>
          <h1 className="login-title">Vistoria<span>PRO</span></h1>
          <p className="login-subtitle">Gestão de Checklists Deville</p>
          <form className="login-form" onSubmit={handleLogin}>
            <input type="email" placeholder="E-mail" className="login-input" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} required />
            <input type="password" placeholder="Senha" className="login-input" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} required />
            <button type="submit" className="btn-primary" style={{marginTop: '10px'}}>Entrar no Sistema</button>
          </form>
        </div>
      </div>
    );
  }

  const renderDashboard = () => {
    const total = items.length;
    const completed = items.filter(i => i.managerApproved).length;
    
    return (
      <div className="page-container fade-in">
        <h2 className="section-title">Painel de Resumo</h2>
        <div className="stats-grid">
          <div className="stat-card">
            <span className="stat-value">{total}</span>
            <span className="stat-label">Total Itens</span>
          </div>
          <div className="stat-card">
            <span className="stat-value text-green">{completed}</span>
            <span className="stat-label">Concluídos</span>
          </div>
        </div>
      </div>
    );
  };

  const renderProjects = () => (
    <div className="page-container fade-in">
      <h2 className="section-title">Selecione a Obra</h2>
      <div className="list-group">
        {INITIAL_PROJECTS.map(p => (
          <button key={p.id} className="list-item" onClick={() => { setSelectedProject(p); setView('stages'); }}>
            <span className="icon-blue"><Building2 size={24} /></span> {p.name}
          </button>
        ))}
      </div>
    </div>
  );

  const renderSettings = () => (
    <div className="page-container fade-in">
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
        <h2 className="section-title mb-0">Configurações</h2>
        <button onClick={() => setView('dashboard')} className="icon-btn"><X size={24}/></button>
      </div>
      <div style={{background: 'white', padding: '30px', borderRadius: '12px', border: '1px solid #e2e8f0', textAlign: 'center'}}>
        <Settings size={48} color="#94a3b8" style={{marginBottom: '16px', opacity: 0.5}} />
        <p style={{color: '#64748b', fontWeight: 'bold'}}>Opções do aplicativo em desenvolvimento.</p>
        <button onClick={() => setView('dashboard')} className="btn-primary" style={{marginTop: '24px'}}>Voltar ao Início</button>
      </div>
    </div>
  );

  const renderList = () => {
    let filteredItems = items.filter(i => i.locationId === selectedLocation);
    
    if (statusFilter === 'pending') filteredItems = filteredItems.filter(i => !i.managerApproved);
    if (statusFilter === 'completed') filteredItems = filteredItems.filter(i => i.managerApproved);
    if (disciplineFilter !== 'all') filteredItems = filteredItems.filter(i => i.discipline === disciplineFilter);

    return (
      <div className="page-container fade-in">
        <div className="hide-print list-header" style={{marginBottom: '8px'}}>
          <h2 className="section-title mb-0">Itens: {selectedLocation}</h2>
          <button onClick={() => window.print()} className="btn-secondary">
            <Printer size={16}/> PDF
          </button>
        </div>

        {/* PAINEL DE FILTROS */}
        <div className="filter-panel hide-print">
          <div className="filter-title"><Filter size={16} /> Filtros</div>
          <div className="filter-inputs">
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="all">Todos os Status</option>
              <option value="pending">Em Andamento</option>
              <option value="completed">Concluídos</option>
            </select>
            <select value={disciplineFilter} onChange={e => setDisciplineFilter(e.target.value)}>
              <option value="all">Todas as Disciplinas</option>
              {DISCIPLINES.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        </div>

        <div className="checklist">
          {filteredItems.length === 0 ? <p className="empty-state">Nenhum registro encontrado.</p> : 
            filteredItems.map(item => (
              <div key={item.id} className={`checklist-item ${item.managerApproved ? 'approved' : ''}`}>
                <div className="item-thumbnail">
                  <img src={item.photoUrl} alt="Vistoria" />
                </div>
                <div className="item-content">
                  <div className="item-header-row">
                    <span className="tag-discipline">{item.discipline}</span>
                    
                    {/* ÍCONES DE EDIÇÃO E EXCLUSÃO (Somente Gerente) */}
                    {role === 'manager' && !item.managerApproved && (
                      <div className="item-actions-top hide-print">
                        <button onClick={() => editItem(item)} className="btn-edit"><Pencil size={16}/></button>
                        <button onClick={() => deleteItem(item.id)} className="btn-delete"><Trash2 size={16}/></button>
                      </div>
                    )}
                  </div>
                  <p className="item-desc">{item.description}</p>
                  
                  <div className="item-status-row hide-print">
                    <button 
                      onClick={() => toggleStatus(item, 'partnerFixed')} disabled={item.managerApproved}
                      className={`check-btn ${item.partnerFixed ? 'checked-partner' : ''}`}
                    >
                      {item.partnerFixed ? <CheckCircle size={16}/> : <Circle size={16}/>} Parceiro
                    </button>
                    <button 
                      onClick={() => toggleStatus(item, 'managerApproved')} disabled={role !== 'manager'}
                      className={`check-btn ${item.managerApproved ? 'checked-manager' : ''}`}
                    >
                      {item.managerApproved ? <CheckCircle size={16}/> : <Circle size={16}/>} OK Gerente
                    </button>
                  </div>
                </div>
              </div>
            ))
          }
        </div>
        <button className="fab-btn hide-print" onClick={() => { resetForm(); setView('form'); }}><Camera size={30}/></button>
      </div>
    );
  };

  const handleBack = () => {
    if (view === 'form') setView('list');
    else if (view === 'list' && selectedLocation) { setSelectedLocation(null); setView('locations'); }
    else if (view === 'list' && !selectedLocation) setView('projects');
    else if (view === 'locations') { setSelectedStage(null); setView('stages'); }
    else if (view === 'stages') { setSelectedProject(null); setView('projects'); }
  };

  return (
    <div className="app-layout">
      {/* HEADER DE PRODUÇÃO COM USUÁRIO E LOGOUT */}
      <header className="app-header hide-print">
        <div className="header-left">
          {view !== 'dashboard' && view !== 'projects' && (
            <button onClick={handleBack} className="back-btn"><ArrowLeft size={20}/></button>
          )}
          <h1 className="app-title">Vistoria<span>PRO</span></h1>
        </div>
        <div className="header-right">
          <button onClick={() => setView('settings')} className="icon-btn" title="Configurações">
            <Settings size={20} />
          </button>
          <div className="user-info">
            <span className="user-email">{user.email.split('@')[0]}</span>
            <span className={`user-badge ${role === 'manager' ? 'badge-manager' : 'badge-partner'}`}>
              {role === 'manager' ? 'Gerente' : 'Parceiro'}
            </span>
          </div>
          <button onClick={handleLogout} className="btn-logout" title="Sair"><LogOut size={20}/></button>
        </div>
      </header>

      <main className="app-main">
        {view === 'dashboard' && renderDashboard()}
        {view === 'projects' && renderProjects()}
        {view === 'settings' && renderSettings()}
        {view === 'stages' && (() => {
          const baseStages = STAGES[selectedProject?.id] || [];
          const dynStages = customStages.filter(s => s.projectId === selectedProject?.id);
          const allStages = [...baseStages, ...dynStages];
          
          return (
            <div className="page-container fade-in">
              <h2 className="section-title">{selectedProject.name} - Etapas</h2>
              <div className="list-group">
                {allStages.map(s => (
                  <button key={s.id} className="list-item" onClick={() => { setSelectedStage(s); setView('locations'); }}>{s.name}</button>
                ))}
                {role === 'manager' && (
                  <button className="list-item" onClick={async () => {
                    const name = window.prompt("Nome da nova etapa (Ex: Térreo, Pavimento 1):");
                    if (name && name.trim() !== '') {
                      try { await addDoc(collection(db, 'custom_stages'), { projectId: selectedProject.id, name: name.trim() }); } 
                      catch (e) { alert("Erro ao criar etapa."); }
                    }
                  }} style={{ borderStyle: 'dashed', justifyContent: 'center', background: 'transparent' }}>
                    <span className="list-text" style={{ color: '#64748b' }}>+ Adicionar Nova Etapa</span>
                  </button>
                )}
              </div>
            </div>
          );
        })()}
        {view === 'locations' && (() => {
          const baseLocs = selectedStage?.locations || [];
          const dynLocs = customLocations.filter(l => l.stageId === selectedStage?.id).map(l => l.name);
          const allLocations = Array.from(new Set([...baseLocs, ...dynLocs]));

          return (
            <div className="page-container fade-in">
              <h2 className="section-title">{selectedStage.name} - Locais</h2>
              <div className="grid-locations">
                {allLocations.map(l => (
                  <button key={l} className="location-card" onClick={() => { setSelectedLocation(l); setView('list'); }}>{l}</button>
                ))}
                {role === 'manager' && (
                  <button className="location-card" onClick={async () => {
                    const name = window.prompt("Nome do novo local (Ex: Quarto 101, Lobby):");
                    if (name && name.trim() !== '') {
                      try { await addDoc(collection(db, 'custom_locations'), { projectId: selectedProject.id, stageId: selectedStage.id, name: name.trim() }); } 
                      catch (e) { alert("Erro ao criar local."); }
                    }
                  }} style={{ borderStyle: 'dashed', background: 'transparent' }}>
                    <span className="location-name" style={{ color: '#64748b' }}>+ Novo Local</span>
                  </button>
                )}
              </div>
            </div>
          );
        })()}
        {view === 'list' && renderList()}
        
        {/* FORMULÁRIO DE CRIAÇÃO/EDIÇÃO COMPLETO */}
        {view === 'form' && (
          <div className="page-container fade-in">
            <h2 className="section-title">{editingId ? 'Editar Registro' : 'Novo Registro'}</h2>
            <div style={{background: 'white', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0'}}>
              <div className="photo-upload-area" style={{marginBottom: '20px'}}>
                {photo ? <img src={photo} className="photo-preview" alt="Preview"/> : <div className="photo-placeholder"><Camera size={48}/><span>Capturar Imagem</span></div>}
                <input type="file" capture="environment" onChange={handlePhotoUpload} className="photo-input" />
              </div>
              <div className="form-group">
                <label className="form-label">Descrição</label>
                <textarea className="form-input" placeholder="Descreva o problema..." value={description} onChange={e => setDescription(e.target.value)} rows="3" />
              </div>
              <div className="form-group" style={{marginBottom: '24px'}}>
                <label className="form-label">Disciplina</label>
                <select className="form-input" value={discipline} onChange={e => setDiscipline(e.target.value)}>
                  <option value="">Selecione...</option>
                  {DISCIPLINES.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <button onClick={saveItem} className="btn-primary">{editingId ? 'Salvar Alterações' : 'Salvar Vistoria'}</button>
            </div>
          </div>
        )}
      </main>

      <nav className="bottom-nav hide-print">
        <button onClick={() => { setView('dashboard'); setSelectedProject(null); setSelectedStage(null); setSelectedLocation(null); }} className={view === 'dashboard' ? 'active' : ''}>
          <BarChart3 size={24}/><span>Status</span>
        </button>
        <button onClick={() => { setView('projects'); setSelectedProject(null); setSelectedStage(null); setSelectedLocation(null); }} className={['projects', 'stages', 'locations', 'list', 'form'].includes(view) ? 'active' : ''}>
          <Building2 size={24}/><span>Obras</span>
        </button>
      </nav>
    </div>
  );
}