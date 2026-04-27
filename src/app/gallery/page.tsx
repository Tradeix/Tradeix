'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useDropzone } from 'react-dropzone'
import toast from 'react-hot-toast'
import PageHeader from '@/components/PageHeader'
import Icon from '@/components/Icon'
import { useApp } from '@/lib/app-context'
import { usePortfolio } from '@/lib/portfolio-context'

const PAGE_SIZE = 6
const LOAD_MORE_SIZE = 3

interface GalleryItem {
  id: string
  user_id: string
  title: string
  description: string | null
  image_url: string
  category: string | null
  created_at: string
}

const CATEGORIES = (lang: 'he' | 'en') => [
  { id: 'payouts', label: lang === 'he' ? 'תשלומים' : 'Payouts', icon: 'payments' },
  { id: 'credentials', label: lang === 'he' ? 'פרטי גישה' : 'Credentials', icon: 'key' },
  { id: 'screenshots', label: lang === 'he' ? 'צילומי מסך' : 'Screenshots', icon: 'screenshot_monitor' },
  { id: 'certificates', label: lang === 'he' ? 'תעודות מבחן' : 'Certificates', icon: 'workspace_premium' },
]

export default function GalleryPage() {
  const { language } = useApp()
  const { activePortfolio, portfolios } = usePortfolio()
  const isRTL = language === 'he'
  const supabase = createClient()
  const cats = CATEGORIES(language)

  const [items, setItems] = useState<GalleryItem[]>([])
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [loading, setLoading] = useState(true)
  const [showUpload, setShowUpload] = useState(false)
  const [lightbox, setLightbox] = useState<GalleryItem | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  // Upload form
  const [form, setForm] = useState({ title: '', description: '', category: 'payouts' })
  const [pickedFile, setPickedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    const { data, error } = await supabase
      .from('gallery_items')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    if (!error && data) setItems(data)
    setLoading(false)
  }

  const onDrop = useCallback((files: File[]) => {
    const f = files[0]
    if (!f) return
    setPickedFile(f)
    setPreviewUrl(URL.createObjectURL(f))
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.webp', '.gif'] },
    maxFiles: 1, maxSize: 15 * 1024 * 1024,
  })

  function resetForm() {
    setForm({ title: '', description: '', category: 'payouts' })
    setPickedFile(null)
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
  }

  async function handleUpload() {
    if (!pickedFile) {
      toast.error(language === 'he' ? 'נא לבחור תמונה' : 'Please pick an image')
      return
    }
    if (!form.title.trim()) {
      toast.error(language === 'he' ? 'נא להזין כותרת' : 'Please enter a title')
      return
    }
    setUploading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('not authenticated')
      const ext = pickedFile.name.split('.').pop() || 'png'
      const path = `${user.id}/gallery/${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from('trade-images').upload(path, pickedFile)
      if (upErr) throw upErr
      const { data: pub } = supabase.storage.from('trade-images').getPublicUrl(path)
      // The gallery is portfolio-agnostic by design. The legacy schema may
      // still have a NOT NULL on portfolio_id — if so, pin to the active
      // portfolio, then to the first non-archived one, then to any owned
      // portfolio (including archived) as a last resort. If the user owns
      // none, fall through with null (the DB drops the constraint after
      // running: ALTER TABLE gallery_items ALTER COLUMN portfolio_id DROP NOT NULL;).
      let portfolioId: string | null = activePortfolio?.id || portfolios[0]?.id || null
      if (!portfolioId) {
        const { data: anyPortfolio } = await supabase
          .from('portfolios').select('id').eq('user_id', user.id)
          .order('created_at', { ascending: true }).limit(1).maybeSingle()
        portfolioId = anyPortfolio?.id || null
      }
      const insertPayload: any = {
        user_id: user.id,
        title: form.title.trim(),
        description: form.description.trim() || null,
        category: form.category,
        image_url: pub.publicUrl,
      }
      if (portfolioId) insertPayload.portfolio_id = portfolioId
      const { error: insErr } = await supabase.from('gallery_items').insert(insertPayload)
      if (insErr) throw insErr
      toast.success(language === 'he' ? 'התמונה נוספה' : 'Image added')
      resetForm()
      setShowUpload(false)
      await load()
    } catch (err: any) {
      console.error('[gallery upload]', err)
      const msg = err?.message || (language === 'he' ? 'שגיאה בהעלאה' : 'Upload failed')
      toast.error(msg)
    } finally {
      setUploading(false)
    }
  }

  async function handleDelete(id: string) {
    const { error } = await supabase.from('gallery_items').delete().eq('id', id)
    if (error) {
      toast.error(language === 'he' ? 'שגיאה במחיקה' : 'Delete failed')
      return
    }
    toast.success(language === 'he' ? 'התמונה נמחקה' : 'Image deleted')
    setConfirmDelete(null)
    setItems(prev => prev.filter(i => i.id !== id))
  }

  const visible = items.slice(0, visibleCount)
  const hasMore = visibleCount < items.length

  const card: React.CSSProperties = {
    background: 'var(--bg2)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius)', overflow: 'hidden',
  }

  return (
    <div style={{ fontFamily: 'Heebo, sans-serif' }}>
      <PageHeader
        title={language === 'he' ? 'גלריה' : 'Gallery'}
        subtitle={language === 'he' ? 'תשלומים, צילומי מסך, תעודות ופרטי גישה' : 'Payouts, screenshots, certificates and credentials'}
        icon="photo_library"
        action={items.length > 0 ? (
          <button
            type="button"
            onClick={() => setShowUpload(true)}
            className="btn-press"
            style={{
              flexShrink: 0, background: '#0f8d63', color: '#fff', border: 'none',
              borderRadius: '12px', padding: '10px 20px', fontSize: '14px', fontWeight: '600',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
              fontFamily: 'Heebo, sans-serif',
            }}
          >
            <Icon name="add_a_photo" size={16} />
            {language === 'he' ? 'העלה תמונה' : 'Upload image'}
          </button>
        ) : undefined}
      />

      {/* Body */}
      {loading ? (
        <div style={{ padding: '64px', textAlign: 'center' }}>
          <div style={{ width: '32px', height: '32px', border: '2px solid var(--border)', borderTopColor: '#0f8d63', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto' }} />
        </div>
      ) : items.length === 0 ? (
        <div style={{ ...card, padding: '64px 24px', textAlign: 'center' }}>
          <div style={{ width: '72px', height: '72px', borderRadius: '20px', background: 'var(--bg3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px' }}>
            <Icon name="photo_library" size={32} color="var(--text3)" />
          </div>
          <div style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text)', marginBottom: '8px' }}>
            {language === 'he' ? 'הגלריה ריקה' : 'Gallery is empty'}
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text3)', marginBottom: '24px' }}>
            {language === 'he' ? 'העלה תמונות של תשלומים, צילומי מסך, תעודות ופרטי גישה' : 'Upload payouts, screenshots, certificates and credential images'}
          </div>
          <button
            onClick={() => setShowUpload(true)}
            style={{ background: '#0f8d63', color: '#fff', padding: '11px 24px', borderRadius: '12px', border: 'none', fontSize: '14px', fontWeight: '700', cursor: 'pointer', fontFamily: 'Heebo, sans-serif', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
          >
            <Icon name="add_a_photo" size={16} />
            {language === 'he' ? 'העלה תמונה' : 'Upload image'}
          </button>
        </div>
      ) : (
        <>
          <div className="gallery-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
            {visible.map((item, idx) => {
              const cat = cats.find(c => c.id === item.category)
              return (
                <div
                  key={item.id}
                  className="card-hover trade-row-anim"
                  onClick={() => setLightbox(item)}
                  style={{ ...card, cursor: 'pointer', position: 'relative', display: 'flex', flexDirection: 'column', animationDelay: `${idx * 0.05}s` }}
                >
                  <div style={{ position: 'relative', aspectRatio: '4 / 3', overflow: 'hidden', background: 'var(--bg3)' }}>
                    <img
                      src={item.image_url}
                      alt={item.title}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    />
                    {cat && (
                      <div style={{
                        position: 'absolute', top: '10px', insetInlineStart: '10px',
                        display: 'flex', alignItems: 'center', gap: '6px',
                        padding: '5px 10px', borderRadius: '8px',
                        background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)',
                        border: '1px solid rgba(255,255,255,0.1)',
                      }}>
                        <Icon name={cat.icon} size={13} color="rgba(255,255,255,0.85)" />
                        <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.85)', fontWeight: '700' }}>{cat.label}</span>
                      </div>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); setConfirmDelete(item.id) }}
                      title={language === 'he' ? 'מחק' : 'Delete'}
                      style={{
                        position: 'absolute', top: '10px', insetInlineEnd: '10px',
                        width: '30px', height: '30px', borderRadius: '8px',
                        background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        color: '#ef4444', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      <Icon name="delete" size={14} />
                    </button>
                  </div>
                  <div style={{ padding: '14px 16px' }}>
                    <div style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text)', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.title}
                    </div>
                    {item.description && (
                      <div style={{ fontSize: '12px', color: 'var(--text3)', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {item.description}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {hasMore && (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '24px' }}>
              <button
                onClick={() => setVisibleCount(c => c + LOAD_MORE_SIZE)}
                style={{
                  background: 'var(--bg2)', border: '1px solid var(--border)',
                  color: 'var(--text2)', padding: '12px 28px', borderRadius: '12px',
                  fontSize: '14px', fontWeight: '700', cursor: 'pointer',
                  fontFamily: 'Heebo, sans-serif',
                  display: 'inline-flex', alignItems: 'center', gap: '8px',
                  transition: 'all 0.15s',
                }}
                onMouseOver={e => { e.currentTarget.style.background = 'var(--bg3)'; e.currentTarget.style.color = 'var(--text)' }}
                onMouseOut={e => { e.currentTarget.style.background = 'var(--bg2)'; e.currentTarget.style.color = 'var(--text2)' }}
              >
                <Icon name="expand_more" size={16} />
                {language === 'he' ? 'טען עוד' : 'Load more'}
              </button>
            </div>
          )}
        </>
      )}

      {/* ── UPLOAD MODAL ── */}
      {showUpload && (
        <div className="app-modal-overlay" onClick={() => { if (!uploading) { setShowUpload(false); resetForm() } }} style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }}>
          <div className="app-modal-card" data-tight="1" onClick={e => e.stopPropagation()} dir={isRTL ? 'rtl' : 'ltr'} style={{ width: '100%', maxWidth: '480px', background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: '20px', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <div style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text)' }}>
                {language === 'he' ? 'העלאת תמונה' : 'Upload image'}
              </div>
              <button onClick={() => { setShowUpload(false); resetForm() }} disabled={uploading} style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text3)', cursor: 'pointer', fontSize: '15px' }}>✕</button>
            </div>

            {/* Dropzone / preview */}
            {previewUrl ? (
              <div style={{ position: 'relative', marginBottom: '14px', borderRadius: '14px', overflow: 'hidden', border: '1px solid var(--border)' }}>
                <img src={previewUrl} alt="" style={{ width: '100%', maxHeight: '260px', objectFit: 'cover', display: 'block' }} />
                <button
                  onClick={() => { setPickedFile(null); URL.revokeObjectURL(previewUrl); setPreviewUrl(null) }}
                  style={{ position: 'absolute', top: '10px', insetInlineEnd: '10px', width: '30px', height: '30px', borderRadius: '8px', background: 'rgba(0,0,0,0.6)', color: '#fff', border: '1px solid rgba(255,255,255,0.15)', cursor: 'pointer', fontSize: '14px' }}
                >✕</button>
              </div>
            ) : (
              <div {...getRootProps()} style={{ border: `2px dashed ${isDragActive ? '#0f8d63' : 'var(--border2)'}`, borderRadius: '14px', padding: '32px 20px', textAlign: 'center', cursor: 'pointer', background: isDragActive ? 'rgba(15,141,99,0.06)' : 'var(--bg3)', transition: 'all 0.2s', marginBottom: '14px' }}>
                <input {...getInputProps()} />
                <Icon name="add_photo_alternate" size={32} color="var(--text3)" />
                <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text2)', marginTop: '8px' }}>
                  {language === 'he' ? 'גרור תמונה לכאן או לחץ לבחירה' : 'Drop an image here or click to pick'}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '4px' }}>PNG · JPG · WEBP · GIF · ≤ 15MB</div>
              </div>
            )}

            {/* Title */}
            <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '6px' }}>
              {language === 'he' ? 'כותרת' : 'Title'}
            </label>
            <input
              type="text" value={form.title}
              onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
              placeholder={language === 'he' ? 'לדוגמה: Payout Apex 5K' : 'e.g. Apex 5K Payout'}
              style={{ marginBottom: '14px' }}
            />

            {/* Description */}
            <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '6px' }}>
              {language === 'he' ? 'פירוט' : 'Description'}
            </label>
            <textarea
              value={form.description}
              onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              rows={2}
              placeholder={language === 'he' ? 'תיאור קצר על התמונה' : 'Short description'}
              style={{ marginBottom: '14px', resize: 'vertical' }}
            />

            {/* Category */}
            <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>
              {language === 'he' ? 'קטגוריה' : 'Category'}
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', marginBottom: '20px' }}>
              {cats.map(c => {
                const active = form.category === c.id
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setForm(p => ({ ...p, category: c.id }))}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '8px',
                      padding: '10px 12px', borderRadius: '10px',
                      background: active ? 'rgba(15,141,99,0.12)' : 'var(--bg3)',
                      border: `1px solid ${active ? 'rgba(15,141,99,0.35)' : 'var(--border)'}`,
                      color: active ? '#0f8d63' : 'var(--text2)',
                      cursor: 'pointer', fontSize: '13px', fontWeight: '700',
                      fontFamily: 'Heebo, sans-serif', transition: 'all 0.15s',
                    }}
                  >
                    <Icon name={c.icon} size={15} color="currentColor" />
                    {c.label}
                  </button>
                )
              })}
            </div>

            <button
              onClick={handleUpload}
              disabled={uploading || !pickedFile || !form.title.trim()}
              style={{
                width: '100%', background: '#0f8d63', color: '#fff', border: 'none',
                borderRadius: '12px', padding: '12px', fontSize: '14px', fontWeight: '700',
                cursor: (uploading || !pickedFile || !form.title.trim()) ? 'not-allowed' : 'pointer',
                opacity: (uploading || !pickedFile || !form.title.trim()) ? 0.6 : 1,
                fontFamily: 'Heebo, sans-serif',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              }}
            >
              {uploading ? (
                <div style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              ) : <Icon name="cloud_upload" size={16} color="#fff" />}
              {uploading ? (language === 'he' ? 'מעלה...' : 'Uploading...') : (language === 'he' ? 'העלה' : 'Upload')}
            </button>
          </div>
        </div>
      )}

      {/* ── LIGHTBOX ── */}
      {lightbox && (
        <div className="app-modal-overlay app-modal-overlay--top2" onClick={() => setLightbox(null)} style={{ background: 'rgba(0,0,0,0.95)', flexDirection: 'column' as any, padding: '24px' }}>
          <button
            onClick={(e) => { e.stopPropagation(); setLightbox(null) }}
            style={{ position: 'fixed', top: '20px', insetInlineEnd: '20px', width: '42px', height: '42px', borderRadius: '12px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', cursor: 'pointer', fontSize: '17px', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 401 }}
          >✕</button>

          <div onClick={e => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', maxWidth: '95vw', maxHeight: '95vh' }}>
            <img
              src={lightbox.image_url}
              alt={lightbox.title}
              style={{ maxWidth: '95vw', maxHeight: '78vh', objectFit: 'contain', borderRadius: '14px', boxShadow: '0 32px 80px rgba(0,0,0,0.6)' }}
            />
            <div dir={isRTL ? 'rtl' : 'ltr'} style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '14px', padding: '14px 20px', maxWidth: '720px', textAlign: 'center' }}>
              <div style={{ fontSize: '17px', fontWeight: '800', color: '#fff', marginBottom: lightbox.description ? '6px' : 0 }}>
                {lightbox.title}
              </div>
              {lightbox.description && (
                <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)', lineHeight: 1.5 }}>
                  {lightbox.description}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── DELETE CONFIRM ── */}
      {confirmDelete && (
        <div className="app-modal-overlay app-modal-overlay--top" onClick={() => setConfirmDelete(null)} style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }}>
          <div className="app-modal-card" data-tight="1" onClick={e => e.stopPropagation()} dir={isRTL ? 'rtl' : 'ltr'} style={{ background: 'var(--bg2)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '20px', padding: '28px', maxWidth: '380px', width: '100%', textAlign: 'center' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <Icon name="delete_forever" size={28} color="#ef4444" />
            </div>
            <div style={{ fontSize: '17px', fontWeight: '900', color: 'var(--text)', marginBottom: '8px' }}>
              {language === 'he' ? 'למחוק את התמונה?' : 'Delete this image?'}
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text3)', marginBottom: '20px' }}>
              {language === 'he' ? 'הפעולה אינה הפיכה' : 'This cannot be undone'}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => handleDelete(confirmDelete)} style={{ flex: 1, background: '#ef4444', color: '#fff', border: 'none', borderRadius: '12px', padding: '12px', fontSize: '14px', fontWeight: '800', cursor: 'pointer', fontFamily: 'Heebo, sans-serif' }}>
                {language === 'he' ? 'מחק' : 'Delete'}
              </button>
              <button onClick={() => setConfirmDelete(null)} style={{ flex: 1, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '12px', padding: '12px', fontSize: '14px', fontWeight: '700', color: 'var(--text2)', cursor: 'pointer', fontFamily: 'Heebo, sans-serif' }}>
                {language === 'he' ? 'ביטול' : 'Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @media (max-width: 1024px) { .gallery-grid { grid-template-columns: repeat(2, 1fr) !important; } }
        @media (max-width: 640px)  { .gallery-grid { grid-template-columns: 1fr !important; } }
      `}</style>
    </div>
  )
}
