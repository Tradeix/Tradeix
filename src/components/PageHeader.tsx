'use client'

import Icon from '@/components/Icon'

interface PageHeaderProps {
  title: string
  subtitle?: string
  icon?: string
  action?: React.ReactNode
}

export default function PageHeader({ title, subtitle, icon, action }: PageHeaderProps) {
  return (
    <div className="page-header-row section-anim" style={{
      display: 'flex', justifyContent: 'space-between',
      alignItems: 'center', marginBottom: '28px',
      gap: '12px',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', minWidth: 0 }}>
        {icon && (
          <div style={{
            width: '42px', height: '42px', borderRadius: '12px',
            background: 'var(--bg3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Icon name={icon} size={20} color="#10b981" />
          </div>
        )}
        <div style={{ minWidth: 0 }}>
          <h2 className="page-header-title" style={{
            fontSize: '24px', fontWeight: '600',
            letterSpacing: '-0.02em', lineHeight: 1.15, margin: 0,
            color: 'var(--text)',
            fontFamily: 'Heebo, sans-serif',
          }}>{title}</h2>
          {subtitle && (
            <p style={{
              fontSize: '15px', fontWeight: '500', color: 'var(--text3)',
              margin: '6px 0 0', lineHeight: 1.45,
              fontFamily: 'Heebo, sans-serif',
            }}>{subtitle}</p>
          )}
        </div>
      </div>

      {action && <div style={{ flexShrink: 0 }}>{action}</div>}

      <style>{`
        @media (max-width: 640px) {
          .page-header-row { gap: 12px !important; margin-bottom: 20px !important; }
          .page-header-row .page-header-title { font-size: 20px !important; }
          .page-header-row > div:first-child > div:first-child { width: 36px !important; height: 36px !important; }
        }
      `}</style>
    </div>
  )
}
