import React, { useState, useEffect } from 'react'
import { coreApi } from '../../api'
import { MASTER_NAV_CONFIG } from '../../config/features'
import { LoadingState } from '../../components/shared'
import toast from 'react-hot-toast'

const ROLES = ['MANAGER', 'ACCOUNTANT', 'HR', 'DATA_ENTRY']

export default function FeatureAccess() {
  const [mappings, setMappings] = useState({})
  const [loading, setLoading] = useState(true)

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

  // Group features by category for display
  const groupedFeatures = {}
  MASTER_NAV_CONFIG.forEach(item => {
    // Skip items that are strictly role-bound dashboards
    if (item.roles) return

    const cat = item.category || 'OTHER'
    if (!groupedFeatures[cat]) groupedFeatures[cat] = []
    groupedFeatures[cat].push(item)
  })

  if (loading) return <LoadingState />

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#111827', margin: 0 }}>Feature Access Control</h1>
        <p style={{ color: '#6B7280', marginTop: 4 }}>Configure which features are available to each role. Changes take effect on the user's next navigation.</p>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: 600 }}>
            <thead>
              <tr style={{ background: '#F9FAFB', borderBottom: '2px solid #E5E7EB' }}>
                <th style={{ padding: '16px 24px', fontWeight: 600, color: '#374151' }}>Feature</th>
                {ROLES.map(r => (
                  <th key={r} style={{ padding: '16px 24px', fontWeight: 600, color: '#374151', textAlign: 'center', width: 140 }}>{r}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.entries(groupedFeatures).map(([category, items]) => (
                <React.Fragment key={category}>
                  <tr>
                    <td colSpan={ROLES.length + 1} style={{ background: '#F3F4F6', padding: '8px 24px', fontSize: 12, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 1 }}>
                      {category}
                    </td>
                  </tr>
                  {items.map(item => {
                    const featureRoles = mappings[item.key] || []
                    
                    return (
                      <tr key={item.key} style={{ borderBottom: '1px solid #F3F4F6' }}>
                        <td style={{ padding: '16px 24px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <span style={{ fontSize: 18 }}>{item.icon}</span>
                            <div>
                              <div style={{ fontWeight: 600, color: '#111827' }}>{item.label}</div>
                              <div style={{ fontSize: 12, color: '#9CA3AF' }}>{item.path}</div>
                            </div>
                          </div>
                        </td>
                        {ROLES.map(role => {
                          const isEnabled = featureRoles.includes(role)
                          return (
                            <td key={role} style={{ padding: '16px 24px', textAlign: 'center' }}>
                              <label style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}>
                                <div style={{
                                  position: 'relative', width: 44, height: 24, borderRadius: 12,
                                  background: isEnabled ? '#10B981' : '#E5E7EB',
                                  transition: 'background 0.2s',
                                }}>
                                  <div style={{
                                    position: 'absolute', top: 2, left: 2, width: 20, height: 20, borderRadius: 10, background: 'white',
                                    transform: `translateX(${isEnabled ? 20 : 0}px)`, transition: 'transform 0.2s',
                                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
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
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
