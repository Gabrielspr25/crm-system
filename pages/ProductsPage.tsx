

import React, { useState, useMemo } from 'react';
import { Product, Category } from '../types';
import TagIcon from '../components/icons/TagIcon';
import CubeIcon from '../components/icons/CubeIcon';
import PlusIcon from '../components/icons/PlusIcon';
import PencilIcon from '../components/icons/PencilIcon';
import TrashIcon from '../components/icons/TrashIcon';
import ProductModal from '../components/ProductModal';
import CategoryModal from '../components/CategoryModal';
import { CrmDataHook } from '../hooks/useCrmData';
import TargetIcon from '../components/icons/TargetIcon';

const TabButton: React.FC<{
  label: string;
  icon: React.ReactNode;
  isActive: boolean;
  onClick: () => void;
}> = ({ label, icon, isActive, onClick }) => {
  const activeClasses = 'border-accent text-accent';
  const inactiveClasses = 'border-transparent text-text-secondary hover:text-text-primary hover:border-slate-600';

  return (
    <button
      onClick={onClick}
      className={`flex items-center space-x-2 px-4 py-3 text-sm font-medium border-b-2 transition-all duration-200 focus:outline-none ${isActive ? activeClasses : inactiveClasses}`}
      aria-pressed={isActive}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
};

const ProductsPage: React.FC<{ crmData: CrmDataHook }> = ({ crmData }) => {
  const { products, categories, deleteProduct, deleteCategory } = crmData;
  const [activeTab, setActiveTab] = useState<'productos' | 'categorias'>('productos');
  
  const [isProductModalOpen, setProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  
  const [isCategoryModalOpen, setCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  const categoryMap = useMemo(() => 
    categories.reduce((acc, cat) => {
        acc[cat.id] = cat.name;
        return acc;
    }, {} as Record<string, string>), [categories]);

  const categoryCounts = useMemo(() => {
    const counts: { [key: string]: number } = {};
    products.forEach(product => {
      counts[product.categoryId] = (counts[product.categoryId] || 0) + 1;
    });
    return counts;
  }, [products]);
  
  const handleAddNewProduct = () => {
    setEditingProduct(null);
    setProductModalOpen(true);
  }

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    setProductModalOpen(true);
  }
  
  const handleDeleteProduct = (productId: string) => {
    if (window.confirm('¿Está seguro de que desea eliminar este producto?')) {
        deleteProduct(productId);
    }
  }

  const handleAddNewCategory = () => {
    setEditingCategory(null);
    setCategoryModalOpen(true);
  }

  const handleEditCategory = (category: Category) => {
    setEditingCategory(category);
    setCategoryModalOpen(true);
  }
  
  const handleDeleteCategory = (categoryId: string) => {
    if (window.confirm('¿Está seguro de que desea eliminar esta categoría?')) {
        deleteCategory(categoryId);
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-text-primary">Productos</h1>
         <button
            onClick={activeTab === 'productos' ? handleAddNewProduct : handleAddNewCategory}
            className="flex items-center bg-accent text-primary font-bold py-2 px-4 rounded-lg hover:bg-sky-300 transition-colors"
        >
            <PlusIcon />
            <span className="ml-2">{activeTab === 'productos' ? 'Añadir Producto' : 'Añadir Categoría'}</span>
        </button>
      </div>
      
      <div className="flex border-b border-tertiary mb-6">
        <TabButton label="Productos" icon={<CubeIcon />} isActive={activeTab === 'productos'} onClick={() => setActiveTab('productos')} />
        <TabButton label="Categorías" icon={<TagIcon />} isActive={activeTab === 'categorias'} onClick={() => setActiveTab('categorias')} />
      </div>

      <div role="tabpanel">
        {activeTab === 'productos' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in">
            {products.map(product => (
              <div key={product.id} className="bg-secondary p-6 rounded-lg shadow-lg flex flex-col justify-between group record-item">
                <div>
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-xs text-accent font-semibold uppercase">{categoryMap[product.categoryId] || 'Sin categoría'}</p>
                            <h2 className="text-xl font-bold text-text-primary mt-1">{product.name}</h2>
                        </div>
                        <p className="text-2xl font-light text-text-primary">${product.price.toFixed(2)}</p>
                    </div>
                     <div className="flex items-center text-text-secondary mt-2">
                        <TargetIcon className="w-5 h-5 mr-2" />
                        <span className="text-sm">Meta Mensual:</span>
                        <span className="text-sm font-semibold text-text-primary ml-1">${(product.monthlyGoal || 0).toLocaleString()}</span>
                    </div>
                </div>
                <div className="border-t border-tertiary mt-4 pt-4 flex justify-end space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => handleEditProduct(product)} className="text-accent hover:text-sky-300 p-2"><PencilIcon /></button>
                    <button onClick={() => handleDeleteProduct(product.id)} className="text-red-500 hover:text-red-400 p-2"><TrashIcon /></button>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'categorias' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-fade-in">
            {categories.map(category => (
              <div key={category.id} className="bg-secondary p-6 rounded-lg shadow-lg group record-item">
                  <div className="flex items-center space-x-4">
                    <div className="bg-tertiary p-3 rounded-full text-accent"><TagIcon /></div>
                    <div>
                        <h2 className="text-xl font-bold text-text-primary">{category.name}</h2>
                        <p className="text-text-secondary">{categoryCounts[category.id] || 0} {(categoryCounts[category.id] || 0) === 1 ? 'producto' : 'productos'}</p>
                    </div>
                  </div>
                   <div className="border-t border-tertiary mt-4 pt-4 flex justify-end space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => handleEditCategory(category)} className="text-accent hover:text-sky-300 p-2"><PencilIcon /></button>
                        <button onClick={() => handleDeleteCategory(category.id)} className="text-red-500 hover:text-red-400 p-2"><TrashIcon /></button>
                    </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {isProductModalOpen && <ProductModal isOpen={isProductModalOpen} onClose={() => setProductModalOpen(false)} product={editingProduct} crmData={crmData} />}
      {isCategoryModalOpen && <CategoryModal isOpen={isCategoryModalOpen} onClose={() => setCategoryModalOpen(false)} category={editingCategory} addCategory={crmData.addCategory} updateCategory={crmData.updateCategory} />}

      <style>{`
        @keyframes fade-in {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
            animation: fade-in 0.3s ease-out forwards;
        }
      `}</style>
    </div>
  );
};

export default ProductsPage;