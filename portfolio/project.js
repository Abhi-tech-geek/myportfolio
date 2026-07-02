// ===== Project page: animated metric counters =====
(function () {
    const nums = document.querySelectorAll('.pp-metric-num[data-count]');
    if (!nums.length) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function animate(el) {
        const target = parseInt(el.dataset.count, 10);
        const suffix = el.dataset.suffix || '';
        if (reduced) { el.textContent = target + suffix; return; }
        const dur = 1400;
        const start = performance.now();
        function frame(now) {
            const p = Math.min((now - start) / dur, 1);
            const eased = 1 - Math.pow(1 - p, 3);
            el.textContent = Math.round(target * eased) + suffix;
            if (p < 1) requestAnimationFrame(frame);
        }
        requestAnimationFrame(frame);
    }

    const io = new IntersectionObserver((entries, obs) => {
        entries.forEach(e => {
            if (e.isIntersecting) { animate(e.target); obs.unobserve(e.target); }
        });
    }, { threshold: 0.5 });

    nums.forEach(n => { n.textContent = '0'; io.observe(n); });
})();

// ===== Back to top button =====
(function () {
    const btn = document.createElement('button');
    btn.className = 'back-to-top';
    btn.setAttribute('aria-label', 'Back to top');
    btn.innerHTML = '<i class="fa-solid fa-arrow-up"></i>';
    btn.addEventListener('click', function () {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    document.body.appendChild(btn);
    function toggle() {
        btn.classList.toggle('show', window.scrollY > 500);
    }
    window.addEventListener('scroll', toggle, { passive: true });
    toggle();
})();

// ===== Scroll reveal =====
(function () {
    const els = document.querySelectorAll('.pp-section, .pp-showcase, .pp-cta-band');
    if (!els.length) return;
    if (!('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        els.forEach(el => el.classList.add('in'));
        return;
    }
    const io = new IntersectionObserver(function (entries, obs) {
        entries.forEach(function (e) {
            if (e.isIntersecting) { e.target.classList.add('in'); obs.unobserve(e.target); }
        });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    els.forEach(el => io.observe(el));
    // safety: reveal everything after 2.5s in case observer misses
    setTimeout(function () { els.forEach(el => el.classList.add('in')); }, 2500);
})();

// ===== Magnetic buttons =====
(function () {
    if (window.matchMedia('(pointer: coarse)').matches) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    document.querySelectorAll('.btn').forEach(function (btn) {
        btn.classList.add('magnetic');
        btn.addEventListener('mousemove', function (e) {
            const r = btn.getBoundingClientRect();
            const mx = e.clientX - (r.left + r.width / 2);
            const my = e.clientY - (r.top + r.height / 2);
            const dx = Math.max(-14, Math.min(14, mx * 0.3));
            const dy = Math.max(-10, Math.min(10, my * 0.5));
            btn.style.transform = 'translate(' + dx.toFixed(1) + 'px,' + dy.toFixed(1) + 'px)';
        });
        btn.addEventListener('mouseleave', function () { btn.style.transform = ''; });
    });
})();

// ===== Smooth in-page anchor scroll (native, no per-frame cost) =====
(function () {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.querySelectorAll('a[href^="#"]').forEach(function (a) {
        const id = a.getAttribute('href');
        if (!id || id.length < 2) return;
        a.addEventListener('click', function (e) {
            const t = document.querySelector(id);
            if (!t) return;
            e.preventDefault();
            const y = t.getBoundingClientRect().top + window.pageYOffset - 72;
            window.scrollTo({ top: y, behavior: reduce ? 'auto' : 'smooth' });
        });
    });
})();
