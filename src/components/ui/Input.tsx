import React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

const inputVariants = cva(
  'w-full bg-gray-800 text-white border border-gray-600 rounded-lg px-3 py-2 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none transition-colors duration-200 placeholder:text-gray-400',
  {
    variants: {
      variant: {
        default: '',
        error: 'border-danger-500 focus:border-danger-500 focus:ring-danger-500',
        success: 'border-success-500 focus:border-success-500 focus:ring-success-500',
      },
      size: {
        sm: 'px-2.5 py-1.5 text-sm',
        md: 'px-3 py-2 text-sm',
        lg: 'px-4 py-3 text-base',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  }
)

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'>,
    VariantProps<typeof inputVariants> {
  label?: string
  error?: string
  helperText?: string
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, variant, size, label, error, helperText, id, ...props }, ref) => {
    const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`
    
    return (
      <div className="w-full">
        {label && (
          <label 
            htmlFor={inputId} 
            className="block text-sm font-medium text-gray-300 mb-1"
          >
            {label}
          </label>
        )}
        
        <input
          id={inputId}
          className={inputVariants({ 
            variant: error ? 'error' : variant, 
            size, 
            className 
          })}
          ref={ref}
          {...props}
        />
        
        {(error || helperText) && (
          <p className={`mt-1 text-xs ${error ? 'text-danger-400' : 'text-gray-500'}`}>
            {error || helperText}
          </p>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'

export { Input, inputVariants }
