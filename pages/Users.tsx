import React, { useState, useEffect } from 'react';
import { getUsers, saveUser, deleteUser } from '../services/db';
import { User, Role } from '../types';
import { Plus, Trash2, User as UserIcon, Shield } from 'lucide-react';

const Users: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('EMPLOYEE');

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    const data = await getUsers();
    setUsers(data);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password || !name) return;

    const newUser: User = {
      id: '', // DB service will generate safe ID
      username,
      name,
      password,
      role
    };

    await saveUser(newUser);
    setUsername('');
    setName('');
    setPassword('');
    setRole('EMPLOYEE');
    loadUsers();
  };

  const handleDelete = async (id: string) => {
    try {
      if (window.confirm("¿Eliminar usuario?")) {
        await deleteUser(id);
        loadUsers();
      }
    } catch (e: any) {
      alert(e.message || "Error al eliminar");
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pb-10">
      {/* Create User Form */}
      <div className="bg-bar-800 p-8 md:p-6 rounded-3xl border border-bar-700 shadow-2xl h-fit">
        <h3 className="text-2xl md:text-xl font-black text-bar-text mb-6 flex items-center gap-3 uppercase tracking-tighter">
          <Plus size={24} className="text-bar-500" />
          Nuevo Usuario
        </h3>
        <form onSubmit={handleCreate} className="space-y-5">
          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Nombre Completo</label>
            <input value={name} onChange={e => setName(e.target.value)} className="w-full bg-bar-900 border border-bar-700 rounded-2xl p-4 text-bar-text font-bold focus:border-bar-500 outline-none transition-all shadow-inner" placeholder="Ej. Carlos Mendoza" />
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Usuario de Acceso</label>
            <input value={username} onChange={e => setUsername(e.target.value)} className="w-full bg-bar-900 border border-bar-700 rounded-2xl p-4 text-bar-text font-bold focus:border-bar-500 outline-none transition-all shadow-inner" placeholder="Ej. carlosem" />
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Contraseña Segura</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-bar-900 border border-bar-700 rounded-2xl p-4 text-bar-text font-bold focus:border-bar-500 outline-none transition-all shadow-inner" placeholder="••••••••" />
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Rol en el Sistema</label>
            <select value={role} onChange={e => setRole(e.target.value as Role)} className="w-full bg-bar-900 border border-bar-700 rounded-2xl p-4 text-bar-text font-bold focus:border-bar-500 outline-none transition-all">
              <option value="EMPLOYEE">EMPLEADO (PUNTO DE VENTA)</option>
              <option value="ADMIN">ADMINISTRADOR (TODO)</option>
            </select>
          </div>
          <button type="submit" className="w-full bg-bar-500 hover:bg-bar-400 text-bar-950 font-black uppercase tracking-widest py-5 rounded-2xl mt-4 transition-all active:scale-95 shadow-xl shadow-bar-500/20">
            Crear Miembro de Equipo
          </button>
        </form>
      </div>

      {/* User List */}
      <div className="lg:col-span-2 space-y-6">
        <h2 className="text-2xl md:text-3xl font-black text-bar-text uppercase tracking-tight">Equipo de Trabajo</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4">
          {users.map(user => (
            <div key={user.id} className="bg-bar-800 border border-bar-700 p-6 rounded-3xl flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl hover:bg-bar-700/30 transition-all group">
              <div className="flex items-center gap-5 w-full">
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 shadow-inner ${user.role === 'ADMIN' ? 'bg-purple-900/30 text-purple-400 border border-purple-500/20' : 'bg-slate-900/50 text-slate-400 border border-slate-700/50'}`}>
                  {user.role === 'ADMIN' ? <Shield size={32} /> : <UserIcon size={32} />}
                </div>
                <div>
                  <p className="text-xl font-black text-bar-text uppercase tracking-tighter">{user.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">@{user.username}</span>
                    <span className="text-slate-700">•</span>
                    <span className={`text-[10px] font-black uppercase tracking-widest ${user.role === 'ADMIN' ? 'text-purple-400' : 'text-slate-400'}`}>
                        {user.role === 'ADMIN' ? 'Administrador' : 'Empleado'}
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => handleDelete(user.id)}
                className="w-full sm:w-auto p-4 bg-rose-950/20 text-rose-500 border border-rose-500/20 rounded-2xl hover:bg-rose-600 hover:text-white transition-all active:scale-95"
                title="Eliminar usuario"
              >
                <Trash2 size={24} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Users;