import { Product } from '../types';
import { getProducts, saveProduct, deleteProduct } from './db';

export { getProducts };

/**
 * Product Service - Capa de abstracción para operaciones de productos
 */

/**
 * Obtiene todos los productos activos
 */
export const getActiveProducts = async (): Promise<Product[]> => {
  const products = await getProducts();
  return products.filter(p => p.active);
};

/**
 * Obtiene productos por categoría
 */
export const getProductsByCategory = async (category: string): Promise<Product[]> => {
  const products = await getProducts();
  return products.filter(p => p.category === category && p.active);
};

/**
 * Obtiene todas las categorías únicas
 */
export const getCategories = async (): Promise<string[]> => {
  const products = await getProducts();
  const categories = new Set(products.map(p => p.category));
  return Array.from(categories).sort();
};

/**
 * Busca productos por nombre
 */
export const searchProducts = async (query: string): Promise<Product[]> => {
  const products = await getProducts();
  const lowerQuery = query.toLowerCase();
  return products.filter(p =>
    p.active && (
      p.name.toLowerCase().includes(lowerQuery) ||
      p.category.toLowerCase().includes(lowerQuery)
    )
  );
};

/**
 * Obtiene un producto por ID
 */
export const getProductById = async (id: string): Promise<Product | null> => {
  const products = await getProducts();
  return products.find(p => p.id === id) || null;
};

/**
 * Alterna el estado activo de un producto
 */
export const toggleProductActive = async (id: string): Promise<Product | null> => {
  const products = await getProducts();
  const index = products.findIndex(p => p.id === id);

  if (index === -1) return null;

  products[index] = { ...products[index], active: !products[index].active };
  await saveProduct(products[index]);
  return products[index];
};

/**
 * Actualiza el precio de un producto
 */
export const updateProductPrice = async (id: string, salePrice: number, costPrice?: number): Promise<Product | null> => {
  const products = await getProducts();
  const index = products.findIndex(p => p.id === id);

  if (index === -1) return null;

  products[index] = {
    ...products[index],
    salePrice,
    costPrice: costPrice ?? products[index].costPrice
  };
  await saveProduct(products[index]);
  return products[index];
};

/**
 * Obtiene el margen de ganancia de un producto
 */
export const getProductMargin = (product: Product): number => {
  if (product.costPrice === 0) return 100;
  return ((product.salePrice - product.costPrice) / product.costPrice) * 100;
};

/**
 * Obtiene productos con bajo margen de ganancia
 */
export const getLowMarginProducts = async (thresholdPercent: number = 10): Promise<Product[]> => {
  const products = await getProducts();
  return products.filter(p => {
    const margin = getProductMargin(p);
    return p.active && margin < thresholdPercent;
  });
};

/**
 * Valida datos de producto antes de guardar
 */
export const validateProduct = (product: Partial<Product>): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (!product.name || product.name.trim().length === 0) {
    errors.push('El nombre del producto es obligatorio');
  }

  if (product.salePrice === undefined || product.salePrice < 0) {
    errors.push('El precio de venta debe ser mayor o igual a 0');
  }

  if (product.costPrice === undefined || product.costPrice < 0) {
    errors.push('El precio de costo debe ser mayor o igual a 0');
  }

  if (product.costPrice > product.salePrice) {
    errors.push('El precio de costo no puede ser mayor al precio de venta');
  }

  if (!product.category || product.category.trim().length === 0) {
    errors.push('La categoría es obligatoria');
  }

  return { valid: errors.length === 0, errors };
};
