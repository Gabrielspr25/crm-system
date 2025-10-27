
import React from 'react';
import { Salesperson } from '../types';

interface SalespeoplePageProps {
  salespeople: Salesperson[];
}

const SalespeoplePage: React.FC<SalespeoplePageProps> = ({ salespeople }) => {
  return (
    <div>
      <h1 className="text-3xl font-bold text-text-primary mb-6">Vendedores</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {salespeople.map(person => (
          <div key={person.id} className="bg-secondary p-6 rounded-lg shadow-lg text-center flex flex-col items-center">
            <img 
              src={person.avatar} 
              alt={person.name}
              className="w-24 h-24 rounded-full mb-4 border-4 border-tertiary object-cover"
            />
            <h2 className="text-lg font-bold text-text-primary">{person.name}</h2>
            <p className="text-sm text-accent">{person.email}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SalespeoplePage;
