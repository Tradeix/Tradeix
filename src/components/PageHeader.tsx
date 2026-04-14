'use client'

interface PageHeaderProps {
  title: string
  subtitle?: string
  icon?: string
  action?: React.ReactNode
}

export default function PageHeader({ title, subtitle, icon, action }: PageHeaderProps) {
  return (
    <div className="page-header-row" style={{
      display: 'flex', justifyContent: 'space-between',
      alignItems: 'flex-end', marginBottom: '32px',
      position: 'relative', flexWrap: 'wrap', gap: '12px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        {icon && (
          <div style={{
            width: '48px', height: '48px', borderRadius: '14px',
            background: 'linear-gradient(135deg, rgba(74,127,255,0.15), rgba(139,92,246,0.15))',
            border: '1px solid rgba(74,127,255,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 20px rgba(74,127,255,0.1)',
          }}>
            <span className="material-symbols-outlined" style={{
              fontSize: '22px', color: '#4a7fff',
              fontVariationSettings: "'FILL' 0, 'wght' 100, 'GRAD' -25, 'opsz' 20",
            }}>{icon}</span>
          </div>
        )}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
            <h2 className="page-header-title" style={{
              fontSize: '28px', fontWeight: '900',
              letterSpacing: '-0.02em', margin: 0,
              color: 'var(--text)',
              fontFamily: 'Heebo, sans-serif',
            }}>{title}</h2>
            {/* Decorative dots */}
            <div style={{ display: 'flex', gap: '4px', alignItems: 'center', paddingBottom: '2px' }}>
              <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#4a7fff', boxShadow: '0 0 6px #4a7fff' }} />
              <div style={{ width: '3px', height: '3px', borderRadius: '50%', background: '#8b5cf6', opacity: 0.6 }} />
              <div style={{ width: '2px', height: '2px', borderRadius: '50%', background: '#4a7fff', opacity: 0.3 }} />
            </div>
          </div>
          {subtitle && (
            <p style={{
              fontSize: '11px', fontWeight: '700', color: 'var(--text3)',
              textTransform: 'uppercase', letterSpacing: '0.2em', margin: 0,
              fontFamily: 'Heebo, sans-serif',
            }}>{subtitle}</p>
          )}
          {/* Underline */}
          <div style={{
            marginTop: '6px', display: 'flex', alignItems: 'center', gap: '4px',
          }}>
            <div style={{ width: '40px', height: '3px', background: 'linear-gradient(90deg, #4a7fff, #8b5cf6)', borderRadius: '999px' }} />
            <div style={{ width: '8px', height: '3px', background: 'rgba(74,127,255,0.3)', borderRadius: '999px' }} />
            <div style={{ width: '4px', height: '3px', background: 'rgba(74,127,255,0.15)', borderRadius: '999px' }} />
          </div>
        </div>
      </div>

      {action && <div>{action}</div>}
    </div>
  )
}
