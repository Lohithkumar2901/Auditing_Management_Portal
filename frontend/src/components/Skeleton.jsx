import React from 'react';

/* Reusable skeleton shimmer blocks */
export function SkeletonLine({ width = '100%', height = '14px', radius = '6px', style = {} }) {
  return (
    <div style={{
      width, height,
      borderRadius: radius,
      background: 'linear-gradient(90deg, #eef2ff 25%, #e0e7ff 50%, #eef2ff 75%)',
      backgroundSize: '200% 100%',
      animation: 'skshimmer 1.4s ease infinite',
      flexShrink: 0,
      ...style,
    }} />
  );
}

export function SkeletonCard({ rows = 4 }) {
  return (
    <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <SkeletonLine width="40%" height="18px" radius="8px" />
      <SkeletonLine width="70%" height="12px" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <SkeletonLine width="24px" height="24px" radius="6px" style={{ flexShrink: 0 }} />
          <SkeletonLine width={`${55 + (i % 3) * 15}%`} height="13px" />
          <SkeletonLine width="60px" height="22px" radius="99px" style={{ marginLeft: 'auto', flexShrink: 0 }} />
        </div>
      ))}
    </div>
  );
}

export function SkeletonTable({ cols = 7, rows = 5 }) {
  return (
    <div style={{ overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', gap: '12px', padding: '12px 16px', background: '#eef2ff', borderBottom: '2px solid #c7d2fe' }}>
        {Array.from({ length: cols }).map((_, i) => (
          <SkeletonLine key={i} width={`${60 + (i % 3) * 20}px`} height="12px" radius="4px" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, ri) => (
        <div key={ri} style={{
          display: 'flex', gap: '12px', padding: '12px 16px',
          borderBottom: '1px solid #f1f5f9',
          animation: `fadeUp 0.3s ease both`,
          animationDelay: `${ri * 60}ms`,
        }}>
          {Array.from({ length: cols }).map((_, ci) => (
            <SkeletonLine key={ci} width={ci === 0 ? '24px' : `${50 + ((ri + ci) % 4) * 18}px`} height="13px" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonSummaryCards({ count = 4 }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px,1fr))', gap: '18px', marginBottom: '28px' }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{
          background: '#fff', borderRadius: '18px', padding: '22px 20px',
          display: 'flex', alignItems: 'center', gap: '18px',
          boxShadow: '0 1px 4px rgba(55,48,163,.08)',
          animation: `fadeUp 0.4s ease both`, animationDelay: `${i * 80}ms`,
        }}>
          <SkeletonLine width="52px" height="52px" radius="12px" style={{ flexShrink: 0 }} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <SkeletonLine width="50px" height="28px" radius="6px" />
            <SkeletonLine width="90px" height="11px" radius="4px" />
          </div>
        </div>
      ))}
    </div>
  );
}
