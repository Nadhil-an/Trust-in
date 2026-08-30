import React from 'react';

const defaultOptions = ['CASH', 'CHEQUE', 'BANK_TRANSFER', 'ONLINE', 'UPI'];

export default function PaymentMethodSelector({ value, onChange, options = defaultOptions, className }) {
  return (
    <div className={`payment-method-selector ${className || ''}`} style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
      {options.map((m) => {
        const isActive = value === m;
        return (
          <button
            key={m}
            type="button"
            onClick={() => onChange(m)}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: `1px solid ${isActive ? '#3b82f6' : '#d1d5db'}`,
              backgroundColor: isActive ? '#eff6ff' : '#ffffff',
              color: isActive ? '#1d4ed8' : '#4b5563',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: '60px',
              transition: 'all 0.2s',
            }}
          >
            {m === 'UPI' || m === 'GPay' ? (
              <img 
                src="/gpay.png" 
                alt="GPay" 
                style={{ height: '18px', objectFit: 'contain' }} 
              />
            ) : (
              m.replace('_', ' ')
            )}
          </button>
        );
      })}
    </div>
  );
}
