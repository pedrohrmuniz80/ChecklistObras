import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { 
  Camera, CheckCircle, Circle, AlertCircle, Trash2, 
  FileText, ArrowLeft, BarChart3, Filter, Printer, User, Building2, LogOut
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
// Coloque aqui os e-mails das pessoas da SUA EQUIPE (que podem dar o OK Final e apagar itens)
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

// --- 4. COMPONENTE PRINCIPAL ---
export default function App() {
  // Estados de Autenticação
  const [user, setUser] = useState(null);
  const [role, setRole] = useState('partner'); // Default é partner
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loadingAuth, setLoadingAuth] = useState(true);

  // Estados de Navegação
  const [view, setView] = useState('dashboard'); 
  const [selectedProject, setSelectedProject] = useState(null);
  const [selectedStage, setSelectedStage] = useState(null);
  const [selectedLocation, setSelectedLocation] = useState(null);
  
  // Estado de Dados
  const [items, setItems] = useState([]);
  const [photo, setPhoto] = useState(null);
  const [description, setDescription] = useState('');
  const [discipline, setDiscipline] = useState('');

  // Filtros
  const [statusFilter, setStatusFilter] = useState('all'); 
  const [disciplineFilter, setDisciplineFilter] = useState('all');

  // Monitora o estado de Login
  useEffect(() => {
    let unsubscribeSnap = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoadingAuth(false);

      if (currentUser) {
        // Define o perfil baseado no e-mail logado
        if (EMAILS_GERENCIA.includes(currentUser.email)) {
          setRole('manager');
        } else {
          setRole('partner');
        }

        // Carrega os dados
        const q = collection(db, collectionPath);
        unsubscribeSnap = onSnapshot(q, (snapshot) => {
          const dadosFirebase = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          dadosFirebase.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
          setItems(dadosFirebase);
        }, (err) => {
          console.error("Erro ao ler dados:", err);
        });
      } else {
        if (unsubscribeSnap) unsubscribeSnap();
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeSnap) unsubscribeSnap();
    };
  }, []);

  // Funções de Login / Logout
  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
    } catch (error) {
      alert("Erro ao entrar. Verifique se o e-mail e a senha estão corretos.");
    }
  };

  const handleLogout = () => {
    signOut(auth);
  };

  // --- FUNÇÕES DE AÇÃO NA BASE DE DADOS ---

  const handlePhotoUpload = (e, callback) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => callback(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const addItem = async (newItem) => {
    try {
      await addDoc(collection(db, collectionPath), { 
        ...newItem, 
        createdAt: new Date().toISOString(),
        authorEmail: user.email // Salva quem criou
      });
      setView('list');
      setPhoto(null);
      setDescription('');
      setDiscipline('');
    } catch (e) {
      console.error("Erro ao adicionar:", e);
      alert("Erro ao guardar item.");
    }
  };

  const togglePartnerFixed = async (item) => {
    if (item.managerApproved) return;
    try {
      await updateDoc(doc(db, collectionPath, item.id), { partnerFixed: !item.partnerFixed });
    } catch (e) {
      console.error("Erro ao atualizar:", e);
    }
  };

  const toggleManagerApproved = async (item) => {
    if (role !== 'manager') return;
    try {
      await updateDoc(doc(db, collectionPath, item.id), { managerApproved: !item.managerApproved });
    } catch (e) {
      console.error("Erro ao atualizar:", e);
    }
  };

  const deleteItem = async (id) => {
    if (role !== 'manager') return;
    if(window.confirm("Tem certeza que deseja apagar este item?")) {
      try {
        await deleteDoc(doc(db, collectionPath, id));
      } catch (e) {
        console.error("Erro ao remover:", e);
      }
    }
  };

  const printPDF = () => {
    window.print();
  };

  // --- TELA DE LOGIN ---
  if (loadingAuth) return <div className="loading-screen">Carregando...</div>;

  if (!user) {
    return (
      <div className="login-container fade-in">
        <div className="login-card">
          <Building2 size={48} className="login-icon" />
          <h1 className="login-title">Vistoria<span>PRO</span></h1>
          <p className="login-subtitle">Gestão de Checklists de Obras</p>
          
          <form className="login-form" onSubmit={handleLogin}>
            <input 
              type="email" 
              placeholder="Seu E-mail" 
              className="login-input"
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
              required
            />
            <input 
              type="password" 
              placeholder="Sua Senha" 
              className="login-input"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              required
            />
            <button type="submit" className="btn-primary">Entrar no Sistema</button>
          </form>
        </div>
      </div>
    );
  }

  // --- RENDERS DAS PÁGINAS ---

  const renderDashboard = () => {
    const total = items.length;
    const completed = items.filter(i => i.managerApproved).length;
    const pending = total - completed;
    const partnerFixed = items.filter(i => i.partnerFixed && !i.managerApproved).length;
    const progress = total === 0 ? 0 : Math.round((completed / total) * 100);

    const discCount = items.reduce((acc, curr) => {
      acc[curr.discipline] = (acc[curr.discipline] || 0) + 1;
      return acc;
    }, {});
    
    const topDisciplines = Object.entries(discCount).sort((a, b) => b[1] - a[1]).slice(0, 4);

    return (
      <div className="page-container fade-in">
        <h2 className="section-title">Resumo Geral</h2>
        
        <div className="stats-grid">
          <div className="stat-card">
            <span className="stat-value">{total}</span>
            <span className="stat-label">Total de Itens</span>
          </div>
          <div className="stat-card">
            <span className="stat-value text-green">{progress}%</span>
            <span className="stat-label">Concluído</span>
          </div>
          <div className="stat-card">
            <span className="stat-value text-orange">{partnerFixed}</span>
            <span className="stat-label">Aguardando Avaliação</span>
          </div>
          <div className="stat-card">
            <span className="stat-value text-red">{pending - partnerFixed}</span>
            <span className="stat-label">Pendentes</span>
          </div>
        </div>

        <div className="chart-card">
          <h3 className="chart-title"><BarChart3 size={20} /> Disciplinas Mais Recorrentes</h3>
          {topDisciplines.length === 0 ? (
            <p className="text-muted">Nenhum dado registado ainda.</p>
          ) : (
            <div className="chart-list">
              {topDisciplines.map(([disc, count], idx) => (
                <div key={idx} className="chart-row">
                  <div className="chart-row-header">
                    <span>{disc}</span>
                    <span className="text-muted">{count} itens ({Math.round((count/total)*100)}%)</span>
                  </div>
                  <div className="progress-bar-bg">
                    <div className="progress-bar-fill" style={{ width: `${(count/total)*100}%` }}></div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderProjects = () => (
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

  const renderStages = () => {
    const stages = STAGES[selectedProject?.id] || [];
    return (
      <div className="page-container fade-in">
        <h2 className="section-title center">Etapas de {selectedProject?.name}</h2>
        {stages.length === 0 ? <p className="text-muted center mt-2">Nenhuma etapa cadastrada.</p> : null}
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
            const locItems = items.filter(i => i.projectId === selectedProject.id && i.stageId === selectedStage.id && i.locationId === loc);
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
    const handleSubmit = () => {
      if (!photo || !description || !discipline) return;
      addItem({
        projectId: selectedProject.id,
        stageId: selectedStage.id,
        locationId: selectedLocation,
        photoUrl: photo,
        description,
        discipline,
        partnerFixed: false,
        managerApproved: false
      });
    };

    return (
      <div className="page-container fade-in">
        <h2 className="section-title">Nova Não Conformidade</h2>
        <p className="breadcrumb">{selectedProject.name} &gt; {selectedLocation}</p>

        <div className="form-group">
          <div className="photo-upload-area">
            {photo ? (
               <img src={photo} alt="Preview" className="photo-preview" />
            ) : (
              <div className="photo-placeholder">
                <Camera size={48} />
                <span>Toque para tirar foto</span>
              </div>
            )}
            <input type="file" accept="image/*" capture="environment" onChange={(e) => handlePhotoUpload(e, setPhoto)} className="photo-input" />
          </div>
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

        <button onClick={handleSubmit} className="btn-primary">Guardar Item</button>
      </div>
    );
  };

  const renderList = () => {
    let filteredItems = items;
    if (selectedLocation) {
      filteredItems = items.filter(i => i.projectId === selectedProject.id && i.stageId === selectedStage.id && i.locationId === selectedLocation);
    } else if (selectedProject) {
      filteredItems = items.filter(i => i.projectId === selectedProject.id);
    }

    if (statusFilter === 'pending') filteredItems = filteredItems.filter(i => !i.managerApproved);
    if (statusFilter === 'completed') filteredItems = filteredItems.filter(i => i.managerApproved);
    if (disciplineFilter !== 'all') filteredItems = filteredItems.filter(i => i.discipline === disciplineFilter);

    return (
      <div className="page-container flex-col fade-in">
        <div className="print-header hide-screen">
          <h1>Relatório de Vistoria</h1>
          <p>Projeto: {selectedProject?.name || 'Todos'}</p>
          {selectedStage && <p>Etapa: {selectedStage.name}</p>}
          {selectedLocation && <p>Local: {selectedLocation}</p>}
          <hr/>
        </div>

        <div className="list-header hide-print">
          <h2 className="section-title mb-0">{selectedLocation ? `Itens - ${selectedLocation}` : 'Todos os Itens'}</h2>
          <button onClick={printPDF} className="btn-secondary"><Printer size={16}/> PDF</button>
        </div>

        <div className="filter-panel hide-print">
          <div className="filter-title"><Filter size={16} /> Filtros</div>
          <div className="filter-inputs">
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">Todos os Status</option>
              <option value="pending">Em Andamento</option>
              <option value="completed">Concluídos</option>
            </select>
            <select value={disciplineFilter} onChange={(e) => setDisciplineFilter(e.target.value)}>
              <option value="all">Todas as Disciplinas</option>
              {DISCIPLINES.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        </div>

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
                    {role === 'manager' && !item.managerApproved && (
                      <button onClick={() => deleteItem(item.id)} className="btn-delete hide-print"><Trash2 size={16} /></button>
                    )}
                  </div>
                  <p className="item-desc">{item.description}</p>
                  {!selectedLocation && <p className="item-loc">{item.locationId}</p>}
                  
                  <div className="item-actions">
                    <button 
                      onClick={() => togglePartnerFixed(item)} disabled={item.managerApproved}
                      className={`check-btn ${item.partnerFixed ? 'checked-partner' : ''}`}
                    >
                      {item.partnerFixed ? <CheckCircle size={18} className="hide-print"/> : <Circle size={18} className="hide-print"/>}
                      <span className="hide-print">Parceiro Corrigiu</span>
                      <span className="hide-screen">Parceiro: {item.partnerFixed ? '[ X ]' : '[   ]'}</span>
                    </button>
                    <button 
                      onClick={() => toggleManagerApproved(item)} disabled={role === 'partner'}
                      className={`check-btn ${item.managerApproved ? 'checked-manager' : ''} ${role === 'partner' ? 'disabled' : ''}`}
                    >
                      {item.managerApproved ? <CheckCircle size={18} className="hide-print"/> : <Circle size={18} className="hide-print"/>}
                      <span className="hide-print">OK Final</span>
                      <span className="hide-screen">Gerente: {item.managerApproved ? '[ X ]' : '[   ]'}</span>
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {selectedLocation && (
           <button onClick={() => setView('form')} className="fab-btn hide-print">
             <Camera size={24} />
           </button>
        )}
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
            <button onClick={handleBack} className="back-btn"><ArrowLeft size={24} /></button>
          )}
          <h1 className="app-title">Vistoria<span>PRO</span></h1>
        </div>
        <div className="header-right">
          <div className="user-info">
            <span className="user-email">{user.email.split('@')[0]}</span>
            <span className={`user-badge ${role === 'manager' ? 'badge-manager' : 'badge-partner'}`}>
              {role === 'manager' ? 'Gerente' : 'Parceiro'}
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
      </main>

      <nav className="bottom-nav hide-print">
        <button onClick={() => { setView('dashboard'); setSelectedProject(null); setSelectedStage(null); setSelectedLocation(null); }} className={view === 'dashboard' ? 'active' : ''}>
          <BarChart3 size={24} /><span>Dashboard</span>
        </button>
        <button onClick={() => { setView('projects'); setSelectedProject(null); setSelectedStage(null); setSelectedLocation(null); }} className={['projects','stages','locations'].includes(view) ? 'active' : ''}>
          <Building2 size={24} /><span>Obras</span>
        </button>
        <button onClick={() => { setView('list'); setSelectedProject(null); setSelectedStage(null); setSelectedLocation(null); }} className={view === 'list' && !selectedLocation ? 'active' : ''}>
          <FileText size={24} /><span>Checklists</span>
        </button>
      </nav>
    </div>
  );
}