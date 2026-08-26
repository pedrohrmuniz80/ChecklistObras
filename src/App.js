import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import {
  getFirestore, collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, setDoc,
  getDoc, getDocs, query, where, writeBatch
} from 'firebase/firestore';
import {
  getStorage, ref as storageRef, uploadString, getDownloadURL, deleteObject
} from 'firebase/storage';
import {
  Camera, CheckCircle, Circle, Trash2, FileText, ArrowLeft, BarChart3,
  Filter, Printer, Building2, LogOut, Pencil, Settings, X, Undo, MousePointer2, PaintBucket
} from 'lucide-react';
import './App.css';

/* ------------------------------------------------------------------ *
 * Configuração
 * ------------------------------------------------------------------ */
// As chaves web do Firebase não são segredo (ficam no bundle de qualquer forma),
// mas mantê-las em variáveis de ambiente facilita trocar de projeto/ambiente.
// Crie um arquivo .env.local com REACT_APP_FB_* para sobrescrever os valores abaixo.
const firebaseConfig = {
  apiKey:            process.env.REACT_APP_FB_API_KEY     || "AIzaSyCpHs7rK8IaU6bLOu9U5atqLe_Zk-PNkkE",
  authDomain:        process.env.REACT_APP_FB_AUTH_DOMAIN || "check-list-obras.firebaseapp.com",
  projectId:         process.env.REACT_APP_FB_PROJECT_ID  || "check-list-obras",
  storageBucket:     process.env.REACT_APP_FB_BUCKET      || "check-list-obras.firebasestorage.app",
  messagingSenderId: process.env.REACT_APP_FB_SENDER_ID   || "154186862082",
  appId:             process.env.REACT_APP_FB_APP_ID      || "1:154186862082:web:8b12debd3789521894611b"
};

// CHAVE PRINCIPAL --------------------------------------------------
// false = as fotos ficam em base64 dentro do Firestore, como sempre foi.
//         É o modo em uso: o Firebase Storage exigiria o plano Blaze.
// true  = as fotos passam a ir para o Firebase Storage (só funciona
//         se um dia o plano Blaze for habilitado no projeto).
// Todo o resto do app — segurança, escopo das consultas, editor de
// foto, PDF, exclusão em cascata — funciona igual nos dois modos.
const USE_STORAGE = false;
// -------------------------------------------------------------------

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = USE_STORAGE ? getStorage(app) : null;
const collectionPath = 'checklists';

// Fallback de emergência. A fonte de verdade do perfil é a coleção `roles`
// no Firestore (documento com ID = e-mail, campo role: 'manager'), que é
// a mesma consultada pelas Security Rules.
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

const PHOTO_MAX = USE_STORAGE ? 1600 : 600;   // px
const PHOTO_QUALITY = USE_STORAGE ? 0.85 : 0.6;
const THUMB_MAX = 240;
const THUMB_QUALITY = 0.65;
const IN_QUERY_LIMIT = 30;  // limite do operador "in" do Firestore
const PAGE_SIZE = 20;       // itens renderizados por vez (protege a memória do celular)
const MAX_HISTORY = 10;     // passos de "desfazer" guardados no editor de foto
const PRINT_WARN_AT = 60;   // acima disso, avisa antes de montar o PDF

/* ------------------------------------------------------------------ *
 * Helpers de imagem
 * ------------------------------------------------------------------ */
const resizeToDataUrl = (src, maxSize, quality) => new Promise((resolve, reject) => {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    let { width, height } = img;
    if (width >= height) {
      if (width > maxSize) { height = Math.round(height * maxSize / width); width = maxSize; }
    } else {
      if (height > maxSize) { width = Math.round(width * maxSize / height); height = maxSize; }
    }
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    canvas.getContext('2d').drawImage(img, 0, 0, width, height);
    resolve(canvas.toDataURL('image/jpeg', quality));
  };
  img.onerror = reject;
  img.src = src;
});

const fitInside = (w, h, maxSize) => {
  if (w >= h) {
    return w > maxSize ? { width: maxSize, height: Math.round(h * maxSize / w) } : { width: w, height: h };
  }
  return h > maxSize ? { width: Math.round(w * maxSize / h), height: maxSize } : { width: w, height: h };
};

/* Lê a foto da câmera gastando o mínimo de memória possível.
 * O caminho antigo (new Image() + object URL) deixava a imagem de 12 MP
 * decodificada na memória até o coletor de lixo passar — em celular com
 * pouca RAM isso derrubava a aba. createImageBitmap permite liberar o
 * bitmap na hora, com close(), e ainda corrige a rotação pelo EXIF. */
const fileToDataUrl = async (file, maxSize, quality) => {
  if (typeof createImageBitmap === 'function') {
    let bitmap = null;
    let canvas = null;
    try {
      bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      const { width, height } = fitInside(bitmap.width, bitmap.height, maxSize);
      canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d').drawImage(bitmap, 0, 0, width, height);
      bitmap.close();
      bitmap = null;
      const out = canvas.toDataURL('image/jpeg', quality);
      canvas.width = 0; canvas.height = 0;   // devolve o buffer do canvas na hora
      return out;
    } catch (err) {
      if (bitmap) { try { bitmap.close(); } catch (e) { /* ignora */ } }
      if (canvas) { canvas.width = 0; canvas.height = 0; }
      // segue para o caminho antigo
    }
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    return await resizeToDataUrl(objectUrl, maxSize, quality);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
};

const isDataUrl = (value) => typeof value === 'string' && value.startsWith('data:');

/* ------------------------------------------------------------------ *
 * Componente
 * ------------------------------------------------------------------ */
export default function App() {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState('partner');
  const [roleSource, setRoleSource] = useState('db');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [view, setView] = useState('dashboard');

  const [items, setItems] = useState([]);
  const [loadingItems, setLoadingItems] = useState(false);
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
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const [editingItem, setEditingItem] = useState(null);
  const [photo, setPhoto] = useState(null);          // dataURL (novo) ou URL https (existente)
  const [photoDirty, setPhotoDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [description, setDescription] = useState('');
  const [discipline, setDiscipline] = useState('');
  const [lightbox, setLightbox] = useState(null);

  const [formProject, setFormProject] = useState('');
  const [formStage, setFormStage] = useState('');
  const [formLocation, setFormLocation] = useState('');

  const [isMarking, setIsMarking] = useState(false);
  const canvasRef = useRef(null);
  const snapshotRef = useRef(null);
  const isDrawingRef = useRef(false);
  const startPosRef = useRef({ x: 0, y: 0 });
  const [drawMode, setDrawMode] = useState('pencil');
  const [color, setColor] = useState(COLORS[0]);
  const [drawingHistory, setDrawingHistory] = useState([]);

  const userEmail = (user?.email || '').toLowerCase();

  /* ---------------- Auth + listeners de cadastro ---------------- */
  useEffect(() => {
    let unsubs = [];
    const unsubscribeAuth = onAuthStateChanged(auth, async (loggedUser) => {
      unsubs.forEach(u => u());
      unsubs = [];

      setUser(loggedUser);
      setLoadingAuth(false);

      if (!loggedUser) {
        setRole('partner');
        setItems([]);
        setProjectAccess({});
        setCustomProjects([]); setCustomStages([]); setCustomLocations([]);
        return;
      }

      const email = loggedUser.email.toLowerCase();

      // Perfil: coleção `roles` (mesma fonte usada pelas Security Rules),
      // com fallback para a lista local caso o documento ainda não exista.
      let resolvedRole = EMAILS_GERENCIA.includes(email) ? 'manager' : 'partner';
      let source = 'db';
      try {
        const roleSnap = await getDoc(doc(db, 'roles', email));
        if (roleSnap.exists()) {
          resolvedRole = roleSnap.data().role === 'manager' ? 'manager' : 'partner';
        } else if (resolvedRole === 'manager') {
          // O app acha que é gerente, mas o banco não confirma — e são as
          // regras do banco que mandam. Sinaliza em vez de mentir na tela.
          source = 'fallback';
        }
      } catch (e) {
        console.warn('Não foi possível ler o perfil em /roles.', e);
        source = 'error';
      }
      setRole(resolvedRole);
      setRoleSource(source);

      unsubs.push(onSnapshot(collection(db, 'project_access'), (snap) => {
        const accessMap = {};
        snap.docs.forEach(d => { accessMap[d.id] = d.data().authorizedEmails || []; });
        setProjectAccess(accessMap);
      }));
      unsubs.push(onSnapshot(collection(db, 'custom_projects'), (snap) => {
        setCustomProjects(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }));
      unsubs.push(onSnapshot(collection(db, 'custom_stages'), (snap) => {
        setCustomStages(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }));
      unsubs.push(onSnapshot(collection(db, 'custom_locations'), (snap) => {
        setCustomLocations(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }));
    });

    return () => { unsubscribeAuth(); unsubs.forEach(u => u()); };
  }, []);

  const ALL_PROJECTS = useMemo(
    () => [...INITIAL_PROJECTS, ...customProjects],
    [customProjects]
  );

  const visibleProjects = useMemo(() => (
    role === 'manager'
      ? ALL_PROJECTS
      : ALL_PROJECTS.filter(p => (projectAccess[p.id] || []).includes(userEmail))
  ), [ALL_PROJECTS, projectAccess, role, userEmail]);

  // chave estável para usar como dependência do efeito de query
  const visibleIdsKey = useMemo(
    () => visibleProjects.map(p => p.id).sort().join('|'),
    [visibleProjects]
  );

  const selectedProjectId = selectedProject?.id || null;

  /* ---------------- Listener de itens COM ESCOPO ----------------
   * Antes: onSnapshot na coleção inteira -> todo usuário baixava todos os
   * itens de todas as obras (vazamento + payload gigante).
   * Agora: a query é limitada à obra selecionada ou às obras visíveis ao perfil.
   * -------------------------------------------------------------- */
  useEffect(() => {
    if (!user) { setItems([]); return; }

    const visibleIds = visibleIdsKey ? visibleIdsKey.split('|') : [];
    let q;

    if (selectedProjectId) {
      if (role !== 'manager' && !visibleIds.includes(selectedProjectId)) {
        setItems([]);
        return;
      }
      q = query(collection(db, collectionPath), where('projectId', '==', selectedProjectId));
    } else if (role === 'manager') {
      q = collection(db, collectionPath);
    } else {
      if (visibleIds.length === 0) { setItems([]); return; }
      q = query(collection(db, collectionPath), where('projectId', 'in', visibleIds.slice(0, IN_QUERY_LIMIT)));
    }

    setLoadingItems(true);
    const unsub = onSnapshot(q, (snap) => {
      setItems(
        snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      );
      setLoadingItems(false);
    }, (err) => {
      console.error('Erro ao carregar vistorias:', err);
      setLoadingItems(false);
    });

    return () => unsub();
  }, [user, role, selectedProjectId, visibleIdsKey]);

  // Sempre que o recorte muda, volta a exibir só a primeira página.
  const selectedStageId = selectedStage?.id || null;
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [selectedProjectId, selectedStageId, selectedLocation, statusFilter, disciplineFilter]);

  /* ---------------- Foto: upload para o Storage ---------------- */
  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const dataUrl = await fileToDataUrl(file, PHOTO_MAX, PHOTO_QUALITY);
      setPhoto(dataUrl);
      setPhotoDirty(true);
    } catch (err) {
      alert('Não foi possível ler a imagem selecionada. Tente tirar a foto novamente.');
    } finally {
      e.target.value = '';
    }
  };

  const uploadPhoto = async (dataUrl, projectId) => {
    const stamp = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const base = `vistorias/${projectId}/${stamp}`;
    const thumbData = await resizeToDataUrl(dataUrl, THUMB_MAX, THUMB_QUALITY);
    const photoRef = storageRef(storage, `${base}.jpg`);
    const thumbRef = storageRef(storage, `${base}_thumb.jpg`);
    await uploadString(photoRef, dataUrl, 'data_url');
    await uploadString(thumbRef, thumbData, 'data_url');
    return {
      photoUrl: await getDownloadURL(photoRef),
      thumbUrl: await getDownloadURL(thumbRef),
      photoPath: `${base}.jpg`,
      thumbPath: `${base}_thumb.jpg`
    };
  };

  const removeStoredPhotos = useCallback(async (data) => {
    for (const path of [data?.photoPath, data?.thumbPath]) {
      if (!path) continue;
      try { await deleteObject(storageRef(storage, path)); }
      catch (e) { /* arquivo já removido ou inexistente: segue */ }
    }
  }, []);

  /* ---------------- Editor de marcação (canvas) ---------------- */
  useEffect(() => {
    if (!isMarking || !canvasRef.current || !photo) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      setDrawingHistory([canvas.toDataURL('image/jpeg', 0.92)]);
    };
    img.onerror = () => alert('Não foi possível abrir a foto para marcação.');
    img.src = photo;
  }, [isMarking, photo]);

  // CORREÇÃO: antes, `e.clientX || e.touches[0].clientX - rect.left` fazia com que
  // no desktop o `- rect.left` nunca fosse aplicado (precedência de operadores),
  // deslocando todo o traço. Agora o cálculo é único para mouse e toque.
  const getPos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const point = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]) || e;
    return {
      x: (point.clientX - rect.left) * scaleX,
      y: (point.clientY - rect.top) * scaleY
    };
  };

  const strokeWidth = () => {
    const canvas = canvasRef.current;
    return Math.max(3, Math.round((canvas ? canvas.width : 600) / 200));
  };

  const startDrawing = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { x, y } = getPos(e);
    startPosRef.current = { x, y };
    isDrawingRef.current = true;

    // Snapshot SÍNCRONO do estado atual (antes era um Image() assíncrono,
    // o que fazia a última forma se perder no histórico do undo).
    const snap = document.createElement('canvas');
    snap.width = canvas.width;
    snap.height = canvas.height;
    snap.getContext('2d').drawImage(canvas, 0, 0);
    snapshotRef.current = snap;

    if (drawMode === 'pencil') {
      const ctx = canvas.getContext('2d');
      ctx.beginPath();
      ctx.moveTo(x, y);
    }
  };

  const draw = (e) => {
    if (!isDrawingRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const { x, y } = getPos(e);
    const start = startPosRef.current;

    ctx.lineWidth = strokeWidth();
    ctx.strokeStyle = color;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (drawMode === 'pencil') {
      ctx.lineTo(x, y);
      ctx.stroke();
      return;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(snapshotRef.current, 0, 0);
    ctx.beginPath();

    if (drawMode === 'circle') {
      const radius = Math.hypot(x - start.x, y - start.y);
      ctx.arc(start.x, start.y, radius, 0, 2 * Math.PI);
      ctx.stroke();
    } else if (drawMode === 'arrow') {
      const headlen = Math.max(15, ctx.lineWidth * 4);
      const angle = Math.atan2(y - start.y, x - start.x);
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(x, y);
      ctx.lineTo(x - headlen * Math.cos(angle - Math.PI / 6), y - headlen * Math.sin(angle - Math.PI / 6));
      ctx.moveTo(x, y);
      ctx.lineTo(x - headlen * Math.cos(angle + Math.PI / 6), y - headlen * Math.sin(angle + Math.PI / 6));
      ctx.stroke();
    }
  };

  const stopDrawing = () => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    const snapshot = canvasRef.current.toDataURL('image/jpeg', 0.92);
    // Guarda no máximo MAX_HISTORY passos: cada um é uma cópia inteira da
    // imagem, e um histórico sem limite consumia memória a cada traço.
    setDrawingHistory(prev => {
      const next = [...prev, snapshot];
      return next.length > MAX_HISTORY ? next.slice(next.length - MAX_HISTORY) : next;
    });
  };

  const undoDrawing = () => {
    if (drawingHistory.length <= 1) return;
    const newHist = drawingHistory.slice(0, -1);
    setDrawingHistory(newHist);
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
    };
    img.src = newHist[newHist.length - 1];
  };

  const saveMarkedPhoto = () => {
    setPhoto(canvasRef.current.toDataURL('image/jpeg', PHOTO_QUALITY));
    setPhotoDirty(true);
    setIsMarking(false);
  };

  /* ---------------- CRUD de itens ---------------- */
  const resetForm = () => {
    setEditingItem(null); setPhoto(null); setPhotoDirty(false);
    setDescription(''); setDiscipline('');
    setFormProject(''); setFormStage(''); setFormLocation('');
  };

  const handleNewItem = () => {
    resetForm();
    setFormProject(selectedProject?.id || '');
    setFormStage(selectedStage?.id || '');
    setFormLocation(selectedLocation || '');
    setView('form');
  };

  const editItem = (item) => {
    setEditingItem(item);
    setPhoto(item.photoUrl);
    setPhotoDirty(false);
    setDescription(item.description);
    setDiscipline(item.discipline);
    setFormProject(item.projectId !== 'NO_PROJECT' ? item.projectId : '');
    setFormStage(item.stageId !== 'NO_STAGE' ? item.stageId : '');
    setFormLocation(item.locationId !== 'Geral' ? item.locationId : '');
    setView('form');
  };

  const saveItem = async () => {
    if (!photo || !description || !discipline || !formProject || !formStage || !formLocation) {
      return alert('Preencha todos os campos e selecione a obra/etapa/local.');
    }
    setSaving(true);
    try {
      let photoFields = null;
      if (photoDirty || isDataUrl(photo)) {
        photoFields = USE_STORAGE
          ? await uploadPhoto(photo, formProject)
          : {
              // Plano B: a foto continua no documento, mas junto vai uma
              // miniatura pequena. A lista passa a exibir só a miniatura —
              // é o que impede o celular de decodificar dezenas de imagens
              // grandes ao mesmo tempo.
              photoUrl: photo,
              thumbUrl: await resizeToDataUrl(photo, THUMB_MAX, THUMB_QUALITY)
            };
      }

      if (editingItem) {
        const payload = {
          description, discipline,
          projectId: formProject, stageId: formStage, locationId: formLocation,
          updatedAt: new Date().toISOString(),
          updatedBy: userEmail
        };
        if (photoFields) Object.assign(payload, photoFields);
        await updateDoc(doc(db, collectionPath, editingItem.id), payload);
        if (photoFields) await removeStoredPhotos(editingItem);
      } else {
        await addDoc(collection(db, collectionPath), {
          projectId: formProject, stageId: formStage, locationId: formLocation,
          description, discipline,
          ...photoFields,
          createdAt: new Date().toISOString(),
          authorEmail: userEmail,
          managerApproved: false,
          partnerFixed: false
        });
      }
      resetForm();
      setView('list');
    } catch (e) {
      alert('Erro ao guardar item: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteItem = async (item) => {
    if (!window.confirm('Apagar permanentemente?')) return;
    try {
      await deleteDoc(doc(db, collectionPath, item.id));
      await removeStoredPhotos(item);
    } catch (e) {
      alert('Erro ao apagar: ' + e.message);
    }
  };

  const togglePartnerFixed = (item) => {
    if (item.managerApproved) return;
    const next = !item.partnerFixed;
    updateDoc(doc(db, collectionPath, item.id), {
      partnerFixed: next,
      partnerFixedAt: next ? new Date().toISOString() : null,
      partnerFixedBy: next ? userEmail : null
    }).catch(e => alert('Erro ao atualizar: ' + e.message));
  };

  const toggleManagerApproved = (item) => {
    if (role !== 'manager') return;
    const next = !item.managerApproved;
    updateDoc(doc(db, collectionPath, item.id), {
      managerApproved: next,
      managerApprovedAt: next ? new Date().toISOString() : null,
      managerApprovedBy: next ? userEmail : null
    }).catch(e => alert('Erro ao atualizar: ' + e.message));
  };

  /* ---------------- Exclusão em cascata ---------------- */
  const deleteDocsInChunks = async (refs) => {
    for (let i = 0; i < refs.length; i += 400) {
      const batch = writeBatch(db);
      refs.slice(i, i + 400).forEach(r => batch.delete(r));
      await batch.commit();
    }
  };

  const deleteProjectCascade = async (project) => {
    if (!window.confirm(
      `Excluir a obra "${project.name}"?\n\nIsto apaga também todas as etapas, locais e vistorias dela. Esta ação não pode ser desfeita.`
    )) return;
    try {
      const [itemsSnap, stagesSnap, locsSnap] = await Promise.all([
        getDocs(query(collection(db, collectionPath), where('projectId', '==', project.id))),
        getDocs(query(collection(db, 'custom_stages'), where('projectId', '==', project.id))),
        getDocs(query(collection(db, 'custom_locations'), where('projectId', '==', project.id)))
      ]);
      const refs = [
        ...itemsSnap.docs.map(d => d.ref),
        ...stagesSnap.docs.map(d => d.ref),
        ...locsSnap.docs.map(d => d.ref),
        doc(db, 'custom_projects', project.id),
        doc(db, 'project_access', project.id)
      ];
      await deleteDocsInChunks(refs);
      for (const d of itemsSnap.docs) await removeStoredPhotos(d.data());
      if (selectedProjectId === project.id) { setSelectedProject(null); setSelectedStage(null); setSelectedLocation(null); }
    } catch (e) {
      alert('Erro ao excluir a obra: ' + e.message);
    }
  };

  const deleteStageCascade = async (stage) => {
    if (!window.confirm(
      `Excluir a etapa "${stage.name}"?\n\nIsto apaga também os locais e as vistorias dela.`
    )) return;
    try {
      const [itemsSnap, locsSnap] = await Promise.all([
        getDocs(query(collection(db, collectionPath), where('stageId', '==', stage.id))),
        getDocs(query(collection(db, 'custom_locations'), where('stageId', '==', stage.id)))
      ]);
      const refs = [
        ...itemsSnap.docs.map(d => d.ref),
        ...locsSnap.docs.map(d => d.ref),
        doc(db, 'custom_stages', stage.id)
      ];
      await deleteDocsInChunks(refs);
      for (const d of itemsSnap.docs) await removeStoredPhotos(d.data());
      if (selectedStage?.id === stage.id) { setSelectedStage(null); setSelectedLocation(null); }
    } catch (e) {
      alert('Erro ao excluir a etapa: ' + e.message);
    }
  };

  /* ---------------- Login ---------------- */
  const handleLogin = async (e) => {
    e.preventDefault();
    try { await signInWithEmailAndPassword(auth, loginEmail.trim(), loginPassword); }
    catch (err) { alert('Credenciais inválidas.'); }
  };

  if (loadingAuth) return <div className="loading-screen">Carregando VistoriaPRO...</div>;

  if (!user) return (
    <div className="login-container">
      <div className="login-card fade-in">
        <div className="login-icon"><Building2 size={48} /></div>
        <h1 className="login-title">Vistoria<span>PRO</span></h1>
        <p className="login-subtitle">Gestão de Checklists Deville</p>
        <form className="login-form" onSubmit={handleLogin}>
          <input type="email" placeholder="E-mail" className="login-input" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} required />
          <input type="password" placeholder="Senha" className="login-input" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} required />
          <button type="submit" className="btn-primary" style={{ marginTop: '10px' }}>Entrar no Sistema</button>
        </form>
      </div>
    </div>
  );

  /* ---------------- Telas ---------------- */
  const renderSettings = () => (
    <div className="page-container fade-in">
      <h2 className="section-title">Configurações de Acesso</h2>
      <p className="text-muted mb-0" style={{ fontSize: '14px' }}>Selecione uma obra para adicionar os fornecedores autorizados.</p>
      <div className="form-group" style={{ marginTop: '16px' }}>
        <select className="form-input" value={configProject?.id || ''} onChange={(e) => setConfigProject(ALL_PROJECTS.find(p => p.id === e.target.value) || null)}>
          <option value="">Selecione a Obra...</option>
          {ALL_PROJECTS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>
      {configProject && (
        <div className="settings-card">
          <h3 className="settings-card-title">Fornecedores: {configProject.name}</h3>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
            <input
              type="email" placeholder="E-mail do fornecedor" className="form-input"
              style={{ flex: 1, padding: '10px' }}
              value={newPartnerEmail} onChange={(e) => setNewPartnerEmail(e.target.value)}
            />
            <button className="btn-primary btn-inline" onClick={async () => {
              const email = newPartnerEmail.toLowerCase().trim();
              if (!email) return;
              const currentList = projectAccess[configProject.id] || [];
              if (currentList.includes(email)) { setNewPartnerEmail(''); return; }
              try {
                await setDoc(doc(db, 'project_access', configProject.id), { authorizedEmails: [...currentList, email] });
                setNewPartnerEmail('');
              } catch (e) { alert('Erro ao adicionar: ' + e.message); }
            }}>Adicionar</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {(projectAccess[configProject.id] || []).length === 0
              ? <p className="text-muted" style={{ fontSize: '14px' }}>Nenhum fornecedor cadastrado.</p>
              : (projectAccess[configProject.id] || []).map(email => (
                <div key={email} className="access-row">
                  <span style={{ fontSize: '14px', fontWeight: 600 }}>{email}</span>
                  <button
                    onClick={async () => {
                      try {
                        await setDoc(doc(db, 'project_access', configProject.id), {
                          authorizedEmails: projectAccess[configProject.id].filter(e => e !== email)
                        });
                      } catch (e) { alert('Erro ao remover: ' + e.message); }
                    }}
                    className="btn-delete"
                  ><X size={18} /></button>
                </div>
              ))
            }
          </div>
        </div>
      )}
    </div>
  );

  const renderList = () => {
    // Rede de segurança: mesmo que a query falhe, o parceiro nunca vê
    // itens de obras às quais não tem acesso.
    const allowedIds = visibleProjects.map(p => p.id);
    let filteredItems = role === 'manager'
      ? items
      : items.filter(i => allowedIds.includes(i.projectId));

    if (selectedProject) filteredItems = filteredItems.filter(i => i.projectId === selectedProject.id);
    if (selectedStage) filteredItems = filteredItems.filter(i => i.stageId === selectedStage.id);
    if (selectedLocation) filteredItems = filteredItems.filter(i => i.locationId === selectedLocation);
    if (statusFilter === 'pending') filteredItems = filteredItems.filter(i => !i.managerApproved);
    if (statusFilter === 'completed') filteredItems = filteredItems.filter(i => i.managerApproved);
    if (disciplineFilter !== 'all') filteredItems = filteredItems.filter(i => i.discipline === disciplineFilter);

    const availableStages = selectedProject
      ? [...(STAGES[selectedProject.id] || []), ...customStages.filter(s => s.projectId === selectedProject.id)]
      : [];

    const doneCount = filteredItems.filter(i => i.managerApproved).length;
    const shownItems = filteredItems.slice(0, visibleCount);
    const remaining = filteredItems.length - shownItems.length;

    // O PDF sai do que está na tela, então antes de imprimir é preciso
    // exibir todos os itens do recorte atual.
    const handlePrint = () => {
      if (filteredItems.length > PRINT_WARN_AT && !window.confirm(
        `Este relatório tem ${filteredItems.length} itens. Montar tudo de uma vez pode travar o celular.\n\nRecomendado: filtre por local ou etapa antes de gerar o PDF.\n\nDeseja continuar mesmo assim?`
      )) return;

      if (remaining > 0) {
        setVisibleCount(filteredItems.length);
        window.setTimeout(() => window.print(), 500);
      } else {
        window.print();
      }
    };

    return (
      <div className="page-container fade-in">
        {/* Cabeçalho que só aparece no PDF/impressão */}
        <div className="hide-screen print-header">
          <h1>VistoriaPRO — Relatório de Vistoria</h1>
          <p>
            <strong>Obra:</strong> {selectedProject?.name || 'Todas as obras'} &nbsp;·&nbsp;
            <strong>Etapa:</strong> {selectedStage?.name || 'Todas'} &nbsp;·&nbsp;
            <strong>Local:</strong> {selectedLocation || 'Todos'}
          </p>
          <p>
            <strong>Emitido em:</strong> {new Date().toLocaleString('pt-BR')} &nbsp;·&nbsp;
            <strong>Itens:</strong> {filteredItems.length} &nbsp;·&nbsp;
            <strong>Concluídos:</strong> {doneCount} &nbsp;·&nbsp;
            <strong>Pendentes:</strong> {filteredItems.length - doneCount}
          </p>
        </div>

        <div className="hide-print list-header" style={{ marginBottom: '8px' }}>
          <h2 className="section-title mb-0">{selectedLocation ? `Itens: ${selectedLocation}` : 'Checklist Geral'}</h2>
          <button onClick={handlePrint} className="btn-secondary"><Printer size={16} /> PDF</button>
        </div>

        <div className="filter-panel hide-print">
          <div className="filter-title"><Filter size={16} /> Buscar Vistorias</div>
          <div className="filter-inputs" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {!selectedLocation && (
              <div style={{ display: 'flex', gap: '8px' }}>
                <select style={{ flex: 1 }} value={selectedProject?.id || 'all'} onChange={e => {
                  const p = ALL_PROJECTS.find(x => x.id === e.target.value);
                  setSelectedProject(p || null); setSelectedStage(null); setSelectedLocation(null);
                }}>
                  <option value="all">Todas as Obras</option>
                  {visibleProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <select style={{ flex: 1 }} value={selectedStage?.id || 'all'} onChange={e => {
                  const s = availableStages.find(x => x.id === e.target.value);
                  setSelectedStage(s || null); setSelectedLocation(null);
                }} disabled={!selectedProject}>
                  <option value="all">Todas as Etapas</option>
                  {availableStages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            )}
            <div style={{ display: 'flex', gap: '8px' }}>
              <select style={{ flex: 1 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                <option value="all">Todos os Status</option>
                <option value="pending">Em Andamento</option>
                <option value="completed">Concluídos</option>
              </select>
              <select style={{ flex: 1 }} value={disciplineFilter} onChange={e => setDisciplineFilter(e.target.value)}>
                <option value="all">Todas as Disciplinas</option>
                {DISCIPLINES.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="checklist">
          {loadingItems && items.length === 0
            ? <p className="empty-state">Carregando vistorias...</p>
            : filteredItems.length === 0
              ? <p className="empty-state">Nenhum registro encontrado.</p>
              : shownItems.map(item => (
                <div key={item.id} className={`checklist-item ${item.managerApproved ? 'approved' : ''}`}>
                  <button
                    className="item-thumbnail"
                    onClick={() => item.photoUrl && setLightbox(item.photoUrl)}
                    title="Ampliar foto"
                  >
                    <img src={item.thumbUrl || item.photoUrl} alt="Vistoria" loading="lazy" decoding="async" />
                  </button>
                  <div className="item-content">
                    <div className="item-header-row">
                      <span className="tag-discipline">{item.discipline}</span>
                      {role === 'manager' && !item.managerApproved && (
                        <div className="item-actions-top hide-print">
                          <button onClick={() => editItem(item)} className="btn-edit"><Pencil size={16} /></button>
                          <button onClick={() => deleteItem(item)} className="btn-delete"><Trash2 size={16} /></button>
                        </div>
                      )}
                    </div>
                    <p className="item-desc">{item.description}</p>

                    {!selectedLocation && (
                      <p className="item-meta">
                        <strong>Obra:</strong> {ALL_PROJECTS.find(p => p.id === item.projectId)?.name || 'N/A'}<br />
                        <strong>Local:</strong> {item.locationId}
                      </p>
                    )}

                    {/* Status legível no PDF (os botões são ocultados na impressão) */}
                    <span className={`hide-screen print-status ${item.managerApproved ? 'ok' : 'pend'}`}>
                      {item.managerApproved ? 'CONCLUÍDO' : (item.partnerFixed ? 'AGUARDANDO APROVAÇÃO DO GERENTE' : 'PENDENTE')}
                    </span>

                    <div className="item-status-row hide-print">
                      <button
                        onClick={() => togglePartnerFixed(item)}
                        disabled={item.managerApproved}
                        className={`check-btn ${item.partnerFixed ? 'checked-partner' : ''}`}
                      >
                        {item.partnerFixed ? <CheckCircle size={16} /> : <Circle size={16} />} Parceiro
                      </button>
                      <button
                        onClick={() => toggleManagerApproved(item)}
                        disabled={role !== 'manager'}
                        className={`check-btn ${item.managerApproved ? 'checked-manager' : ''}`}
                      >
                        {item.managerApproved ? <CheckCircle size={16} /> : <Circle size={16} />} OK Gerente
                      </button>
                    </div>
                  </div>
                </div>
              ))
          }
        </div>

        {remaining > 0 && (
          <button className="btn-load-more hide-print" onClick={() => setVisibleCount(c => c + PAGE_SIZE)}>
            Mostrar mais {Math.min(PAGE_SIZE, remaining)}
            <span> · restam {remaining}</span>
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
    else if (view === 'settings') setView('dashboard');
  };

  const goTo = (nextView) => {
    setView(nextView);
    setSelectedProject(null); setSelectedStage(null); setSelectedLocation(null);
  };

  const approvedCount = items.filter(i => i.managerApproved).length;

  return (
    <div className="app-layout">
      {lightbox && (
        <div className="lightbox" onClick={() => setLightbox(null)}>
          <button className="lightbox-close"><X size={24} /></button>
          <img src={lightbox} alt="Foto da vistoria" />
        </div>
      )}

      {isMarking && (
        <div className="markup-modal">
          <div className="markup-header">
            <button onClick={() => setIsMarking(false)} className="btn-secondary" style={{ background: 'transparent', color: 'white' }}>
              <ArrowLeft size={18} /> Voltar
            </button>
            <button onClick={saveMarkedPhoto} className="btn-primary btn-inline">Salvar Marcação</button>
          </div>
          <div className="canvas-container">
            <canvas
              ref={canvasRef}
              onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={stopDrawing} onMouseLeave={stopDrawing}
              onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={stopDrawing} onTouchCancel={stopDrawing}
            />
          </div>
          <div className="markup-tools">
            <div className="tool-group">
              <button className={`tool-btn ${drawMode === 'pencil' ? 'active' : ''}`} onClick={() => setDrawMode('pencil')}><Pencil size={20} /></button>
              <button className={`tool-btn ${drawMode === 'arrow' ? 'active' : ''}`} onClick={() => setDrawMode('arrow')}><MousePointer2 size={20} /></button>
              <button className={`tool-btn ${drawMode === 'circle' ? 'active' : ''}`} onClick={() => setDrawMode('circle')}><Circle size={20} /></button>
            </div>
            <div className="tool-group">
              {COLORS.map(c => (
                <button key={c} className={`color-btn ${color === c ? 'active' : ''}`} style={{ backgroundColor: c }} onClick={() => setColor(c)} />
              ))}
            </div>
            <button onClick={undoDrawing} disabled={drawingHistory.length <= 1} className="tool-btn"><Undo size={20} /></button>
          </div>
        </div>
      )}

      <header className="app-header hide-print">
        <div className="header-left">
          {view !== 'dashboard' && view !== 'projects' && !isMarking && (
            <button onClick={handleBack} className="back-btn"><ArrowLeft size={20} /></button>
          )}
          <h1 className="app-title">Vistoria<span>PRO</span></h1>
        </div>
        <div className="header-right">
          <div className="user-info">
            <span className="user-email" title={user.email}>{user.email.split('@')[0]}</span>
            <span className={`user-badge ${role === 'manager' ? 'badge-manager' : 'badge-partner'}`}>
              {role === 'manager' ? 'Gerente' : 'Parceiro'}
            </span>
          </div>
          <button onClick={() => signOut(auth)} className="btn-logout" title="Sair"><LogOut size={20} /></button>
        </div>
      </header>

      <main className="app-main">
        {view === 'dashboard' && (
          <div className="page-container fade-in">
            <h2 className="section-title">Painel de Resumo</h2>

            {(roleSource === 'fallback' || roleSource === 'error') && (
              <div className="role-warning">
                <strong>Perfil não confirmado no banco.</strong> O app está te tratando como gerente
                pela lista interna, mas não encontrou o documento <code>{userEmail}</code> na coleção
                <code>roles</code>. Enquanto isso, aprovar e excluir vão falhar. Conectado como{' '}
                <strong>{userEmail}</strong>.
              </div>
            )}
            <div className="stats-grid">
              <div className="stat-card">
                <span className="stat-value">{items.length}</span>
                <span className="stat-label">Total Itens</span>
              </div>
              <div className="stat-card">
                <span className="stat-value text-green">{approvedCount}</span>
                <span className="stat-label">Concluídos</span>
              </div>
            </div>
            {role !== 'manager' && (
              <p className="text-muted" style={{ fontSize: '13px' }}>
                Números referentes apenas às obras liberadas para o seu acesso.
              </p>
            )}
          </div>
        )}

        {view === 'projects' && (
          <div className="page-container fade-in">
            <h2 className="section-title">Selecione a Obra</h2>
            <div className="list-group">
              {visibleProjects.map(p => {
                const isCustom = customProjects.some(cp => cp.id === p.id);
                return (
                  <div key={p.id} className="list-item-wrapper">
                    <button className="list-item" onClick={() => { setSelectedProject(p); setView('stages'); }}>
                      <span className="icon-blue"><Building2 size={24} /></span> {p.name}
                    </button>
                    {isCustom && role === 'manager' && (
                      <button onClick={() => deleteProjectCascade(p)} className="btn-delete-item" title="Excluir obra">
                        <Trash2 size={20} />
                      </button>
                    )}
                  </div>
                );
              })}
              {visibleProjects.length === 0 && (
                <p className="empty-state">Nenhuma obra liberada para o seu acesso.</p>
              )}
              {role === 'manager' && (
                <button className="list-item dashed" onClick={async () => {
                  const name = window.prompt('Nome da nova obra (Ex: DSPO - Fachada):');
                  if (name && name.trim()) {
                    try { await addDoc(collection(db, 'custom_projects'), { name: name.trim() }); }
                    catch (e) { alert('Erro ao criar obra: ' + e.message); }
                  }
                }}>
                  <span>+ Adicionar Nova Obra</span>
                </button>
              )}
            </div>
          </div>
        )}

        {view === 'stages' && selectedProject && (
          <div className="page-container fade-in">
            <h2 className="section-title">{selectedProject.name} - Etapas</h2>
            <div className="list-group">
              {[...(STAGES[selectedProject.id] || []), ...customStages.filter(s => s.projectId === selectedProject.id)].map(s => {
                const isCustom = customStages.some(cs => cs.id === s.id);
                return (
                  <div key={s.id} className="list-item-wrapper">
                    <button className="list-item" onClick={() => { setSelectedStage(s); setView('locations'); }}>{s.name}</button>
                    {isCustom && role === 'manager' && (
                      <button onClick={() => deleteStageCascade(s)} className="btn-delete-item" title="Excluir etapa">
                        <Trash2 size={20} />
                      </button>
                    )}
                  </div>
                );
              })}
              {role === 'manager' && (
                <button className="list-item dashed" onClick={async () => {
                  const name = window.prompt('Nome da nova etapa (Ex: Pavimento 1):');
                  if (name && name.trim()) {
                    try { await addDoc(collection(db, 'custom_stages'), { projectId: selectedProject.id, name: name.trim() }); }
                    catch (e) { alert('Erro ao criar etapa: ' + e.message); }
                  }
                }}>
                  <span>+ Adicionar Nova Etapa</span>
                </button>
              )}
            </div>
          </div>
        )}

        {view === 'locations' && selectedStage && (
          <div className="page-container fade-in">
            <h2 className="section-title">{selectedStage.name} - Locais</h2>
            <div className="grid-locations">
              {Array.from(new Set([
                ...(selectedStage.locations || []),
                ...customLocations.filter(l => l.stageId === selectedStage.id).map(l => l.name)
              ])).map(l => (
                <button key={l} className="location-card" onClick={() => { setSelectedLocation(l); setView('list'); }}>{l}</button>
              ))}
              {role === 'manager' && (
                <button className="location-card dashed" onClick={async () => {
                  const name = window.prompt('Nome do novo local (Ex: Quarto 101):');
                  if (name && name.trim()) {
                    try {
                      await addDoc(collection(db, 'custom_locations'), {
                        projectId: selectedProject.id, stageId: selectedStage.id, name: name.trim()
                      });
                    } catch (e) { alert('Erro ao criar local: ' + e.message); }
                  }
                }}>
                  <span>+ Novo Local</span>
                </button>
              )}
            </div>
          </div>
        )}

        {view === 'list' && renderList()}
        {view === 'settings' && role === 'manager' && renderSettings()}

        {view === 'form' && !isMarking && (() => {
          const availableFormStages = formProject
            ? [...(STAGES[formProject] || []), ...customStages.filter(s => s.projectId === formProject)]
            : [];
          const selectedFormStageObj = availableFormStages.find(s => s.id === formStage);
          const availableFormLocations = Array.from(new Set([
            ...(selectedFormStageObj?.locations || []),
            ...customLocations.filter(l => l.stageId === formStage).map(l => l.name)
          ]));
          const formProjects = role === 'manager' ? ALL_PROJECTS : visibleProjects;

          return (
            <div className="page-container fade-in">
              <h2 className="section-title">{editingItem ? 'Editar Registro' : 'Novo Registro'}</h2>
              <div className="form-card">

                <div className="form-group" style={{ display: 'flex', gap: '8px' }}>
                  <div style={{ flex: 1 }}>
                    <label className="form-label">Obra</label>
                    <select className="form-input" value={formProject} onChange={e => { setFormProject(e.target.value); setFormStage(''); setFormLocation(''); }}>
                      <option value="">Selecione...</option>
                      {formProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                  <div style={{ flex: 1 }}>
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

                <div className="form-group" style={{ marginTop: '16px' }}>
                  {photo ? (
                    <div className="photo-preview-wrapper">
                      <img src={photo} alt="Pré-visualização" />
                      <button onClick={() => setIsMarking(true)} className="btn-mark"><PaintBucket size={16} /> Marcar Foto</button>
                      <button onClick={() => { setPhoto(null); setPhotoDirty(true); }} className="btn-photo-remove"><X size={16} /></button>
                    </div>
                  ) : (
                    <div className="photo-upload-area">
                      <div className="photo-placeholder"><Camera size={48} /><span>Tirar Foto ou Galeria</span></div>
                      <input type="file" accept="image/*" capture="environment" onChange={handlePhotoUpload} className="photo-input" />
                    </div>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label">Descrição</label>
                  <textarea className="form-input" placeholder="Descreva o problema..." value={description} onChange={e => setDescription(e.target.value)} rows="3" />
                </div>

                <div className="form-group" style={{ marginBottom: '24px' }}>
                  <label className="form-label">Disciplina</label>
                  <select className="form-input" value={discipline} onChange={e => setDiscipline(e.target.value)}>
                    <option value="">Selecione...</option>
                    {DISCIPLINES.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>

                <button onClick={saveItem} className="btn-primary" disabled={saving}>
                  {saving ? 'Salvando...' : (editingItem ? 'Salvar Alterações' : 'Salvar Vistoria')}
                </button>
              </div>
            </div>
          );
        })()}
      </main>

      {view === 'list' && !isMarking && !lightbox && (
        <button className="fab-btn hide-print" onClick={handleNewItem}><Camera size={20} /></button>
      )}

      {!isMarking && (
        <nav className="bottom-nav hide-print">
          <button onClick={() => goTo('dashboard')} className={view === 'dashboard' ? 'active' : ''}>
            <BarChart3 size={24} /><span>Status</span>
          </button>
          <button onClick={() => goTo('projects')} className={['projects', 'stages', 'locations'].includes(view) ? 'active' : ''}>
            <Building2 size={24} /><span>Obras</span>
          </button>
          <button onClick={() => goTo('list')} className={['list', 'form'].includes(view) ? 'active' : ''}>
            <FileText size={24} /><span>Checklists</span>
          </button>
          {role === 'manager' && (
            <button onClick={() => goTo('settings')} className={view === 'settings' ? 'active' : ''}>
              <Settings size={24} /><span>Config</span>
            </button>
          )}
        </nav>
      )}
    </div>
  );
}