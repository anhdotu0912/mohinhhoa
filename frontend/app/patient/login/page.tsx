'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function PatientLogin() {
  const router = useRouter();
  const [email, setEmail] = useState('benhnhan@nutrimed.vn');
  const [password, setPassword] = useState('123456');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // Giả lập đăng nhập thành công
    router.push('/patient/chat');
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f0f9ff' }}>
      <div className="glass-panel" style={{ width: '100%', maxWidth: '400px', padding: '2.5rem', borderRadius: '1rem', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)' }}>
        
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '1.75rem', color: 'var(--primary-dark)', marginBottom: '0.5rem' }}>Đăng nhập Bệnh nhân</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '1rem' }}>Chào mừng trở lại! Vui lòng đăng nhập để tiếp tục.</p>
        </div>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          <div>
            <label style={{ display: 'block', fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.5rem' }}>Email hoặc Số điện thoại</label>
            <input 
              type="text" 
              className="form-input" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required 
              style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1' }}
            />
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <label style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-main)' }}>Mật khẩu</label>
              <Link href="#" style={{ fontSize: '0.85rem', color: 'var(--primary)', textDecoration: 'none' }}>Quên mật khẩu?</Link>
            </div>
            <input 
              type="password" 
              className="form-input" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required 
              style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1' }}
            />
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '0.875rem', fontSize: '1rem', marginTop: '0.5rem' }}>
            Đăng nhập
          </button>

        </form>

        <div style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.95rem', color: 'var(--text-muted)' }}>
          Chưa có tài khoản?{' '}
          <Link href="/patient/register" style={{ color: 'var(--primary)', fontWeight: 600, textDecoration: 'none' }}>
            Đăng ký ngay
          </Link>
        </div>
        
        <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
          <Link href="/" style={{ fontSize: '0.95rem', color: 'var(--text-muted)', textDecoration: 'none' }}>
            &larr; Quay lại trang chủ
          </Link>
        </div>
      </div>
    </div>
  );
}
