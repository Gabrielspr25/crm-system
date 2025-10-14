import React, { useState, useRef, useEffect } from 'react';

interface SelectOption {
  value: string;
  label: string;
  color: string;
  icon?: string;
}

interface SingleSelectDropdownProps {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

const SingleSelectDropdown: React.FC<SingleSelectDropdownProps> = ({
  value,
  options,
  onChange,
  placeholder = "Seleccionar...",
  disabled = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find(option => option.value === value);

  // Cerrar dropdown al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`w-full flex items-center justify-between px-3 py-2 text-sm border rounded-lg transition-colors ${
          disabled 
            ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
            : isOpen
            ? 'bg-white border-accent ring-2 ring-accent ring-opacity-20'
            : 'bg-white border-tertiary hover:border-accent focus:outline-none focus:ring-2 focus:ring-accent focus:ring-opacity-20'
        }`}
      >
        <div className="flex items-center space-x-2 flex-1 min-w-0">
          {selectedOption ? (
            <>
              {/* Color indicator */}
              <div 
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: selectedOption.color }}
              />
              {/* Icon (optional) */}
              {selectedOption.icon && (
                <span className="flex-shrink-0">{selectedOption.icon}</span>
              )}
              {/* Label */}
              <span className="text-text-primary font-medium truncate">
                {selectedOption.label}
              </span>
            </>
          ) : (
            <span className="text-text-secondary">{placeholder}</span>
          )}
        </div>
        
        {/* Dropdown arrow */}
        <svg 
          className={`w-4 h-4 text-text-secondary transition-transform ${
            isOpen ? 'transform rotate-180' : ''
          }`} 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-tertiary rounded-lg shadow-lg max-h-60 overflow-y-auto">
          <div className="py-1">
            {options.map((option) => {
              const isSelected = option.value === value;
              
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleSelect(option.value)}
                  className={`w-full flex items-center space-x-3 px-3 py-2 text-sm transition-colors ${
                    isSelected 
                      ? 'bg-accent bg-opacity-10 text-accent'
                      : 'text-text-primary hover:bg-tertiary'
                  }`}
                >
                  {/* Color indicator */}
                  <div 
                    className={`w-3 h-3 rounded-full flex-shrink-0 ${
                      isSelected ? 'ring-2 ring-accent ring-opacity-30' : ''
                    }`}
                    style={{ backgroundColor: option.color }}
                  />
                  
                  {/* Icon (optional) */}
                  {option.icon && (
                    <span className="flex-shrink-0">{option.icon}</span>
                  )}
                  
                  {/* Label */}
                  <span className={`flex-1 text-left truncate ${
                    isSelected ? 'font-medium' : ''
                  }`}>
                    {option.label}
                  </span>
                  
                  {/* Check mark for selected item */}
                  {isSelected && (
                    <svg 
                      className="w-4 h-4 text-accent flex-shrink-0" 
                      fill="currentColor" 
                      viewBox="0 0 20 20"
                    >
                      <path 
                        fillRule="evenodd" 
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" 
                        clipRule="evenodd" 
                      />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

// Predefined client states for the CRM
export const CLIENT_STATES: SelectOption[] = [
  {
    value: 'nuevo',
    label: 'Nuevo Prospecto',
    color: '#10B981', // Green
    icon: '🆕'
  },
  {
    value: 'contactado',
    label: 'Contactado',
    color: '#3B82F6', // Blue
    icon: '📞'
  },
  {
    value: 'interesado',
    label: 'Interesado',
    color: '#8B5CF6', // Purple
    icon: '👀'
  },
  {
    value: 'propuesta',
    label: 'Propuesta Enviada',
    color: '#F59E0B', // Amber
    icon: '📋'
  },
  {
    value: 'negociacion',
    label: 'En Negociación',
    color: '#EF4444', // Red
    icon: '🤝'
  },
  {
    value: 'seguimiento',
    label: 'En Seguimiento',
    color: '#06B6D4', // Cyan
    icon: '👁️'
  },
  {
    value: 'pausa',
    label: 'En Pausa',
    color: '#6B7280', // Gray
    icon: '⏸️'
  },
  {
    value: 'perdido',
    label: 'Cliente Perdido',
    color: '#DC2626', // Dark Red
    icon: '❌'
  }
];

export default SingleSelectDropdown;
