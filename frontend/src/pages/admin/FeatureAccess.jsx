import React, { useState, useEffect } from 'react'
import { coreApi } from '../../api'
import { MASTER_NAV_CONFIG } from '../../config/features'
import { LoadingState } from '../../components/shared'
import toast from 'react-hot-toast'
import { Search, Sliders } from 'lucide-react'

const ROLES = ['MANAGER', 'ACCOUNTANT', 'HR', 'DATA_ENTRY', 'SOCIAL_MEDIA']

export default function FeatureAccess() {
  const [mappings, setMappings] = useState({})
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('ALL')

  const fetchAssignments = async () => {
    try {
      const res = await coreApi.features.listAllFeatures()
      setMappings(res.data || {})
    } catch (err) {
      toast.error('Failed to load feature assignments')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAssignments()
  }, [])

  const handleToggle = async (featureKey, role) => {
    const currentRoles = mappings[featureKey] || []
    let newRoles = [...currentRoles]
    
    if (newRoles.includes(role)) {
      newRoles = newRoles.filter(r => r !== role)
    } else {
      newRoles.push(role)
    }

    // Optimistic update
    setMappings(prev => ({ ...prev, [featureKey]: newRoles }))

    try {
      await coreApi.features.updateFeatureRoles({ feature_key: featureKey, roles: newRoles })
      toast.success('Permissions updated')
    } catch (err) {
      toast.error('Failed to update permissions')
      fetchAssignments() // revert on error
    }
  }

  // Get distinct categories
  const categories = ['ALL', 'SOCIAL MEDIA DASHBOARD', 'MANAGER CORE', 'FINANCE & DONATIONS', 'TIME & PAYROLL', 'DIRECTORY', 'STOCK MANAGEMENT', 'PEOPLE & RELATIONS', 'SHARED FEATURES']

  // Group features by category for display
  const groupedFeatures = {}
  MASTER_NAV_CONFIG.forEach(item => {
    if (!item.key) return

    // Category filter
    if (selectedCategory !== 'ALL' && item.category !== selectedCategory) return

    // Search filter
    const matchesSearch = !searchQuery || 
      item.label.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (item.category && item.category.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (item.subCategory && item.subCategory.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (item.path && item.path.toLowerCase().includes(searchQuery.toLowerCase()));
      
    if (!matchesSearch) return

    const cat = item.category || 'OTHER'
    if (!groupedFeatures[cat]) groupedFeatures[cat] = []
    groupedFeatures[cat].push(item)
  })

  if (loading) return <LoadingState />

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--gray-900, #111827)', margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Sliders size={22} color="var(--primary-600, #2563EB)" />
            Feature Access Control
          </h1>
          <p style={{ color: 'var(--gray-600, #6B7280)', marginTop: 4, fontSize: 13 }}>
            Configure and toggle which features and social modules are enabled for each staff role.
          </p>
        </div>

        <div style={{ position: 'relative' }}>
          <Search size={15} color="var(--gray-400, #9CA3AF)" style={{ position: 'absolute', left: 12, top: 12 }} />
          <input 
            type="text" 
            placeholder="Search all features..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              padding: '9px 14px 9px 36px',
              borderRadius: '8px',
              border: '1px solid var(--gray-300, #D1D5DB)',
              width: '260px',
              fontSize: '13px',
              outline: 'none',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
            }}
          />
        </div>
      </div>

      {/* Category Filter Tabs */}
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
        {categories.map(cat => {
          const isSelected = selectedCategory === cat
          const count = cat === 'ALL' 
            ? MASTER_NAV_CONFIG.filter(i => !!i.key).length
            : MASTER_NAV_CONFIG.filter(i => !!i.key && i.category === cat).length

          if (count === 0 && cat !== 'ALL') return null

          return (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`btn btn-xs ${isSelected ? 'btn-primary' : 'btn-secondary'}`}
              style={{
                borderRadius: 20,
                padding: '6px 14px',
                fontSize: 12,
                fontWeight: isSelected ? 600 : 500,
                whiteSpace: 'nowrap'
              }}
            >
              {cat === 'SOCIAL MEDIA DASHBOARD' ? '📱 Social Media (11 Features)' : cat} ({count})
            </button>
          )
        })}
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden', border: '1px solid var(--gray-200, #E5E7EB)' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: 700 }}>
            <thead>
              <tr style={{ background: '#F9FAFB', borderBottom: '2px solid #E5E7EB' }}>
                <th style={{ padding: '14px 20px', fontWeight: 600, color: '#374151', fontSize: 13 }}>Feature Module</th>
                {ROLES.map(r => (
                  <th key={r} style={{ padding: '14px 16px', fontWeight: 600, color: '#374151', textAlign: 'center', width: 130, fontSize: 12 }}>
                    {r}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.keys(groupedFeatures).length === 0 ? (
                <tr>
                  <td colSpan={ROLES.length + 1} style={{ padding: 32, textAlign: 'center', color: '#6B7280' }}>
                    No features match your query.
                  </td>
                </tr>
              ) : (
                Object.entries(groupedFeatures).map(([category, items]) => (
                  <React.Fragment key={category}>
                    <tr>
                      <td colSpan={ROLES.length + 1} style={{ background: '#F1F5F9', padding: '10px 20px', fontSize: 12, fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: 0.8 }}>
                        {category} ({items.length})
                      </td>
                    </tr>
                    {items.map(item => {
                      const featureRoles = mappings[item.key] || []
                      
                      return (
                        <tr key={item.key} style={{ borderBottom: '1px solid #F1F5F9' }}>
                          <td style={{ padding: '14px 20px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                              <span style={{ fontSize: 18, width: 24, textAlign: 'center' }}>{item.icon}</span>
                              <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <span style={{ fontWeight: 600, color: '#0F172A', fontSize: 13 }}>{item.label}</span>
                                  {item.subCategory && (
                                    <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: '#EFF6FF', color: '#1D4ED8', fontWeight: 600, border: '1px solid #DBEAFE' }}>
                                      {item.subCategory}
                                    </span>
                                  )}
                                </div>
                                <div style={{ fontSize: 11, color: '#64748B', marginTop: 2, fontFamily: 'monospace' }}>
                                  key: {item.key}
                                </div>
                              </div>
                            </div>
                          </td>
                          {ROLES.map(role => {
                            const isEnabled = featureRoles.includes(role)
                            return (
                              <td key={role} style={{ padding: '14px 16px', textAlign: 'center' }}>
                                <label style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }} title={`${isEnabled ? 'Disable' : 'Enable'} ${item.label} for ${role}`}>
                                  <div style={{
                                    position: 'relative', width: 42, height: 24, borderRadius: 12,
                                    background: isEnabled ? '#10B981' : '#E2E8F0',
                                    transition: 'background 0.2s',
                                  }}>
                                    <div style={{
                                      position: 'absolute', top: 2, left: 2, width: 20, height: 20, borderRadius: 10, background: 'white',
                                      transform: `translateX(${isEnabled ? 18 : 0}px)`, transition: 'transform 0.2s',
                                      boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                                    }} />
                                  </div>
                                  <input 
                                    type="checkbox" 
                                    checked={isEnabled} 
                                    onChange={() => handleToggle(item.key, role)} 
                                    style={{ display: 'none' }}
                                  />
                                </label>
                              </td>
                            )
                          })}
                        </tr>
                      )
                    })}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
