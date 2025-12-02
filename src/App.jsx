import React, { useState, useEffect, useMemo, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, signInAnonymously, onAuthStateChanged, 
  signInWithCustomToken, GoogleAuthProvider, signInWithPopup, signOut 
} from 'firebase/auth';
import { 
  getFirestore, collection, addDoc, query, orderBy, 
  onSnapshot, deleteDoc, doc, serverTimestamp, enableIndexedDbPersistence 
} from 'firebase/firestore';
import { 
  Plus, Trash2, Receipt, TrendingUp, Calendar, Image as ImageIcon, 
  X, Wallet, ShoppingBag, Car, Home, Zap, Coffee, MoreHorizontal, 
  Loader2, LogIn, LogOut, User, Wifi, WifiOff, ChevronLeft, ChevronRight, Download 
} from 'lucide-react';

// ============================================================================
// 1. CONFIGURAÇÃO E UTILITÁRIOS
// ============================================================================

// --- Configuração do Firebase ---
// LÓGICA HÍBRIDA:
// 1. Se estiver no Canvas (ambiente de teste), usa __firebase_config automático.
// 2. Se estiver no seu PC, usa o objeto com suas chaves manuais.
const firebaseConfig = typeof __firebase_config !== 'undefined' 
  ? JSON.parse(__firebase_config) 
  : {
      apiKey: "AIzaSyDM8gHmf1w-TO5eAtiq0mkSthY7CxqLYs8",
      authDomain: "controlefinanceiro-c9edd.firebaseapp.com",
      projectId: "controlefinanceiro-c9edd",
      storageBucket: "controlefinanceiro-c9edd.firebasestorage.app",
      messagingSenderId: "1019736820890",
      appId: "1:1019736820890:web:cbeb58a799fa448a942323",
      measurementId: "G-348L7J2HBQ"
    };

// Inicialização do Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Se estiver no Canvas, usa o ID do app injetado, senão usa um nome fixo
const appId = typeof __app_id !== 'undefined' ? __app_id : "meu-app-financeiro";

// Ativar Offline
try { 
  enableIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
      console.log('Persistência falhou: Múltiplas abas abertas.');
    } else if (err.code === 'unimplemented') {
      console.log('Navegador não suporta persistência.');
    }
  }); 
} catch (e) {
  console.log("Persistência já ativa ou erro:", e);
}

// Constantes
const CATEGORIES = [
  { id: 'food', label: 'Alimentação', icon: Coffee, color: 'bg-orange-100 text-orange-600' },
  { id: 'transport', label: 'Transporte', icon: Car, color: 'bg-blue-100 text-blue-600' },
  { id: 'housing', label: 'Casa', icon: Home, color: 'bg-purple-100 text-purple-600' },
  { id: 'shopping', label: 'Compras', icon: ShoppingBag, color: 'bg-pink-100 text-pink-600' },
  { id: 'bills', label: 'Contas', icon: Zap, color: 'bg-yellow-100 text-yellow-600' },
  { id: 'others', label: 'Outros', icon: MoreHorizontal, color: 'bg-gray-100 text-gray-600' },
];

// Funções Auxiliares (Utils)
const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

const compressImage = (file) => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (e) => {
      const img = new Image();
      img.src = e.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800;
        const scale = MAX_WIDTH / img.width;
        canvas.width = MAX_WIDTH;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
    };
  });
};

// ============================================================================
// 2. CUSTOM HOOKS (Lógica separada da tela)
// ============================================================================

// Hook de Autenticação
function useAuth() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    // Verifica token injetado (ambiente teste) ou fluxo normal
    if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
       signInWithCustomToken(auth, __initial_auth_token);
    } 
    
    const unsub = onAuthStateChanged(auth, (u) => {
      if (u) setUser(u);
      else signInAnonymously(auth).catch(console.error);
    });
    return unsub;
  }, []);

  const loginGoogle = async () => {
    try { await signInWithPopup(auth, new GoogleAuthProvider()); }
    catch (e) { alert("Erro no login Google"); }
  };

  const logout = async () => {
    if (window.confirm("Sair?")) { await signOut(auth); window.location.reload(); }
  };

  return { user, loginGoogle, logout };
}

// Hook de Gastos (Data Fetching & Actions)
function useExpenses(user, currentDate) {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'artifacts', appId, 'users', user.uid, 'expenses'), orderBy('createdAt', 'desc'));
    
    const unsub = onSnapshot(q, { includeMetadataChanges: true }, (snap) => {
      const data = snap.docs.map(doc => ({
        id: doc.id, ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        isPending: doc.metadata.hasPendingWrites
      }));
      setExpenses(data);
      setLoading(false);
    });
    return unsub;
  }, [user]);

  const addExpense = async (data) => {
    await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'expenses'), {
      ...data, createdAt: serverTimestamp()
    });
  };

  const deleteExpense = async (id) => {
    if (window.confirm("Excluir?")) {
      await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'expenses', id));
    }
  };

  // Filtros de Data
  const filtered = useMemo(() => expenses.filter(e => 
    e.createdAt.getMonth() === currentDate.getMonth() && 
    e.createdAt.getFullYear() === currentDate.getFullYear()
  ), [expenses, currentDate]);

  const total = useMemo(() => filtered.reduce((acc, curr) => acc + Number(curr.amount), 0), [filtered]);

  return { expenses, filtered, total, loading, addExpense, deleteExpense };
}

// ============================================================================
// 3. COMPONENTES VISUAIS (UI)
// ============================================================================

const Header = ({ total, currentDate, onPrev, onNext, isOnline, user, onLogin, onLogout, onExport }) => (
  <header className="sticky top-0 z-40 bg-indigo-600 text-white shadow-lg transition-colors">
    {!isOnline && <div className="bg-orange-500 text-xs font-bold text-center py-1 absolute w-full top-0">Offline</div>}
    <div className={`max-w-md mx-auto px-6 py-4 ${!isOnline ? 'pt-8' : ''}`}>
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-1.5 bg-indigo-700/50 px-2 py-1 rounded-full text-[10px] border border-indigo-500/30">
           {isOnline ? <><Wifi size={12} className="text-green-300"/> <span>Online</span></> : <><WifiOff size={12} className="text-orange-300"/> <span>Offline</span></>}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onExport} className="p-1.5 bg-indigo-500/80 rounded-lg"><Download size={18}/></button>
          {user?.isAnonymous ? (
            <button onClick={onLogin} className="px-3 py-1.5 bg-white text-indigo-600 rounded-lg text-xs font-bold flex gap-2"><LogIn size={14}/> Entrar</button>
          ) : (
            <div className="flex items-center gap-2">
               {user?.photoURL ? <img src={user.photoURL} className="w-8 h-8 rounded-full border-2 border-indigo-400"/> : <User size={16} className="bg-indigo-400 p-1 rounded-full w-8 h-8"/>}
               <button onClick={onLogout} className="p-1.5 bg-indigo-500/80 rounded-lg"><LogOut size={16}/></button>
            </div>
          )}
        </div>
      </div>
      <div className="flex flex-col items-center mb-2">
         <div className="flex items-center gap-4 mb-2 bg-indigo-700/30 px-4 py-1 rounded-full backdrop-blur-sm">
            <button onClick={onPrev}><ChevronLeft size={20}/></button>
            <span className="text-sm font-semibold uppercase w-32 text-center">{currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</span>
            <button onClick={onNext}><ChevronRight size={20}/></button>
         </div>
         <h1 className="text-4xl font-bold">{formatCurrency(total)}</h1>
      </div>
    </div>
  </header>
);

const ExpenseForm = ({ onSave, onCancel }) => {
  const [amount, setAmount] = useState('');
  const [desc, setDesc] = useState('');
  const [cat, setCat] = useState('food');
  const [img, setImg] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!amount || !desc) return;
    setSubmitting(true);
    await onSave({ amount: parseFloat(amount), description: desc, category: cat, receiptBase64: img });
    setSubmitting(false);
  };

  const handleFile = async (e) => {
    if (e.target.files[0]) setImg(await compressImage(e.target.files[0]));
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-6 animate-in slide-in-from-top-4">
      <div className="flex justify-between items-center mb-4"><h3 className="font-semibold text-gray-700">Novo Gasto</h3><button onClick={onCancel} className="text-gray-400"><X size={20}/></button></div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div><label className="text-xs font-bold text-gray-500 uppercase">Valor</label><div className="relative"><span className="absolute left-3 top-3 text-gray-400">R$</span><input type="number" step="0.01" value={amount} onChange={e=>setAmount(e.target.value)} className="w-full pl-10 p-3 bg-gray-50 rounded-lg text-lg outline-none focus:ring-2 ring-indigo-100" autoFocus required/></div></div>
        <div><label className="text-xs font-bold text-gray-500 uppercase">Descrição</label><input value={desc} onChange={e=>setDesc(e.target.value)} className="w-full p-3 bg-gray-50 rounded-lg outline-none focus:ring-2 ring-indigo-100" required/></div>
        <div className="grid grid-cols-2 gap-4">
          <div><label className="text-xs font-bold text-gray-500 uppercase">Categoria</label><select value={cat} onChange={e=>setCat(e.target.value)} className="w-full p-3 bg-gray-50 rounded-lg outline-none">{CATEGORIES.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}</select></div>
          <div><label className="text-xs font-bold text-gray-500 uppercase">Nota</label><div onClick={()=>fileRef.current?.click()} className={`w-full p-3 rounded-lg border border-dashed flex justify-center items-center gap-2 cursor-pointer ${img?'bg-green-50 text-green-700':'bg-gray-50'}`}>{img?<Receipt size={16}/>:<ImageIcon size={16}/>}</div><input type="file" ref={fileRef} onChange={handleFile} className="hidden" accept="image/*"/></div>
        </div>
        <button disabled={submitting} className="w-full bg-indigo-600 text-white p-3.5 rounded-xl font-bold shadow-lg flex justify-center">{submitting?<Loader2 className="animate-spin"/>:'Salvar'}</button>
      </form>
    </div>
  );
};

const ExpenseList = ({ expenses, onDelete, onViewReceipt }) => {
  if (expenses.length === 0) return <div className="text-center py-10 opacity-50"><Wallet size={32} className="mx-auto mb-3 text-gray-400"/><p>Sem gastos neste mês.</p></div>;
  
  return (
    <div className="space-y-3">
      {expenses.map(e => {
        const CatIcon = CATEGORIES.find(c=>c.id===e.category)?.icon || MoreHorizontal;
        const catColor = CATEGORIES.find(c=>c.id===e.category)?.color || 'bg-gray-100';
        return (
          <div key={e.id} className={`bg-white p-4 rounded-xl border border-gray-100 flex items-center gap-4 ${e.isPending?'opacity-70':''}`}>
            <div className={`p-2 rounded-full ${catColor}`}><CatIcon size={20}/></div>
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-gray-800 truncate flex items-center gap-2">{e.description} {e.isPending && <span className="text-[10px] bg-orange-100 text-orange-600 px-1 rounded">...</span>}</h4>
              <p className="text-xs text-gray-500">{e.createdAt.toLocaleDateString('pt-BR')} • {CATEGORIES.find(c=>c.id===e.category)?.label} {e.receiptBase64 && <span onClick={()=>onViewReceipt(e.receiptBase64)} className="text-indigo-500 cursor-pointer ml-1 font-medium">Nota</span>}</p>
            </div>
            <div className="text-right">
              <span className="block font-bold">{formatCurrency(e.amount)}</span>
              <button onClick={()=>onDelete(e.id)} className="text-gray-300 hover:text-red-500"><Trash2 size={16}/></button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ============================================================================
// 4. COMPONENTE PRINCIPAL (Orquestrador)
// ============================================================================

export default function App() {
  const { user, loginGoogle, logout } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const { filtered, total, loading, addExpense, deleteExpense, expenses } = useExpenses(user, currentDate);
  
  const [formVisible, setFormVisible] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    window.addEventListener('online', () => setIsOnline(true));
    window.addEventListener('offline', () => setIsOnline(false));
    document.title = `${formatCurrency(total)} - Gastos`;
  }, [total]);

  const handleExport = () => {
    const mode = window.confirm("OK para baixar MÊS ATUAL.\nCancelar para baixar TUDO.");
    const data = JSON.stringify(mode ? filtered : expenses, null, 2);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([data], {type:'application/json'}));
    a.download = "gastos.json";
    a.click();
  };

  const handleSave = async (data) => {
    await addExpense(data);
    setFormVisible(false);
    // Se adicionou em mês diferente, foca nele (opcional, aqui mantive simples)
    if (currentDate.getMonth() !== new Date().getMonth()) setCurrentDate(new Date()); 
  };

  if (loading) return <div className="h-screen flex items-center justify-center text-indigo-600"><Loader2 className="animate-spin" size={48}/></div>;

  return (
    <div className="min-h-screen bg-gray-50 pb-20 font-sans text-gray-800">
      <Header 
        total={total} currentDate={currentDate} isOnline={isOnline} user={user}
        onPrev={() => setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() - 1))}
        onNext={() => setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() + 1))}
        onLogin={loginGoogle} onLogout={logout} onExport={handleExport}
      />

      <main className="max-w-md mx-auto p-4">
        {!formVisible && (
          <button onClick={()=>setFormVisible(true)} className="w-full bg-white border-2 border-dashed border-gray-300 rounded-xl p-4 text-gray-500 font-medium hover:border-indigo-500 flex justify-center gap-2 group transition-all">
            <div className="bg-gray-100 group-hover:bg-indigo-100 p-2 rounded-full"><Plus size={20}/></div> Adicionar Gasto
          </button>
        )}

        {formVisible && <ExpenseForm onSave={handleSave} onCancel={()=>setFormVisible(false)} />}
        
        <div className="mt-6">
          <h2 className="font-bold text-lg mb-3 px-1">{currentDate.getMonth() === new Date().getMonth() && currentDate.getFullYear() === new Date().getFullYear() ? 'Últimos Lançamentos' : `Gastos de ${currentDate.toLocaleDateString('pt-BR',{month:'long'})}`}</h2>
          <ExpenseList expenses={filtered} onDelete={deleteExpense} onViewReceipt={setReceipt} />
        </div>
      </main>
      
      {receipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4" onClick={()=>setReceipt(null)}>
          <img src={receipt} className="max-w-full max-h-[90vh] rounded-lg"/>
          <button className="absolute top-4 right-4 text-white"><X size={32}/></button>
        </div>
      )}
    </div>
  );
}