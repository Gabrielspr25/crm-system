'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      })

      const data = await response.json()

      if (data.success) {
        localStorage.setItem('token', data.data.token)
        router.push('/')
      } else {
        setError(data.message || 'Error al iniciar sesión')
      }
    } catch (error) {
      setError('Error al conectar con el servidor')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-dark-900 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h1 className="text-center text-3xl font-bold text-white">CRM System</h1>
          <h2 className="mt-6 text-center text-xl text-gray-300">
            Inicia sesión en tu cuenta
          </h2>
        </div>
        
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="card p-6">
            <div className="space-y-4">
              <Input
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.com"
                required
              />
              
              <Input
                label="Contraseña"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>
            
            {error && (
              <div className="mt-4 p-3 bg-danger-900/20 border border-danger-800 rounded-lg">
                <p className="text-danger-400 text-sm">{error}</p>
              </div>
            )}
            
            <div className="mt-6">
              <Button
                type="submit"
                loading={loading}
                className="w-full"
              >
                {loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
              </Button>
            </div>
          </div>
        </form>
        
        <div className="text-center">
          <p className="text-gray-400 text-sm">
            ¿No tienes una cuenta?{' '}
            <a href="/register" className="text-primary-400 hover:text-primary-300">
              Regístrate
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
