// ======================================================
// AUTH.JS — Landing page login / signup logic
// ======================================================

(function () {
  'use strict';

  // ── Check if already logged in ──────────────────────
  supabase.auth.getSession().then(({ data }) => {
    if (data.session) {
      window.location.href = 'app.html';
    }
  });

  // ── DOM refs ──────────────────────────────────────
  const modal       = document.getElementById('auth-modal');
  const closeBtn    = document.getElementById('auth-close-btn');
  const tabs        = document.querySelectorAll('.auth-tab');
  const loginForm   = document.getElementById('login-form');
  const signupForm  = document.getElementById('signup-form');
  const loginErr    = document.getElementById('login-error');
  const signupErr   = document.getElementById('signup-error');
  const signupOk    = document.getElementById('signup-success');

  // ── Helpers ───────────────────────────────────────
  function openModal(tab) {
    modal.classList.remove('hidden');
    switchTab(tab || 'login');
    document.body.style.overflow = 'hidden';
  }
  function closeModal() {
    modal.classList.add('hidden');
    document.body.style.overflow = '';
  }
  function switchTab(name) {
    tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === name));
    loginForm.classList.toggle('hidden', name !== 'login');
    signupForm.classList.toggle('hidden', name !== 'signup');
    [loginErr, signupErr, signupOk].forEach(el => el.classList.add('hidden'));
  }
  function setLoading(form, on) {
    const btn = form.querySelector('.btn-form-primary');
    const txt = btn.querySelector('.btn-text');
    const spin = btn.querySelector('.spinner');
    btn.disabled = on;
    txt.style.opacity = on ? '0' : '1';
    spin.classList.toggle('hidden', !on);
  }
  function showErr(el, msg) { el.textContent = msg; el.classList.remove('hidden'); }

  // ── Tab switching ─────────────────────────────────
  tabs.forEach(t => t.addEventListener('click', () => switchTab(t.dataset.tab)));
  document.querySelectorAll('[data-tab]').forEach(el => {
    el.addEventListener('click', e => { e.preventDefault(); switchTab(el.dataset.tab); });
  });

  // ── Open modal triggers ───────────────────────────
  document.getElementById('nav-login-btn').addEventListener('click', e => { e.preventDefault(); openModal('login'); });
  document.getElementById('nav-signup-btn').addEventListener('click', e => { e.preventDefault(); openModal('signup'); });
  document.getElementById('hero-login-btn').addEventListener('click', () => openModal('login'));
  document.getElementById('hero-signup-btn').addEventListener('click', () => openModal('signup'));

  // ── Close modal ────────────────────────────────────
  closeBtn.addEventListener('click', closeModal);
  modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

  // ── LOGIN ──────────────────────────────────────────
  loginForm.addEventListener('submit', async e => {
    e.preventDefault();
    loginErr.classList.add('hidden');
    const email    = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    setLoading(loginForm, true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(loginForm, false);
    if (error) {
      showErr(loginErr, error.message.includes('Invalid') ? 'Incorrect email or password.' : error.message);
    } else {
      window.location.href = 'app.html';
    }
  });

  // ── SIGN UP ────────────────────────────────────────
  signupForm.addEventListener('submit', async e => {
    e.preventDefault();
    [signupErr, signupOk].forEach(el => el.classList.add('hidden'));
    const name     = document.getElementById('signup-name').value.trim();
    const email    = document.getElementById('signup-email').value.trim();
    const password = document.getElementById('signup-password').value;
    setLoading(signupForm, true);
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: { data: { display_name: name } }
    });
    setLoading(signupForm, false);
    if (error) {
      showErr(signupErr, error.message);
    } else if (data.session) {
      // Auto-confirmed (email confirmation disabled in Supabase)
      window.location.href = 'app.html';
    } else {
      signupOk.textContent = '✅ Account created! Check your email to confirm, then log in.';
      signupOk.classList.remove('hidden');
      signupForm.reset();
    }
  });

})();
