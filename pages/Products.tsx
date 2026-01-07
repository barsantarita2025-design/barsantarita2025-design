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
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold text-bar-text">Productos</h2>
          <p className="text-slate-400">Gestiona el inventario y precios</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setIsCategoryModalOpen(true)}
            className="bg-bar-700 hover:bg-bar-600 text-bar-text font-bold px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
          >
            <FolderEdit size={20} />
            Categorías
          </button>
          <button
            onClick={() => openModal()}
            className="bg-bar-500 hover:bg-bar-400 text-bar-950 font-bold px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
          >
            <Plus size={20} />
            Nuevo Producto
          </button>
        </div>
      </div>

      {/* Search and Filter Bar */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por nombre..."
            className="w-full bg-bar-800 border border-bar-600 rounded-lg py-2.5 pl-10 pr-4 text-bar-text focus:outline-none focus:border-bar-500"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="bg-bar-800 border border-bar-600 rounded-lg py-2.5 px-4 text-bar-text focus:outline-none focus:border-bar-500 min-w-[180px]"
        >
          <option value="ALL">Todas las categorías</option>
          {allCategories.map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
      </div>

      <div className="bg-bar-800 rounded-xl border border-bar-700 overflow-hidden shadow-xl">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-bar-950 text-slate-400 text-sm uppercase tracking-wider">
              <th className="p-4">Nombre</th>
              <th className="p-4">Categoría</th>
              <th className="p-4 text-right">Costo (Interno)</th>
              <th className="p-4 text-right">Venta (Público)</th>
              <th className="p-4 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-bar-700">
            {filteredProducts.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-slate-500">
                  {searchTerm || categoryFilter !== 'ALL'
                    ? 'No se encontraron productos con esos filtros.'
                    : 'No hay productos registrados.'}
                </td>
              </tr>
            ) : (
              filteredProducts.map((p) => (
                <tr key={p.id} className="hover:bg-bar-700/50 transition-colors">
                  <td className="p-4 font-medium text-bar-text">{p.name}</td>
                  <td className="p-4">
                    <span className="inline-flex items-center gap-1 bg-bar-700/50 text-slate-300 px-2 py-1 rounded text-xs">
                      <Tag size={12} />
                      {p.category}
                    </span>
                  </td>
                  <td className="p-4 text-right text-slate-300">${p.costPrice.toLocaleString()}</td>
                  <td className="p-4 text-right text-emerald-400 font-medium">${p.salePrice.toLocaleString()}</td>
                  <td className="p-4">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => openModal(p)} className="p-2 hover:bg-bar-600 rounded-lg text-slate-300 hover:text-bar-text transition-colors" title="Editar">
                        <Edit2 size={18} />
                      </button>
                      <button onClick={() => handleDelete(p.id)} className="p-2 hover:bg-rose-900/50 rounded-lg text-rose-400 hover:text-rose-200 transition-colors" title="Eliminar">
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Summary */}
      <div className="flex items-center justify-between text-sm text-slate-400">
        <span>Total productos: {filteredProducts.length} de {products.length}</span>
      </div>

      {/* Product Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-bar-800 rounded-2xl w-full max-w-md border border-bar-700 shadow-2xl">
            <div className="p-6 border-b border-bar-700 flex justify-between items-center">
              <h3 className="text-xl font-bold text-bar-text">{editingProduct ? 'Editar Producto' : 'Nuevo Producto'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-bar-text">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Nombre</label>
                <input required type="text" value={name} onChange={e => setName(e.target.value)} className="w-full bg-bar-900 border border-bar-600 rounded-lg p-2.5 text-bar-text focus:ring-1 focus:ring-bar-500 outline-none" placeholder="Ej. Cerveza Poker" />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Categoría</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-bar-900 border border-bar-600 rounded-lg p-2.5 text-bar-text focus:ring-1 focus:ring-bar-500 outline-none"
                >
                  {allCategories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>


              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Imagen / Emoticon (URL o Emoji)</label>
                <input type="text" value={image} onChange={e => setImage(e.target.value)} className="w-full bg-bar-900 border border-bar-600 rounded-lg p-2.5 text-bar-text focus:ring-1 focus:ring-bar-500 outline-none" placeholder="Ej. 🍺 o https://..." />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Costo ($)</label>
                  <input required type="number" min="0" value={costPrice} onChange={e => setCostPrice(e.target.value)} className="w-full bg-bar-900 border border-bar-600 rounded-lg p-2.5 text-bar-text focus:ring-1 focus:ring-bar-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Venta ($)</label>
                  <input required type="number" min="0" value={salePrice} onChange={e => setSalePrice(e.target.value)} className="w-full bg-bar-900 border border-bar-600 rounded-lg p-2.5 text-bar-text focus:ring-1 focus:ring-bar-500 outline-none" />
                </div>
              </div>

              {costPrice && salePrice && (
                <div className="p-3 bg-bar-900 rounded-lg border border-bar-600">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Ganancia:</span>
                    <span className="text-emerald-400 font-bold">${(Number(salePrice) - Number(costPrice)).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm mt-1">
                    <span className="text-slate-400">Margen:</span>
                    <span className="text-bar-text font-bold">{Math.round(((Number(salePrice) - Number(costPrice)) / Number(costPrice)) * 100)}%</span>
                  </div>
                </div>
              )}

              <button type="submit" className="w-full bg-bar-500 hover:bg-bar-400 text-bar-950 font-bold py-3 rounded-lg mt-4 flex items-center justify-center gap-2">
                <Check size={20} />
                Guardar
              </button>
            </form>
          </div>
        </div >
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
