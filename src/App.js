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

// --- 2. DEFINIÇÃO DE PERFIS E DADOS ---
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

const CSS = `
* { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
body { background-color: #f8fafc; color: #0f172a; -webkit-font-smoothing: antialiased; }
button { border: none; background: transparent; cursor: pointer; font-family: inherit; }

.app-layout { min-height: 100vh; padding-bottom: 80px; }

/* Autenticação */
.loading-screen { display: flex; align-items: center; justify-content: center; height: 100vh; font-weight: bold; color: #64748b; }
.login-container { display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #f1f5f9; padding: 20px; }
.login-card { background: white; padding: 40px; border-radius: 16px; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); width: 100%; max-width: 400px; text-align: center; }
.login-icon { color: #4f46e5; margin-bottom: 16px; display: inline-block; }
.login-title { font-size: 28px; font-weight: 900; color: #1e3a8a; letter-spacing: -0.5px; }
.login-title span { color: #6366f1; }
.login-subtitle { color: #64748b; font-size: 14px; margin-bottom: 32px; }
.login-form { display: flex; flex-direction: column; gap: 16px; }
.login-input { padding: 14px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 16px; outline: none; background: #f8fafc; }
.login-input:focus { border-color: #4f46e5; background: white; box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.2); }

/* Header Superior */
.app-header { background: white; border-bottom: 1px solid #e2e8f0; padding: 12px 16px; display: flex; justify-content: space-between; align-items: center; position: sticky; top: 0; z-index: 10; }
.header-left { display: flex; align-items: center; gap: 8px; }
.back-btn { padding: 4px; color: #64748b; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; }
.back-btn:hover { background: #f1f5f9; color: #0f172a; }
.app-title { font-size: 20px; font-weight: 900; color: #1e3a8a; letter-spacing: -0.5px; }
.app-title span { color: #6366f1; }
.header-right { display: flex; align-items: center; gap: 12px; }
.user-info { display: flex; flex-direction: column; align-items: flex-end; }
.user-email { font-size: 11px; font-weight: 700; color: #334155; }
.user-badge { font-size: 9px; font-weight: 800; padding: 2px 6px; border-radius: 4px; text-transform: uppercase; margin-top: 2px; }
.badge-manager { background: #dbeafe; color: #1e40af; }
.badge-partner { background: #fef3c7; color: #b45309; }
.btn-logout { color: #ef4444; padding: 4px; border-radius: 6px; transition: 0.2s; cursor: pointer; display: flex; align-items: center; justify-content: center; }
.btn-logout:hover { background: #fee2e2; }

/* Corpo Principal */
.app-main { max-width: 800px; margin: 0 auto; }
.page-container { padding: 20px; display: flex; flex-direction: column; gap: 20px; }
.section-title { font-size: 18px; font-weight: 800; color: #1e293b; }
.mb-0 { margin-bottom: 0; border: none; padding: 0; }
.stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.stat-card { background: white; padding: 20px; border-radius: 12px; border: 1px solid #e2e8f0; display: flex; flex-direction: column; align-items: center; justify-content: center; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
.stat-value { font-size: 32px; font-weight: 900; color: #1e3a8a; }
.stat-label { font-size: 12px; color: #64748b; font-weight: bold; margin-top: 4px; text-transform: uppercase; }
.text-green { color: #10b981; } 

/* Navegação Obras e Etapas */
.list-group { display: flex; flex-direction: column; gap: 12px; }
.list-item-wrapper:hover { border-color: #6366f1 !important; }
.list-item { background: white; padding: 16px; border-radius: 12px; border: 1px solid #e2e8f0; display: flex; align-items: center; gap: 12px; font-weight: 600; color: #1e3a8a; transition: 0.2s; text-align: left; width: 100%; cursor: pointer; }
.list-item:hover { border-color: #6366f1; }
.icon-blue { color: #4f46e5; margin-right: 12px; }

.grid-locations { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; }
.location-card { background: white; padding: 20px 10px; border-radius: 12px; border: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: center; position: relative; font-weight: 600; color: #334155; transition: 0.2s; cursor: pointer; }
.location-card:hover { background: #eef2ff; border-color: #6366f1; }

/* Filtros */
.list-header { display: flex; justify-content: space-between; align-items: center; }
.btn-secondary { display: flex; align-items: center; gap: 4px; background: #eef2ff; color: #4f46e5; padding: 6px 12px; border-radius: 8px; font-weight: 600; font-size: 14px; border: none; cursor: pointer; }
.filter-panel { background: #f1f5f9; padding: 16px; border-radius: 12px; margin-bottom: 8px; }
.filter-title { font-size: 14px; font-weight: 700; color: #475569; display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
.filter-inputs { display: flex; gap: 12px; }
.filter-inputs select { flex: 1; padding: 10px; border-radius: 8px; border: 1px solid #cbd5e1; font-size: 14px; background: white; color: #1e293b; outline: none; }

/* Checklists */
.checklist { display: flex; flex-direction: column; gap: 16px; flex: 1; }
.empty-state { text-align: center; color: #94a3b8; padding: 40px 0; font-weight: 500; }
.checklist-item { display: flex; gap: 16px; background: white; padding: 16px; border-radius: 12px; border: 1px solid #e2e8f0; margin-bottom: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
.checklist-item.approved { border-color: #10b981; background: #f0fdf4; }
.item-thumbnail { width: 80px; height: 80px; border-radius: 8px; background: #f1f5f9; flex-shrink: 0; border: 1px solid #e2e8f0; overflow: hidden; display: flex; align-items: center; justify-content: center; }
.item-thumbnail img { width: 100%; height: 100%; object-fit: cover; }
.item-content { flex: 1; display: flex; flex-direction: column; justify-content: space-between; }
.item-header-row { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px; }
.tag-discipline { font-size: 10px; font-weight: 800; background: #e0e7ff; color: #3730a3; padding: 4px 8px; border-radius: 6px; text-transform: uppercase; display: inline-block; }
.item-actions-top { display: flex; gap: 12px; }
.btn-edit { color: #64748b; padding: 0; background: transparent; border: none; cursor: pointer; } .btn-edit:hover { color: #4f46e5; }
.btn-delete { color: #f87171; padding: 0; background: transparent; border: none; cursor: pointer; } .btn-delete:hover { color: #ef4444; }
.item-desc { font-size: 14px; font-weight: 600; color: #1e293b; line-height: 1.4; margin-bottom: 12px; }
.item-status-row { display: flex; gap: 16px; padding-top: 12px; border-top: 1px solid #f1f5f9; }
.check-btn { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 700; color: #94a3b8; background: transparent; border: none; cursor: pointer; }
.check-btn.checked-partner { color: #f59e0b; }
.check-btn.checked-manager { color: #10b981; }

/* Formulário e Editor Canvas */
.form-group { margin-bottom: 16px; }
.form-label { display: block; font-size: 12px; font-weight: 800; color: #475569; text-transform: uppercase; margin-bottom: 8px; }
.form-input { width: 100%; padding: 14px; border-radius: 8px; border: 1px solid #cbd5e1; font-size: 15px; background: white; outline: none; }
.form-input:focus { border-color: #6366f1; }
.photo-upload-area { width: 100%; height: 200px; background: #f1f5f9; border-radius: 12px; position: relative; overflow: hidden; display: flex; align-items: center; justify-content: center; border: 2px dashed #cbd5e1; margin-bottom: 20px; }
.photo-placeholder { display: flex; flex-direction: column; align-items: center; color: #94a3b8; font-weight: 500; font-size: 14px; gap: 8px; }
.photo-input { position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; }

.btn-primary { width: 100%; background: #4f46e5; color: white; border-radius: 8px; font-weight: bold; padding: 16px; border: none; cursor: pointer; transition: 0.2s; font-size: 16px; box-shadow: 0 4px 6px -1px rgba(79, 70, 229, 0.2); }
.btn-primary:active { transform: scale(0.98); }

/* --- NOVO FAB CENTRALIZADO --- */
.fab-btn { 
  position: fixed; 
  bottom: 90px; 
  left: 50%; 
  transform: translateX(-50%); 
  width: auto; 
  padding: 0 24px; 
  height: 48px; 
  background: #eab308; 
  color: #0f172a; 
  border-radius: 24px; 
  display: flex; 
  align-items: center; 
  justify-content: center; 
  gap: 8px; 
  box-shadow: 0 4px 12px rgba(234, 179, 8, 0.4); 
  z-index: 20; 
  transition: 0.2s; 
  cursor: pointer; 
  font-weight: bold; 
  font-size: 15px;
  white-space: nowrap;
}
.fab-btn:active { transform: translate(-50%, 2px); }

/* Editor de Fotos Native */
.markup-modal { position: fixed; inset: 0; background: #1e293b; z-index: 100; display: flex; flex-direction: column; }
.markup-header { padding: 16px; display: flex; justify-content: space-between; background: #0f172a; }
.canvas-container { flex: 1; display: flex; justify-content: center; align-items: center; overflow: hidden; background: #000; }
.canvas-container canvas { max-width: 100%; max-height: 100%; touch-action: none; object-fit: contain; cursor: crosshair; }
.markup-tools { background: #0f172a; padding: 20px; display: flex; justify-content: space-around; align-items: center; }
.tool-group { display: flex; gap: 12px; background: rgba(255,255,255,0.1); padding: 8px; border-radius: 12px; }
.tool-btn { color: white; padding: 8px; border-radius: 8px; display: flex; }
.tool-btn.active { background: #3b82f6; }
.color-btn { width: 30px; height: 30px; border-radius: 50%; border: 2px solid white; }
.color-btn.active { transform: scale(1.2); box-shadow: 0 0 0 2px #3b82f6; }

/* Menu Inferior */
.bottom-nav { position: fixed; bottom: 0; left: 0; width: 100%; background: white; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-around; padding: 12px 0 20px 0; z-index: 20; box-shadow: 0 -4px 6px -1px rgba(0,0,0,0.05); }
.bottom-nav button { display: flex; flex-direction: column; align-items: center; gap: 4px; color: #94a3b8; width: 100%; transition: 0.2s; }
.bottom-nav button span { font-size: 10px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; }
.bottom-nav button.active { color: #4f46e5; }

/* Utilidades */
.fade-in { animation: fadeIn 0.3s ease-out forwards; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
.hide-screen { display: none; }
.text-muted { color: #64748b; }

@media print { 
  .app-layout { padding-bottom: 0; background: white; }
  .hide-print { display: none !important; } 
  .hide-screen { display: block; }
  .checklist-item { break-inside: avoid; border: none; border-bottom: 1px solid #ccc; padding: 10px 0; box-shadow: none; margin-bottom: 0; }
  .item-desc { -webkit-line-clamp: unset; }
  .check-btn { color: black !important; opacity: 1 !important; }
}
`;

export default function App() {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState('partner');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [view, setView] = useState('dashboard'); 

  const [items, setItems] = useState([]);
  const [projectAccess, setProjectAccess] = useState({});
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
  
  // Novos estados para o formulário
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

  const visibleProjects = role === 'manager' ? INITIAL_PROJECTS : INITIAL_PROJECTS.filter(p => (projectAccess[p.id] || []).includes(user?.email.toLowerCase()));

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
  
  if (loadingAuth) return <div className="loading-screen">Carregando VistoriaPRO...</div>;
  if (!user) return (
    <div className="app-layout">
      <style>{CSS}</style>
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
    </div>
  );

  const renderSettings = () => (
    <div className="page-container fade-in">
      <h2 className="section-title">Configurações de Acesso</h2>
      <p className="text-muted mb-0" style={{fontSize: '14px', color: '#64748b'}}>Selecione uma obra para adicionar os fornecedores autorizados.</p>
      <div className="form-group" style={{marginTop: '16px'}}>
        <select className="form-input" value={configProject?.id || ''} onChange={(e) => setConfigProject(INITIAL_PROJECTS.find(p => p.id === e.target.value))}>
          <option value="">Selecione a Obra...</option>
          {INITIAL_PROJECTS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>
      {configProject && (
        <div className="settings-card" style={{background: 'white', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', marginTop: '8px'}}>
          <h3 style={{fontSize: '16px', fontWeight: 'bold', marginBottom: '16px', color: '#1e293b'}}>Fornecedores: {configProject.name}</h3>
          <div style={{display: 'flex', gap: '8px', marginBottom: '16px'}}>
            <input type="email" placeholder="E-mail do fornecedor" className="form-input" style={{flex: 1, padding: '10px'}} value={newPartnerEmail} onChange={(e) => setNewPartnerEmail(e.target.value)} />
            <button className="btn-primary" style={{width: 'auto', padding: '0 16px'}} onClick={async () => {
              if(!newPartnerEmail) return;
              const email = newPartnerEmail.toLowerCase().trim();
              const currentList = projectAccess[configProject.id] || [];
              if(!currentList.includes(email)) { await setDoc(doc(db, 'project_access', configProject.id), { authorizedEmails: [...currentList, email] }); setNewPartnerEmail(''); }
            }}>Adicionar</button>
          </div>
          <div style={{display: 'flex', flexDirection: 'column', gap: '8px'}}>
            {(projectAccess[configProject.id] || []).length === 0 ? <p style={{color: '#94a3b8', fontSize: '14px'}}>Nenhum fornecedor cadastrado.</p> : 
              (projectAccess[configProject.id] || []).map(email => (
                <div key={email} style={{display: 'flex', justifyContent: 'space-between', padding: '12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0'}}>
                  <span style={{fontSize: '14px', fontWeight: '600'}}>{email}</span>
                  <button onClick={async () => await setDoc(doc(db, 'project_access', configProject.id), { authorizedEmails: projectAccess[configProject.id].filter(e => e !== email) })} style={{color: '#ef4444', background: 'none', border: 'none'}}><X size={18}/></button>
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
    
    // Filtros de Navegação
    if (selectedProject) filteredItems = filteredItems.filter(i => i.projectId === selectedProject.id);
    if (selectedStage) filteredItems = filteredItems.filter(i => i.stageId === selectedStage.id);
    if (selectedLocation) filteredItems = filteredItems.filter(i => i.locationId === selectedLocation);
    
    // Filtros de Status
    if (statusFilter === 'pending') filteredItems = filteredItems.filter(i => !i.managerApproved);
    if (statusFilter === 'completed') filteredItems = filteredItems.filter(i => i.managerApproved);
    if (disciplineFilter !== 'all') filteredItems = filteredItems.filter(i => i.discipline === disciplineFilter);

    // Definir etapas disponíveis baseadas na obra selecionada no filtro
    const availableStages = selectedProject ? [...(STAGES[selectedProject.id] || []), ...customStages.filter(s => s.projectId === selectedProject.id)] : [];

    return (
      <div className="page-container fade-in">
        <div className="hide-print list-header" style={{marginBottom: '8px'}}>
          <h2 className="section-title mb-0">{selectedLocation ? `Itens: ${selectedLocation}` : 'Todos os Itens'}</h2>
          <button onClick={() => window.print()} className="btn-secondary"><Printer size={16}/> PDF</button>
        </div>

        <div className="filter-panel hide-print">
          <div className="filter-title"><Filter size={16} /> Filtros Rápidos</div>
          <div className="filter-inputs" style={{display: 'flex', flexDirection: 'column', gap: '8px'}}>
            
            {/* NOVO: Filtros de Obra e Etapa direto no Checklist */}
            {!selectedLocation && (
              <div style={{display: 'flex', gap: '8px'}}>
                <select style={{flex: 1}} className="form-input" value={selectedProject?.id || 'all'} onChange={e => {
                  const p = INITIAL_PROJECTS.find(x => x.id === e.target.value);
                  setSelectedProject(p || null); setSelectedStage(null); setSelectedLocation(null);
                }}>
                  <option value="all">Todas as Obras</option>
                  {visibleProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>

                <select style={{flex: 1}} className="form-input" value={selectedStage?.id || 'all'} onChange={e => {
                  const s = availableStages.find(x => x.id === e.target.value);
                  setSelectedStage(s || null); setSelectedLocation(null);
                }} disabled={!selectedProject}>
                  <option value="all">Todas as Etapas</option>
                  {availableStages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            )}

            <div style={{display: 'flex', gap: '8px'}}>
              <select style={{flex: 1}} className="form-input" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                <option value="all">Todos os Status</option>
                <option value="pending">Em Andamento</option>
                <option value="completed">Concluídos</option>
              </select>
              <select style={{flex: 1}} className="form-input" value={disciplineFilter} onChange={e => setDisciplineFilter(e.target.value)}>
                <option value="all">Todas as Disciplinas</option>
                {DISCIPLINES.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>

          </div>
        </div>

        <div className="checklist">
          {filteredItems.length === 0 ? <p className="empty-state">Nenhum registro encontrado.</p> : 
            filteredItems.map(item => (
              <div key={item.id} className={`checklist-item ${item.managerApproved ? 'approved' : ''}`}>
                <div className="item-thumbnail"><img src={item.photoUrl} alt="Vistoria" /></div>
                <div className="item-content">
                  <div className="item-header-row">
                    <span className="tag-discipline">{item.discipline}</span>
                    {role === 'manager' && !item.managerApproved && (
                      <div className="item-actions-top hide-print">
                        <button onClick={() => editItem(item)} className="btn-edit"><Pencil size={16}/></button>
                        <button onClick={() => window.confirm("Apagar permanentemente?") && deleteDoc(doc(db, collectionPath, item.id))} className="btn-delete"><Trash2 size={16}/></button>
                      </div>
                    )}
                  </div>
                  <p className="item-desc">{item.description}</p>
                  
                  {!selectedLocation && (
                    <p style={{fontSize: '11px', color: '#64748b', marginTop: '2px', marginBottom: '8px'}}>
                      <strong>Obra:</strong> {INITIAL_PROJECTS.find(p => p.id === item.projectId)?.name || 'N/A'}<br/>
                      <strong>Local:</strong> {item.locationId}
                    </p>
                  )}

                  <div className="item-status-row hide-print">
                    <button onClick={() => !item.managerApproved && updateDoc(doc(db, collectionPath, item.id), { partnerFixed: !item.partnerFixed })} disabled={item.managerApproved} className={`check-btn ${item.partnerFixed ? 'checked-partner' : ''}`}>
                      {item.partnerFixed ? <CheckCircle size={16}/> : <Circle size={16}/>} Parceiro
                    </button>
                    <button onClick={() => role === 'manager' && updateDoc(doc(db, collectionPath, item.id), { managerApproved: !item.managerApproved })} disabled={role !== 'manager'} className={`check-btn ${item.managerApproved ? 'checked-manager' : ''}`}>
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
    <div className="app-layout">
      <style>{CSS}</style>
      
      {isMarking && (
        <div className="markup-modal">
          <div className="markup-header">
            <button onClick={() => setIsMarking(false)} className="btn-secondary" style={{background:'transparent', color:'white'}}><ArrowLeft size={18}/> Voltar</button>
            <button onClick={saveMarkedPhoto} className="btn-primary" style={{width: 'auto', padding: '8px 16px', margin:0}}>Salvar Marcação</button>
          </div>
          <div className="canvas-container">
            <canvas ref={canvasRef} onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={stopDrawing} onMouseOut={stopDrawing} onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={stopDrawing} />
          </div>
          <div className="markup-tools">
            <div className="tool-group">
              <button className={`tool-btn ${drawMode === 'pencil' ? 'active' : ''}`} onClick={() => setDrawMode('pencil')}><Pencil size={20}/></button>
              <button className={`tool-btn ${drawMode === 'arrow' ? 'active' : ''}`} onClick={() => setDrawMode('arrow')}><MousePointer2 size={20}/></button>
              <button className={`tool-btn ${drawMode === 'circle' ? 'active' : ''}`} onClick={() => setDrawMode('circle')}><Circle size={20}/></button>
            </div>
            <div className="tool-group">
              {COLORS.map(c => <button key={c} className={`color-btn ${color === c ? 'active' : ''}`} style={{backgroundColor: c}} onClick={() => setColor(c)} />)}
            </div>
            <button onClick={() => {
              if (drawingHistory.length > 1) {
                const newHist = drawingHistory.slice(0, -1); setDrawingHistory(newHist);
                const img = new Image(); img.onload = () => { canvasRef.current.getContext('2d').clearRect(0,0,canvasRef.current.width,canvasRef.current.height); canvasRef.current.getContext('2d').drawImage(img,0,0); }; img.src = newHist[newHist.length-1];
              }
            }} disabled={drawingHistory.length <= 1} className="tool-btn"><Undo size={20}/></button>
          </div>
        </div>
      )}

      <header className="app-header hide-print">
        <div className="header-left">
          {view !== 'dashboard' && view !== 'projects' && !isMarking && <button onClick={handleBack} className="back-btn"><ArrowLeft size={20}/></button>}
          <h1 className="app-title">Vistoria<span>PRO</span></h1>
        </div>
        <div className="header-right">
          <div className="user-info">
            <span className="user-email">{user.email.split('@')[0]}</span>
            <span className={`user-badge ${role === 'manager' ? 'badge-manager' : 'badge-partner'}`}>{role === 'manager' ? 'Gerente' : 'Parceiro'}</span>
          </div>
          <button onClick={() => signOut(auth)} className="btn-logout" title="Sair"><LogOut size={20}/></button>
        </div>
      </header>

      <main className="app-main">
        {view === 'dashboard' && (
          <div className="page-container fade-in">
            <h2 className="section-title">Painel de Resumo</h2>
            <div className="stats-grid">
              <div className="stat-card"><span className="stat-value">{items.length}</span><span className="stat-label">Total Itens</span></div>
              <div className="stat-card"><span className="stat-value text-green">{items.filter(i => i.managerApproved).length}</span><span className="stat-label">Concluídos</span></div>
            </div>
          </div>
        )}
        
        {view === 'projects' && (
          <div className="page-container fade-in">
            <h2 className="section-title">Selecione a Obra</h2>
            <div className="list-group">
              {visibleProjects.map(p => (
                <button key={p.id} className="list-item" onClick={() => { setSelectedProject(p); setView('stages'); }}>
                  <span className="icon-blue"><Building2 size={24} /></span> {p.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {view === 'stages' && (
          <div className="page-container fade-in">
            <h2 className="section-title">{selectedProject.name} - Etapas</h2>
            <div className="list-group">
              {[...(STAGES[selectedProject?.id] || []), ...customStages.filter(s => s.projectId === selectedProject?.id)].map(s => {
                const isCustom = customStages.some(cs => cs.id === s.id);
                return (
                  <div key={s.id} className="list-item-wrapper" style={{display: 'flex', background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden'}}>
                    <button className="list-item" style={{border: 'none', borderRadius: 0, flex: 1}} onClick={() => { setSelectedStage(s); setView('locations'); }}>{s.name}</button>
                    {isCustom && role === 'manager' && (
                      <button onClick={() => { if(window.confirm(`Excluir permanentemente a etapa "${s.name}"?`)) deleteDoc(doc(db, 'custom_stages', s.id)); }} style={{padding: '0 20px', background: '#fee2e2', color: '#ef4444', borderLeft: '1px solid #e2e8f0'}}><Trash2 size={20}/></button>
                    )}
                  </div>
                );
              })}
              {role === 'manager' && (
                <button className="list-item" onClick={async () => {
                  const name = window.prompt("Nome da nova etapa (Ex: Pavimento 1):");
                  if (name && name.trim()) await addDoc(collection(db, 'custom_stages'), { projectId: selectedProject.id, name: name.trim() });
                }} style={{ borderStyle: 'dashed', justifyContent: 'center', background: 'transparent' }}>
                  <span style={{ color: '#64748b', fontWeight: 'bold' }}>+ Adicionar Nova Etapa</span>
                </button>
              )}
            </div>
          </div>
        )}

        {view === 'locations' && (
          <div className="page-container fade-in">
            <h2 className="section-title">{selectedStage.name} - Locais</h2>
            <div className="grid-locations">
              {Array.from(new Set([...(selectedStage?.locations || []), ...customLocations.filter(l => l.stageId === selectedStage?.id).map(l => l.name)])).map(l => (
                <button key={l} className="location-card" onClick={() => { setSelectedLocation(l); setView('list'); }}>{l}</button>
              ))}
              {role === 'manager' && (
                <button className="location-card" onClick={async () => {
                  const name = window.prompt("Nome do novo local (Ex: Quarto 101):");
                  if (name && name.trim()) await addDoc(collection(db, 'custom_locations'), { projectId: selectedProject.id, stageId: selectedStage.id, name: name.trim() });
                }} style={{ borderStyle: 'dashed', background: 'transparent' }}>
                  <span style={{ color: '#64748b', fontWeight: 'bold' }}>+ Novo Local</span>
                </button>
              )}
            </div>
          </div>
        )}

        {view === 'list' && renderList()}
        {view === 'settings' && renderSettings()}
        
        {/* NOVO FORMULÁRIO (RENDERIZAÇÃO CONDICIONAL DOS SELECTS) */}
        {view === 'form' && !isMarking && (() => {
          const availableFormStages = formProject ? [...(STAGES[formProject] || []), ...customStages.filter(s => s.projectId === formProject)] : [];
          const selectedFormStageObj = availableFormStages.find(s => s.id === formStage);
          const availableFormLocations = Array.from(new Set([...(selectedFormStageObj?.locations || []), ...customLocations.filter(l => l.stageId === formStage).map(l => l.name)]));

          return (
            <div className="page-container fade-in">
              <h2 className="section-title">{editingId ? 'Editar Registro' : 'Novo Registro'}</h2>
              <div style={{background: 'white', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0'}}>
                
                <div className="form-group" style={{display: 'flex', gap: '8px'}}>
                  <div style={{flex: 1}}>
                    <label className="form-label">Obra</label>
                    <select className="form-input" value={formProject} onChange={e => { setFormProject(e.target.value); setFormStage(''); setFormLocation(''); }}>
                      <option value="">Selecione...</option>
                      {INITIAL_PROJECTS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                  <div style={{flex: 1}}>
                    <label className="form-label">Etapa</label>
                    <select className="form-input" value={formStage} onChange={e => { setFormStage(e.target.value); setFormLocation(''); }} disabled={!formProject}>
                      <option value="">Selecione...</option>
                      {availableFormStages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Local / Apartamento</label>
                  <select className="form-input" value={formLocation} onChange={e => setFormLocation(e.target.value)} disabled={!formStage}>
                    <option value="">Selecione o Local...</option>
                    {availableFormLocations.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>

                <div className="form-group" style={{marginTop: '16px'}}>
                  {photo ? (
                    <div className="photo-preview-wrapper" style={{position:'relative', width:'100%', height:'200px', background:'#000', borderRadius:'12px', overflow:'hidden', marginBottom:'8px'}}>
                      <img src={photo} alt="Preview" style={{width:'100%', height:'100%', objectFit:'contain'}} />
                      <button onClick={() => setIsMarking(true)} style={{position:'absolute', bottom:'12px', left:'50%', transform:'translateX(-50%)', background:'#3b82f6', color:'white', padding:'8px 16px', borderRadius:'99px', fontWeight:'bold', display:'flex', gap:'6px', alignItems:'center'}}><PaintBucket size={16}/> Marcar Foto</button>
                      <button onClick={() => setPhoto(null)} style={{position:'absolute', top:'12px', right:'12px', background:'rgba(0,0,0,0.6)', color:'white', padding:'8px', borderRadius:'50%'}}><X size={16}/></button>
                    </div>
                  ) : (
                    <div className="photo-upload-area">
                      <div className="photo-placeholder"><Camera size={48}/><span>Tirar Foto ou Galeria</span></div>
                      <input type="file" accept="image/*" capture="environment" onChange={handlePhotoUpload} className="photo-input" />
                    </div>
                  )}
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
          );
        })()}
      </main>

      {/* FIX: Botão FAB movido para fora do bloco .page-container animado */}
      {view === 'list' && !isMarking && (
         <button className="fab-btn hide-print" onClick={handleNewItem}>
           <Camera size={20}/> Nova Vistoria
         </button>
      )}

      {!isMarking && (
        <nav className="bottom-nav hide-print">
          <button onClick={() => { setView('dashboard'); setSelectedProject(null); setSelectedStage(null); setSelectedLocation(null); }} className={view === 'dashboard' ? 'active' : ''}>
            <BarChart3 size={24}/><span>Status</span>
          </button>
          <button onClick={() => { setView('projects'); setSelectedProject(null); setSelectedStage(null); setSelectedLocation(null); }} className={['projects', 'stages', 'locations'].includes(view) ? 'active' : ''}>
            <Building2 size={24}/><span>Obras</span>
          </button>
          <button onClick={() => { setView('list'); setSelectedProject(null); setSelectedStage(null); setSelectedLocation(null); }} className={['list', 'form'].includes(view) ? 'active' : ''}>
            <FileText size={24}/><span>Checklists</span>
          </button>
          {role === 'manager' && (
            <button onClick={() => { setView('settings'); setSelectedProject(null); setSelectedStage(null); setSelectedLocation(null); }} className={view === 'settings' ? 'active' : ''}>
              <Settings size={24}/><span>Config</span>
            </button>
          )}
        </nav>
      )}
    </div>
  );
}