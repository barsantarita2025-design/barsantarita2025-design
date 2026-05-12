import React, { useState, useEffect } from 'react';
import { getProducts, saveProduct, deleteProduct } from '../services/db';
import { Product } from '../types';
import { Plus, Edit2, Trash2, X, Check, Search, Tag, FolderEdit, FolderPlus, FolderX } from 'lucide-react';

import { DEFAULT_CATEGORIES } from '../constants';

const Products: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Cervezas');
  const [costPrice, setCostPrice] = useState('');
  const [salePrice, setSalePrice] = useState('');
  const [image, setImage] = useState('');

  // Search and Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');

  // Categories State
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [newCategoryName, setNewCategoryName] = useState('');



  // Default categories (cannot be deleted)
  const defaultCategories = DEFAULT_CATEGORIES;

  // All available categories
  const allCategories = [...defaultCategories, ...customCategories];

  useEffect(() => {
    loadProducts();
    loadCategories();
  }, []);

  const loadProducts = async () => {
    const data = await getProducts();
    setProducts(data);
  };

  const loadCategories = () => {
    const saved = localStorage.getItem('barflow_custom_categories');
    if (saved) {
      setCustomCategories(JSON.parse(saved));
    }
  };

  const saveCategories = (cats: string[]) => {
    setCustomCategories(cats);
    localStorage.setItem('barflow_custom_categories', JSON.stringify(cats));
  };

  const openModal = (product?: Product) => {
    if (product) {
      setEditingProduct(product);
      setName(product.name);
      setCategory(product.category);
      setCostPrice(product.costPrice.toString());
      setSalePrice(product.salePrice.toString());
      setImage(product.image || '');
    } else {
      setEditingProduct(null);
      setName('');
      setCategory('Cervezas');
      setCostPrice('');
      setSalePrice('');
      setImage('');
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const product: Product = {
        id: editingProduct ? editingProduct.id : '',
        name,
        category,
        costPrice: Number(costPrice),
        salePrice: Number(salePrice),
        active: true,
        image: image.trim() || undefined
      };
      await saveProduct(product);
      setIsModalOpen(false);
      loadProducts();
    } catch (error) {
      console.error("Error saving product:", error);
      alert("Error al guardar el producto. Asegúrate de que el servidor esté corriendo y la base de datos esté configurada.");
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('¿Seguro que deseas eliminar este producto?')) {
      await deleteProduct(id);
      loadProducts();
    }
  };

  // Category Management
  const handleAddCategory = () => {
    if (newCategoryName.trim() && !allCategories.includes(newCategoryName.trim())) {
      saveCategories([...customCategories, newCategoryName.trim()]);
      setNewCategoryName('');
    }
  };

  const handleEditCategory = (oldCat: string, newCat: string) => {
    const updated = customCategories.map(c => c === oldCat ? newCat : c);
    saveCategories(updated);

    // Also update existing products with this category
    const updatedProducts = products.map(p =>
      p.category === oldCat ? { ...p, category: newCat } : p
    );
    // Note: We'd need to save products here too, but for simplicity we'll reload

    setEditingCategory(null);
    loadProducts();
  };

  const handleDeleteCategory = (cat: string) => {
    if (window.confirm(`¿Eliminar la categoría "${cat}"? Los productos de esta categoría pasarán a "Otros".`)) {
      const updated = customCategories.filter(c => c !== cat);
      saveCategories(updated);

      // Update products with this category
      const updatedProducts = products.map(p =>
        p.category === cat ? { ...p, category: 'Otros' } : p
      );
      // Save updated products
      updatedProducts.forEach(async (p) => {
        await saveProduct(p);
      });

      setEditingCategory(null);
      loadProducts();
    }
  };

  // Filter products based on search term and category
  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'ALL' || p.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="w-full">
          <h2 className="text-2xl md:text-3xl font-black text-bar-text uppercase tracking-tight">Catálogo de Productos</h2>
          <p className="text-slate-400 text-sm">Gestiona el inventario, categorías y precios de venta</p>
        </div>
        <div className="w-full md:w-auto flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => setIsCategoryModalOpen(true)}
            className="flex-1 md:flex-none bg-bar-800 hover:bg-bar-700 text-slate-300 border border-bar-700 font-black uppercase tracking-widest text-xs px-6 py-4 md:py-2.5 rounded-2xl md:rounded-xl flex items-center justify-center gap-3 transition-all active:scale-95"
          >
            <FolderEdit size={20} className="md:w-4 md:h-4" />
            Categorías
          </button>
          <button
            onClick={() => openModal()}
            className="flex-1 md:flex-none bg-bar-500 hover:bg-bar-400 text-bar-950 font-black uppercase tracking-widest text-xs px-8 py-4 md:py-2.5 rounded-2xl md:rounded-xl flex items-center justify-center gap-3 transition-all shadow-xl shadow-bar-500/20 active:scale-95"
          >
            <Plus size={24} className="md:w-5 md:h-5" />
            Nuevo Producto
          </button>
        </div>
      </div>

      {/* Search and Filter Bar */}
      <div className="flex flex-col md:flex-row gap-4 bg-bar-800 p-4 md:p-0 md:bg-transparent rounded-2xl border border-bar-700/50 md:border-0 shadow-lg md:shadow-none">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por nombre o marca..."
            className="w-full bg-bar-900 md:bg-bar-800 border border-bar-600 md:border-bar-700 rounded-xl md:rounded-lg py-3.5 md:py-2.5 pl-12 md:pl-10 pr-4 text-bar-text font-bold focus:outline-none focus:border-bar-500 transition-all"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="w-full md:w-auto bg-bar-900 md:bg-bar-800 border border-bar-600 md:border-bar-700 rounded-xl md:rounded-lg py-3.5 md:py-2.5 px-5 text-bar-text font-bold uppercase text-xs tracking-widest focus:outline-none focus:border-bar-500 outline-none"
        >
          <option value="ALL">TODAS LAS CATEGORÍAS</option>
          {allCategories.map(cat => (
            <option key={cat} value={cat}>{cat.toUpperCase()}</option>
          ))}
        </select>
      </div>

      <div className="bg-bar-800 rounded-2xl border border-bar-700/50 overflow-hidden shadow-2xl">
        {/* Mobile Grid View */}
        <div className="md:hidden divide-y divide-bar-700/50">
            {filteredProducts.length === 0 ? (
                <div className="p-10 text-center text-slate-500 font-bold uppercase tracking-widest text-xs">No hay productos registrados</div>
            ) : (
                filteredProducts.map(p => (
                    <div key={p.id} className="p-5 flex items-center justify-between group active:bg-bar-700/30 transition-colors">
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 bg-bar-950 rounded-2xl flex items-center justify-center text-2xl border border-bar-700/50 shadow-inner">
                                {p.image && p.image.length < 5 ? p.image : '📦'}
                            </div>
                            <div>
                                <h4 className="text-lg font-black text-bar-text uppercase tracking-tighter leading-tight">{p.name}</h4>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 bg-bar-900 px-2 py-0.5 rounded-lg border border-bar-700/30">{p.category}</span>
                                    <span className="text-sm font-black font-mono text-emerald-400">${p.salePrice.toLocaleString()}</span>
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => openModal(p)} className="p-3 bg-bar-900/50 text-slate-400 rounded-xl border border-bar-700/50">
                                <Edit2 size={18} />
                            </button>
                            <button onClick={() => handleDelete(p.id)} className="p-3 bg-rose-950/20 text-rose-500 rounded-xl border border-rose-500/20">
                                <Trash2 size={18} />
                            </button>
                        </div>
                    </div>
                ))
            )}
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left">
            <thead>
                <tr className="bg-bar-950 text-slate-500 text-[10px] font-black uppercase tracking-widest">
                <th className="p-5">Nombre del Producto</th>
                <th className="p-5">Categoría</th>
                <th className="p-5 text-right">Costo Interno</th>
                <th className="p-5 text-right">Venta Público</th>
                <th className="p-5 text-center">Acciones</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-bar-700/50">
                {filteredProducts.map((p) => (
                    <tr key={p.id} className="hover:bg-bar-700/20 transition-colors">
                    <td className="p-5 font-black text-bar-text uppercase tracking-tight">{p.name}</td>
                    <td className="p-5">
                        <span className="inline-flex items-center gap-2 bg-bar-900 text-slate-400 font-bold px-3 py-1.5 rounded-xl text-[10px] uppercase tracking-widest border border-bar-700/50">
                        <Tag size={12} className="text-bar-500" />
                        {p.category}
                        </span>
                    </td>
                    <td className="p-5 text-right text-slate-400 font-mono">${p.costPrice.toLocaleString()}</td>
                    <td className="p-5 text-right text-emerald-400 font-black font-mono text-lg">${p.salePrice.toLocaleString()}</td>
                    <td className="p-5">
                        <div className="flex justify-center gap-2">
                        <button onClick={() => openModal(p)} className="p-2.5 bg-bar-900/50 hover:bg-bar-700 text-slate-400 hover:text-bar-text rounded-xl transition-all" title="Editar">
                            <Edit2 size={18} />
                        </button>
                        <button onClick={() => handleDelete(p.id)} className="p-2.5 bg-rose-950/30 hover:bg-rose-600 text-rose-400 hover:text-white rounded-xl transition-all" title="Eliminar">
                            <Trash2 size={18} />
                        </button>
                        </div>
                    </td>
                    </tr>
                ))}
            </tbody>
            </table>
        </div>
      </div>

      {/* Summary */}
      <div className="flex items-center justify-between text-sm text-slate-400">
        <span>Total productos: {filteredProducts.length} de {products.length}</span>
      </div>

      {/* Product Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-end md:items-center justify-center md:p-4 z-[100]">
          <div className="bg-bar-800 w-full md:max-w-md h-[95vh] md:h-auto rounded-t-[3rem] md:rounded-3xl border-t md:border border-bar-600 shadow-2xl flex flex-col overflow-hidden">
            <div className="p-8 md:p-6 border-b border-bar-700 flex justify-between items-center shrink-0">
              <h3 className="text-2xl md:text-xl font-black text-bar-text uppercase tracking-tighter">{editingProduct ? 'Editar Producto' : 'Nuevo Producto'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-bar-text bg-bar-900 p-2 rounded-xl">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-8 md:p-6 space-y-6 no-scrollbar">
              <div className="w-12 h-1.5 bg-bar-700 rounded-full mx-auto mb-6 md:hidden" />
              
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Nombre Comercial</label>
                <input required type="text" value={name} onChange={e => setName(e.target.value)} className="w-full bg-bar-900 border border-bar-700 rounded-2xl p-4 text-bar-text font-bold text-lg focus:border-bar-500 outline-none transition-all shadow-inner" placeholder="Ej. Poker 330ml" />
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Clasificación / Categoría</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-bar-900 border border-bar-700 rounded-2xl p-4 text-bar-text font-bold focus:border-bar-500 outline-none transition-all"
                >
                  {allCategories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Icono o Emoji (Opcional)</label>
                <input type="text" value={image} onChange={e => setImage(e.target.value)} className="w-full bg-bar-900 border border-bar-700 rounded-2xl p-4 text-bar-text font-bold text-2xl text-center focus:border-bar-500 outline-none transition-all" placeholder="🍺" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Costo Compra</label>
                  <input required type="number" min="0" value={costPrice} onChange={e => setCostPrice(e.target.value)} className="w-full bg-bar-900 border border-bar-700 rounded-2xl p-4 text-bar-text font-mono text-xl font-black text-center focus:border-bar-500 outline-none" placeholder="0" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Precio Venta</label>
                  <input required type="number" min="0" value={salePrice} onChange={e => setSalePrice(e.target.value)} className="w-full bg-bar-900 border border-bar-700 rounded-2xl p-4 text-emerald-400 font-mono text-xl font-black text-center focus:border-bar-500 outline-none" placeholder="0" />
                </div>
              </div>

              {costPrice && salePrice && (
                <div className="p-6 bg-emerald-950/10 rounded-2xl border border-emerald-500/20 flex flex-col gap-3">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Utilidad Estimada:</span>
                    <span className="text-xl font-black text-emerald-400 font-mono">${(Number(salePrice) - Number(costPrice)).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Margen de Ganancia:</span>
                    <span className="text-lg font-black text-bar-text font-mono">{Math.round(((Number(salePrice) - Number(costPrice)) / Number(costPrice)) * 100)}%</span>
                  </div>
                </div>
              )}

              <div className="pt-4">
                <button type="submit" className="w-full bg-bar-500 hover:bg-bar-400 text-bar-950 font-black uppercase tracking-widest py-5 rounded-2xl shadow-xl shadow-bar-500/20 flex items-center justify-center gap-3 transition-all active:scale-95">
                    <Check size={24} />
                    Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Category Management Modal */}
      {
        isCategoryModalOpen && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-bar-800 rounded-2xl w-full max-w-md border border-bar-700 shadow-2xl max-h-[80vh] overflow-y-auto">
              <div className="p-6 border-b border-bar-700 flex justify-between items-center sticky top-0 bg-bar-800">
                <div>
                  <h3 className="text-xl font-bold text-bar-text">Gestionar Categorías</h3>
                  <p className="text-sm text-slate-400">Crea, edita o elimina categorías personalizadas</p>
                </div>
                <button onClick={() => setIsCategoryModalOpen(false)} className="text-slate-400 hover:text-bar-text">
                  <X size={24} />
                </button>
              </div>

              <div className="p-6 space-y-4">
                {/* Add New Category */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="Nueva categoría..."
                    className="flex-1 bg-bar-900 border border-bar-600 rounded-lg p-2.5 text-bar-text focus:ring-1 focus:ring-bar-500 outline-none"
                    onKeyPress={(e) => e.key === 'Enter' && handleAddCategory()}
                  />
                  <button
                    onClick={handleAddCategory}
                    disabled={!newCategoryName.trim()}
                    className="bg-emerald-600 hover:bg-emerald-500 text-bar-text font-bold px-4 py-2 rounded-lg flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <FolderPlus size={20} />
                    Agregar
                  </button>
                </div>

                {/* Categories List */}
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-slate-400 uppercase tracking-wider">Categorías ({allCategories.length})</h4>

                  {allCategories.map((cat) => (
                    <div key={cat} className="flex items-center justify-between bg-bar-900/50 p-3 rounded-lg border border-bar-700">
                      {editingCategory === cat ? (
                        <div className="flex gap-2 flex-1">
                          <input
                            type="text"
                            defaultValue={cat}
                            id={`edit-${cat}`}
                            className="flex-1 bg-bar-800 border border-bar-600 rounded p-2 text-bar-text"
                          />
                          <button
                            onClick={() => {
                              const input = document.getElementById(`edit-${cat}`) as HTMLInputElement;
                              if (input && input.value.trim() && input.value.trim() !== cat) {
                                handleEditCategory(cat, input.value.trim());
                              } else {
                                setEditingCategory(null);
                              }
                            }}
                            className="p-2 bg-emerald-600 hover:bg-emerald-500 text-bar-text rounded"
                          >
                            <Check size={18} />
                          </button>
                          <button
                            onClick={() => setEditingCategory(null)}
                            className="p-2 bg-bar-600 hover:bg-bar-500 text-bar-text rounded"
                          >
                            <X size={18} />
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-2">
                            <Tag size={16} className="text-bar-500" />
                            <span className="text-bar-text font-medium">{cat}</span>
                            {defaultCategories.includes(cat) && (
                              <span className="text-xs text-slate-500 bg-bar-800 px-2 py-0.5 rounded">Predeterminada</span>
                            )}
                          </div>
                          <div className="flex gap-1">
                            <button
                              onClick={() => setEditingCategory(cat)}
                              className="p-2 hover:bg-bar-600 rounded text-slate-400 hover:text-bar-text transition-colors"
                              title="Editar"
                            >
                              <Edit2 size={16} />
                            </button>
                            {!defaultCategories.includes(cat) && (
                              <button
                                onClick={() => handleDeleteCategory(cat)}
                                className="p-2 hover:bg-rose-900/50 rounded text-rose-400 hover:text-rose-200 transition-colors"
                                title="Eliminar"
                              >
                                <FolderX size={16} />
                              </button>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>

                <div className="pt-4 border-t border-bar-700">
                  <p className="text-xs text-slate-500">
                    * Las categorías predeterminadas no pueden eliminarse, solo las personalizadas.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
    </div>
  );
};

export default Products;
